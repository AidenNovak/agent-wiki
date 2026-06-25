import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EVEROS = process.env.EVEROS_BASE_URL ?? "http://127.0.0.1:8000";

export async function POST(req: NextRequest) {
  const { query, sources, topK = 8, method = "hybrid" } = await req.json();

  if (!query) return NextResponse.json({ error: "query required" }, { status: 400 });

  try {
    const res = await fetch(`${EVEROS}/api/v1/knowledge/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        method,
        top_k: topK,
        include_content: true,
        score_threshold: 0.3,
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.error?.message ?? `EverOS ${res.status}`, hits: [] });
    }

    const data = await res.json();
    const allHits: SearchHit[] = data.data?.hits ?? [];

    // Filter by selected sources if provided
    const filtered = sources?.length
      ? allHits.filter((h: SearchHit) =>
          sources.some((s: string) => h.topic_path?.toLowerCase().startsWith(s.toLowerCase()))
        )
      : allHits;

    return NextResponse.json({
      hits: filtered.slice(0, topK),
      total: filtered.length,
      took_ms: data.data?.took_ms,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e), hits: [] });
  }
}

interface SearchHit {
  topic_id: string;
  topic_name: string;
  topic_path: string;
  summary: string;
  content?: string;
  score: number;
  document?: { title: string; doc_id: string };
}
