import fs from "fs";
import path from "path";
import { execSync } from "child_process";

export const HISTORY_ROOT = process.env.HISTORY_ROOT ?? "/Users/lijixiang/repo/history";

/** Resolve and validate path is within allowed roots. */
function safePath(p: string): string {
  const resolved = path.resolve(p);
  const allowed = [HISTORY_ROOT, "/Users/lijixiang/repo"];
  if (!allowed.some((root) => resolved.startsWith(root))) {
    throw new Error(`Path '${resolved}' is outside allowed directories`);
  }
  return resolved;
}

export interface DirEntry {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: DirEntry[];
}

const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "dist", ".next", "build", ".cache"]);

export function listDir(dir: string, depth = 1, maxEntries = 200): DirEntry[] {
  const resolved = safePath(dir);
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(resolved, { withFileTypes: true });
  } catch {
    return [];
  }

  const result: DirEntry[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") && SKIP_DIRS.has(e.name)) continue;
    if (SKIP_DIRS.has(e.name)) continue;
    if (result.length >= maxEntries) break;

    const full = path.join(resolved, e.name);
    if (e.isDirectory()) {
      const entry: DirEntry = { name: e.name, type: "dir" };
      if (depth > 1) {
        entry.children = listDir(full, depth - 1, 50);
      }
      result.push(entry);
    } else {
      try {
        const stat = fs.statSync(full);
        result.push({ name: e.name, type: "file", size: stat.size });
      } catch {
        result.push({ name: e.name, type: "file" });
      }
    }
  }
  return result.sort((a, b) => {
    if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function readFile(filePath: string, maxBytes = 100_000): string {
  const resolved = safePath(filePath);
  try {
    const stat = fs.statSync(resolved);
    if (stat.size > maxBytes) {
      const buf = Buffer.alloc(maxBytes);
      const fd = fs.openSync(resolved, "r");
      fs.readSync(fd, buf, 0, maxBytes, 0);
      fs.closeSync(fd);
      return buf.toString("utf-8") + `\n\n... [truncated, total ${stat.size} bytes]`;
    }
    return fs.readFileSync(resolved, "utf-8");
  } catch (e) {
    return `Error reading file: ${e}`;
  }
}

export function grepFiles(dir: string, pattern: string, maxResults = 30): string {
  const resolved = safePath(dir);
  try {
    const cmd = `rg --no-heading -n --max-count=5 -l "${pattern.replace(/"/g, '\\"')}" "${resolved}" 2>/dev/null | head -${maxResults}`;
    const files = execSync(cmd, { encoding: "utf-8", timeout: 8000 }).trim().split("\n").filter(Boolean);
    if (!files.length) return "No matches found.";

    const results: string[] = [];
    for (const f of files.slice(0, 15)) {
      try {
        const matchCmd = `rg --no-heading -n --max-count=3 "${pattern.replace(/"/g, '\\"')}" "${f}" 2>/dev/null`;
        const matches = execSync(matchCmd, { encoding: "utf-8", timeout: 3000 }).trim();
        const rel = path.relative(resolved, f);
        results.push(`## ${rel}\n${matches}`);
      } catch { /* skip */ }
    }
    return results.join("\n\n");
  } catch (e) {
    return `grep error: ${e}`;
  }
}

export function getWiki(wikiPath: string): string {
  try {
    return fs.readFileSync(safePath(wikiPath), "utf-8");
  } catch {
    return "Wiki not found.";
  }
}
