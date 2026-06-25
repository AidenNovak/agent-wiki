import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getAgent } from "@/lib/agents";
import {
  createWorktree,
  getWorktree,
  applyFileChange,
  saveWorktree,
  discardWorktree,
  zipWorktree,
  getFileDiff,
} from "@/lib/worktree-manager";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const action = body.action as string;

  switch (action) {
    // ── Create worktree ─────────────────────────────────────────────────────
    case "create": {
      const agentName: string = body.agent;
      if (!agentName) return NextResponse.json({ error: "agent required" }, { status: 400 });

      const meta = getAgent(agentName);
      if (!meta) return NextResponse.json({ error: `Agent '${agentName}' not found` }, { status: 404 });

      try {
        const wt = createWorktree(agentName, meta.dir);
        return NextResponse.json({
          id: wt.id,
          agentName: wt.agentName,
          worktreePath: wt.worktreePath,
          branch: wt.branch,
          isGit: wt.isGit,
          createdAt: wt.createdAt,
        });
      } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
      }
    }

    // ── Apply file change ────────────────────────────────────────────────────
    case "apply": {
      const { id, filePath, content } = body;
      if (!id || !filePath || typeof content !== "string") {
        return NextResponse.json({ error: "id, filePath, content required" }, { status: 400 });
      }
      try {
        applyFileChange(id, filePath, content);
        return NextResponse.json({ ok: true });
      } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 400 });
      }
    }

    // ── Save (commit) ────────────────────────────────────────────────────────
    case "save": {
      const { id, message } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      try {
        const hash = saveWorktree(id, message);
        return NextResponse.json({ ok: true, commitHash: hash });
      } catch (e) {
        return NextResponse.json({ error: String(e) }, { status: 500 });
      }
    }

    // ── Discard (delete worktree) ────────────────────────────────────────────
    case "discard": {
      const { id } = body;
      if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
      discardWorktree(id);
      return NextResponse.json({ ok: true });
    }

    default:
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "info";
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  // ── Info ───────────────────────────────────────────────────────────────────
  if (action === "info") {
    const wt = getWorktree(id);
    if (!wt) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      id: wt.id,
      agentName: wt.agentName,
      worktreePath: wt.worktreePath,
      branch: wt.branch,
      isGit: wt.isGit,
      modifiedFiles: Array.from(wt.modifiedFiles.keys()),
    });
  }

  // ── Diff ──────────────────────────────────────────────────────────────────
  if (action === "diff") {
    const file = searchParams.get("file");
    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });
    try {
      const diff = getFileDiff(id, file);
      return NextResponse.json({ diff });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  // ── Download ZIP ──────────────────────────────────────────────────────────
  if (action === "download") {
    const wt = getWorktree(id);
    if (!wt) return NextResponse.json({ error: "not found" }, { status: 404 });

    try {
      const zipPath = await zipWorktree(id);
      const data = fs.readFileSync(zipPath);
      fs.unlinkSync(zipPath); // Clean up temp zip after reading
      return new Response(data, {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${wt.agentName}-modified.zip"`,
          "Content-Length": String(data.length),
        },
      });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
}
