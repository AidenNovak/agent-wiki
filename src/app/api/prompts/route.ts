import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getAgent } from "@/lib/agents";
import { findPromptFiles } from "@/lib/prompt-scanner";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const agent = searchParams.get("agent");
  const filePath = searchParams.get("file");

  // Return file content
  if (filePath) {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      return NextResponse.json({ content, size: Buffer.byteLength(content, "utf-8") });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 404 });
    }
  }

  // Return prompt file list for an agent
  if (!agent) return NextResponse.json({ error: "agent or file required" }, { status: 400 });

  const meta = getAgent(agent);
  if (!meta) return NextResponse.json({ error: `Agent '${agent}' not found` }, { status: 404 });

  const files = findPromptFiles(agent, meta.dir);
  return NextResponse.json({
    agent,
    dir: meta.dir,
    files: files.map((f) => ({
      path: f.path,
      rel: f.rel,
      size: f.size,
      confidence: f.confidence,
    })),
  });
}
