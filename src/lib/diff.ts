/**
 * Minimal Myers diff, line-level.
 * Returns an array of hunks for rendering in the split editor.
 */

export type LineKind = "equal" | "insert" | "delete";

export interface DiffLine {
  kind: LineKind;
  /** Line number in original (1-indexed), undefined for pure insertions */
  origLine?: number;
  /** Line number in modified (1-indexed), undefined for pure deletions */
  modLine?: number;
  text: string;
}

export interface DiffStats {
  added: number;
  removed: number;
  changed: number;
}

/** Produce line-by-line diff between two strings. */
export function diffLines(original: string, modified: string): DiffLine[] {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");

  const lcs = computeLCS(origLines, modLines);
  const result: DiffLine[] = [];

  let oi = 0;
  let mi = 0;
  let li = 0;

  while (oi < origLines.length || mi < modLines.length) {
    if (
      li < lcs.length &&
      oi < origLines.length &&
      mi < modLines.length &&
      origLines[oi] === lcs[li] &&
      modLines[mi] === lcs[li]
    ) {
      result.push({ kind: "equal", origLine: oi + 1, modLine: mi + 1, text: origLines[oi] });
      oi++; mi++; li++;
    } else if (mi < modLines.length && (li >= lcs.length || modLines[mi] !== lcs[li])) {
      result.push({ kind: "insert", modLine: mi + 1, text: modLines[mi] });
      mi++;
    } else {
      result.push({ kind: "delete", origLine: oi + 1, text: origLines[oi] });
      oi++;
    }
  }

  return result;
}

export function diffStats(lines: DiffLine[]): DiffStats {
  let added = 0, removed = 0;
  for (const l of lines) {
    if (l.kind === "insert") added++;
    else if (l.kind === "delete") removed++;
  }
  return { added, removed, changed: Math.min(added, removed) };
}

// ── LCS via Hunt-Szymanski (O(n·d)) for reasonable file sizes ─────────────────

function computeLCS(a: string[], b: string[]): string[] {
  // Build index of b
  const bIndex = new Map<string, number[]>();
  for (let i = 0; i < b.length; i++) {
    const arr = bIndex.get(b[i]) ?? [];
    arr.push(i);
    bIndex.set(b[i], arr);
  }

  // Standard DP LCS — adequate for prompt files (typically < 2000 lines)
  if (a.length * b.length > 500_000) {
    // Very large files: return shorter sequence to avoid O(n²) hang
    return [];
  }

  const m = a.length;
  const n = b.length;
  // dp[i][j] = LCS length of a[0..i-1] and b[0..j-1]
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack
  const lcs: string[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return lcs;
}
