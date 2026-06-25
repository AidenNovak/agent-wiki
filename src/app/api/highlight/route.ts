import { NextRequest, NextResponse } from "next/server";
import { codeToHtml, addClassToHast } from "shiki";

export const dynamic = "force-dynamic";

const LANG_MAP: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  mjs: "javascript", cjs: "javascript",
  py: "python", pyi: "python",
  go: "go",
  rs: "rust",
  rb: "ruby",
  java: "java", kt: "kotlin",
  sh: "bash", bash: "bash", zsh: "bash",
  md: "markdown",
  json: "json",
  yaml: "yaml", yml: "yaml",
  toml: "toml",
  css: "css", scss: "scss",
  html: "html",
  xml: "xml",
  c: "c", cpp: "cpp", cc: "cpp", h: "c", hpp: "cpp",
  mermaid: "text",
  plaintext: "text",
  text: "text",
};

function resolveLanguage(raw: string): string {
  const lower = (raw ?? "").toLowerCase();
  return LANG_MAP[lower] ?? lower;
}

/** Transformer that injects data-line attributes for CSS counters */
function lineNumberTransformer() {
  return {
    name: "line-numbers",
    line(node: Parameters<typeof addClassToHast>[0], line: number) {
      node.properties ??= {};
      node.properties["data-line"] = String(line);
    },
  };
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const code: string = typeof body.code === "string" ? body.code : "";
  const lang = resolveLanguage(body.lang ?? "text");
  const withLineNumbers: boolean = body.lineNumbers !== false;

  if (!code) return NextResponse.json({ html: "" });

  const transformers = withLineNumbers ? [lineNumberTransformer()] : [];

  try {
    const html = await codeToHtml(code, {
      lang,
      theme: "github-dark",
      transformers,
    });
    return NextResponse.json({ html });
  } catch {
    // Unknown language fallback
    try {
      const html = await codeToHtml(code, {
        lang: "text",
        theme: "github-dark",
        transformers: withLineNumbers ? [lineNumberTransformer()] : [],
      });
      return NextResponse.json({ html, fallback: true });
    } catch (e) {
      return NextResponse.json({ error: String(e) }, { status: 500 });
    }
  }
}
