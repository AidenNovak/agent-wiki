/**
 * Prompt file discovery for each agent repo.
 *
 * Two strategies:
 *  1. Static patterns  – known directory/file name patterns
 *  2. Filesystem scan  – walk the repo looking for prompt-like files
 */

import fs from "fs";
import path from "path";

export interface PromptFile {
  /** Absolute path */
  path: string;
  /** Path relative to agent root */
  rel: string;
  /** File size in bytes */
  size: number;
  /** Confidence: "known" | "pattern" */
  confidence: "known" | "pattern";
}

// ── Per-agent known prompt locations ─────────────────────────────────────────
// Keys are agent names as defined in lib/agents.ts
const KNOWN_PATHS: Record<string, string[]> = {
  aider: [
    "aider/prompts",
    "aider/coders",            // BasePrompts classes
  ],
  opencode: [
    "packages/opencode/src/session",
    "packages/opencode/src/provider",
    "packages/opencode/src/prompt",
  ],
  cline: [
    "src/core/prompts",
    "src/api/providers",
  ],
  codex: [
    "packages/cli/src/instructions",
    "packages/cli/src/utils/instructions.ts",
  ],
  OpenHands: [
    "microagents",
    "agenthub",
    "openhands/agenthub",
    "openhands/core/prompt",
  ],
  "gemini-cli": [
    "packages/core/src/core/prompts",
    "packages/core/src",
    "src/prompts",
  ],
  openinterpreter: [
    "interpreter/prompts",
    "interpreter/terminal_interface",
  ],
  "kimi-code": [
    "src/prompts",
    "src/agent",
  ],
  "qwen-code": [
    "packages/core/src/core/prompts",
    "src/gemini",                    // qwen-code forks gemini-cli
  ],
  pi: [
    "pi/prompts",
    "prompts",
    "src/prompts",
  ],
  Kun: [
    "packages/core/src/prompts",
    "kun/prompts",
  ],
  multica: [
    "packages/core/prompts",
    "server/internal/prompt",
    "apps/agent/src/prompts",
  ],
};

// File name patterns that indicate prompt content
const PROMPT_NAME_PATTERNS: RegExp[] = [
  /prompt/i,
  /system[\-_]?message/i,
  /instruction/i,
  /persona/i,
  /agent[\-_]?config/i,
  /\.agent\.md$/i,
];

// Extensions to include in pattern scan
const PROMPT_EXTS = new Set([".md", ".txt", ".yaml", ".yml", ".toml", ".py", ".ts", ".js"]);

// Directories to always skip
const SKIP_DIRS = new Set([
  ".git", "node_modules", "__pycache__", ".venv", "venv",
  "dist", "build", ".next", "target", "coverage", ".cache",
  "test", "tests", "__tests__", "spec", "fixtures", "testdata",
]);

// ── Scan helpers ──────────────────────────────────────────────────────────────

function looksLikePromptFile(name: string): boolean {
  if (!PROMPT_EXTS.has(path.extname(name).toLowerCase())) return false;
  return PROMPT_NAME_PATTERNS.some((re) => re.test(name));
}

function statSize(p: string): number {
  try { return fs.statSync(p).size; } catch { return 0; }
}

function walkDir(dir: string, results: PromptFile[], agentRoot: string, depth = 0): void {
  if (depth > 6) return;
  let entries: fs.Dirent[];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }

  for (const e of entries) {
    if (SKIP_DIRS.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      walkDir(full, results, agentRoot, depth + 1);
    } else if (e.isFile() && looksLikePromptFile(e.name)) {
      const size = statSize(full);
      if (size > 0 && size < 500_000) {
        results.push({
          path: full,
          rel: path.relative(agentRoot, full),
          size,
          confidence: "pattern",
        });
      }
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function findPromptFiles(agentName: string, agentDir: string): PromptFile[] {
  const seen = new Set<string>();
  const results: PromptFile[] = [];

  const add = (p: string, confidence: PromptFile["confidence"]) => {
    if (seen.has(p)) return;
    seen.add(p);
    const size = statSize(p);
    if (size > 0 && size < 500_000) {
      results.push({ path: p, rel: path.relative(agentDir, p), size, confidence });
    }
  };

  // 1. Known paths
  const known = KNOWN_PATHS[agentName] ?? [];
  for (const rel of known) {
    const full = path.join(agentDir, rel);
    try {
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        // Enumerate direct children only (not recursive to avoid noise)
        const children = fs.readdirSync(full, { withFileTypes: true });
        for (const c of children) {
          if (c.isFile() && PROMPT_EXTS.has(path.extname(c.name).toLowerCase())) {
            add(path.join(full, c.name), "known");
          }
        }
      } else if (stat.isFile()) {
        add(full, "known");
      }
    } catch { /* path doesn't exist for this agent */ }
  }

  // 2. Pattern walk (only if known paths gave few results)
  if (results.length < 3) {
    const patternResults: PromptFile[] = [];
    walkDir(agentDir, patternResults, agentDir);
    for (const r of patternResults) {
      add(r.path, "pattern");
    }
  }

  // Sort: known first, then by size desc
  return results.sort((a, b) => {
    if (a.confidence !== b.confidence) return a.confidence === "known" ? -1 : 1;
    return b.size - a.size;
  });
}
