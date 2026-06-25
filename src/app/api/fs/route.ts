import { NextRequest, NextResponse } from "next/server";
import { listDir, readFile } from "@/lib/fs-tools";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";

const HISTORY_ROOT = process.env.HISTORY_ROOT ?? "/Users/lijixiang/repo/history";

function safePath(p: string): string {
  const resolved = path.resolve(p);
  if (!resolved.startsWith(HISTORY_ROOT) && !resolved.startsWith("/Users/lijixiang/repo")) {
    throw new Error(`Path '${resolved}' is outside allowed directories`);
  }
  return resolved;
}

/** Search for files matching a name pattern within a directory. */
function findFiles(dir: string, query: string, maxResults = 40): { path: string; name: string; dir: string }[] {
  const resolved = safePath(dir);
  const q = query.toLowerCase();
  if (!q || q.length < 1) return [];

  try {
    // Use find for filename matching
    const cmd = [
      "find", resolved,
      "-not", "-path", "*/\\.git/*",
      "-not", "-path", "*/node_modules/*",
      "-not", "-path", "*/__pycache__/*",
      "-not", "-path", "*/.venv/*",
      "-not", "-path", "*/dist/*",
      "-not", "-path", "*/.next/*",
      "-not", "-path", "*/target/*",
      "-type", "f",
      "-iname", `*${q}*`,
    ].join(" ");

    const raw = execSync(cmd + ` | head -${maxResults}`, {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    return raw.split("\n").filter(Boolean).map((p) => ({
      path: p,
      name: path.basename(p),
      dir: path.dirname(p).replace(resolved, "").replace(/^\//, "") || "(root)",
    }));
  } catch {
    return [];
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "ls";
  const p = searchParams.get("path");

  if (!p && action !== "find") {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  try {
    if (action === "ls") {
      const depth = Math.min(parseInt(searchParams.get("depth") ?? "1"), 5);
      return NextResponse.json(listDir(p!, depth));
    }

    if (action === "read") {
      return NextResponse.json({ content: readFile(p!) });
    }

    if (action === "find") {
      const dir = p ?? HISTORY_ROOT;
      const query = searchParams.get("q") ?? "";
      const results = findFiles(dir, query);
      return NextResponse.json(results);
    }

    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 400 });
  }
}
