/**
 * Git worktree lifecycle management.
 *
 * Each Prompt Lab session can create at most one worktree per call.
 * The manager tracks active worktrees in memory and on disk.
 *
 * Worktree path: /tmp/ae-wt-{agentName}-{id}/
 *
 * If the agent directory is NOT a git repo, we fall back to a plain
 * directory copy so the rest of the flow still works.
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync, execFileSync } from "child_process";

const WORKTREE_BASE = path.join(process.env.TMPDIR ?? "/tmp", "ae-worktrees");

export interface WorktreeInfo {
  id: string;
  agentName: string;
  agentDir: string;
  worktreePath: string;
  branch: string;
  createdAt: number;
  isGit: boolean;
  /** Files explicitly modified (relative path → content) */
  modifiedFiles: Map<string, string>;
}

// In-memory registry (process-scoped; survives hot-reload in dev)
// @ts-expect-error augmenting global for cross-reload persistence in dev
const REGISTRY: Map<string, WorktreeInfo> = (global.__aeWorktrees ??= new Map());

function shortId(): string {
  return crypto.randomBytes(4).toString("hex");
}

function isGitRepo(dir: string): boolean {
  try {
    execFileSync("git", ["-C", dir, "rev-parse", "--git-dir"], { stdio: "ignore" });
    return true;
  } catch { return false; }
}

function copyDirSync(src: string, dest: string): void {
  // Use rsync for speed; fall back to cp
  try {
    execSync(`rsync -a --exclude='.git' --exclude='node_modules' --exclude='__pycache__' "${src}/" "${dest}/"`, {
      stdio: "ignore",
      timeout: 30_000,
    });
  } catch {
    execSync(`cp -r "${src}/." "${dest}/"`, { stdio: "ignore", timeout: 30_000 });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function createWorktree(agentName: string, agentDir: string): WorktreeInfo {
  const id = shortId();
  const worktreePath = path.join(WORKTREE_BASE, `${agentName}-${id}`);
  fs.mkdirSync(WORKTREE_BASE, { recursive: true });
  fs.mkdirSync(worktreePath, { recursive: true });

  const git = isGitRepo(agentDir);
  const branch = `ae-prompt-lab/${id}`;

  if (git) {
    try {
      execFileSync(
        "git",
        ["-C", agentDir, "worktree", "add", "-b", branch, worktreePath, "HEAD"],
        { stdio: "pipe", timeout: 20_000 },
      );
    } catch (e) {
      // If adding worktree fails (e.g. detached HEAD), copy instead
      copyDirSync(agentDir, worktreePath);
    }
  } else {
    copyDirSync(agentDir, worktreePath);
  }

  const info: WorktreeInfo = {
    id,
    agentName,
    agentDir,
    worktreePath,
    branch,
    createdAt: Date.now(),
    isGit: git,
    modifiedFiles: new Map(),
  };
  REGISTRY.set(id, info);
  return info;
}

export function getWorktree(id: string): WorktreeInfo | undefined {
  return REGISTRY.get(id);
}

export function listWorktrees(): WorktreeInfo[] {
  return Array.from(REGISTRY.values());
}

/** Write a file into the worktree and track it as modified. */
export function applyFileChange(id: string, relPath: string, content: string): void {
  const wt = REGISTRY.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);

  const dest = path.join(wt.worktreePath, relPath);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, content, "utf-8");
  wt.modifiedFiles.set(relPath, content);
}

/** Commit current changes in the worktree. Returns commit hash. */
export function saveWorktree(id: string, message?: string): string {
  const wt = REGISTRY.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);
  if (!wt.isGit) return "(no-git: changes saved to disk)";

  const msg = message ?? `Prompt Lab: modify ${Array.from(wt.modifiedFiles.keys()).join(", ")}`;
  try {
    execFileSync("git", ["-C", wt.worktreePath, "add", "-A"], { stdio: "pipe" });
    execFileSync("git", ["-C", wt.worktreePath, "commit", "--allow-empty", "-m", msg], { stdio: "pipe" });
    const hash = execFileSync(
      "git", ["-C", wt.worktreePath, "rev-parse", "--short", "HEAD"],
      { encoding: "utf-8" },
    ).trim();
    return hash;
  } catch (e: unknown) {
    throw new Error(`git commit failed: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Remove the worktree from disk and registry. */
export function discardWorktree(id: string): void {
  const wt = REGISTRY.get(id);
  if (!wt) return;

  try {
    if (wt.isGit) {
      execFileSync("git", ["-C", wt.agentDir, "worktree", "remove", "--force", wt.worktreePath], {
        stdio: "pipe",
        timeout: 10_000,
      });
    }
  } catch { /* ignore */ }

  try { fs.rmSync(wt.worktreePath, { recursive: true, force: true }); } catch { /* ignore */ }
  REGISTRY.delete(id);
}

/** Get unified diff between original and worktree for a file. */
export function getFileDiff(id: string, relPath: string): string {
  const wt = REGISTRY.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);

  const orig = path.join(wt.agentDir, relPath);
  const modified = path.join(wt.worktreePath, relPath);

  try {
    const result = execSync(
      `diff -u "${orig}" "${modified}"`,
      { encoding: "utf-8", timeout: 5000 },
    );
    return result;
  } catch (e: unknown) {
    // diff exits 1 when files differ (normal)
    if (typeof e === "object" && e !== null && "stdout" in e) {
      return (e as { stdout: string }).stdout;
    }
    return "";
  }
}

/** Produce a ZIP archive of the worktree path. Returns the zip file path. */
export async function zipWorktree(id: string): Promise<string> {
  const wt = REGISTRY.get(id);
  if (!wt) throw new Error(`Worktree ${id} not found`);

  const zipPath = path.join(WORKTREE_BASE, `${wt.agentName}-${id}.zip`);

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const createArchive = require("archiver") as (format: string, opts?: object) => import("archiver").Archiver;
  const output = fs.createWriteStream(zipPath);
  const archive = createArchive("zip", { zlib: { level: 6 } });

  await new Promise<void>((resolve, reject) => {
    output.on("close", resolve);
    archive.on("error", reject);
    archive.pipe(output);
    archive.directory(wt.worktreePath, wt.agentName);
    archive.finalize();
  });

  return zipPath;
}
