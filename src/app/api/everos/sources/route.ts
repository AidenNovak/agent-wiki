import { NextResponse } from "next/server";
import { getAllAgents } from "@/lib/agents";

export const dynamic = "force-dynamic";

const EVEROS = process.env.EVEROS_BASE_URL ?? "http://127.0.0.1:8000";

export async function GET() {
  const agents = getAllAgents();

  // Fetch user-uploaded documents from EverOS
  let userDocs: UserDoc[] = [];
  try {
    const res = await fetch(`${EVEROS}/api/v1/knowledge/documents?page_size=50`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const allDocs: EverosDoc[] = data.data?.documents ?? [];
      // Exclude the agent source code docs (they start with an agent name)
      const agentNames = agents.map(a => a.name.toLowerCase());
      userDocs = allDocs
        .filter((d: EverosDoc) => !agentNames.some(n => d.title.toLowerCase().startsWith(n + "/")))
        .map((d: EverosDoc) => ({
          docId: d.doc_id,
          title: d.title,
          topicCount: d.topic_count,
          createdAt: d.created_at,
        }));
    }
  } catch { /* EverOS offline — return empty user docs */ }

  return NextResponse.json({
    repos: agents.map(a => ({
      name: a.name,
      category: a.category,
      description: a.description,
      dir: a.dir,
    })),
    userDocs,
    everosOnline: userDocs !== null,
  });
}

interface EverosDoc {
  doc_id: string;
  title: string;
  topic_count: number;
  created_at: string;
}

interface UserDoc {
  docId: string;
  title: string;
  topicCount: number;
  createdAt: string;
}
