import { NextResponse } from "next/server";
import { getAllAgents } from "@/lib/agents";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getAllAgents().map((a) => ({
    name: a.name,
    category: a.category,
    description: a.description,
    url: a.url,
    dir: a.dir,
    wikiPath: a.wikiPath,
  })));
}
