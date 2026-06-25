import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EVEROS = process.env.EVEROS_BASE_URL ?? "http://127.0.0.1:8000";

/** Proxy a multipart file upload to EverOS Knowledge API */
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const title = form.get("title") as string | null;
    const categoryId = (form.get("category_id") as string | null) ?? "Technology";

    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    // Build multipart form for EverOS
    const everosForm = new FormData();
    everosForm.append("file", file, file.name);
    everosForm.append("title", title ?? file.name);
    everosForm.append("category_id", categoryId);

    const res = await fetch(`${EVEROS}/api/v1/knowledge/documents`, {
      method: "POST",
      body: everosForm,
      signal: AbortSignal.timeout(180_000), // LLM extraction can take a while
    });

    const data = await res.json();
    if (!res.ok) return NextResponse.json({ error: data?.error?.message ?? `EverOS ${res.status}` }, { status: res.status });

    return NextResponse.json({ ok: true, ...data.data });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
