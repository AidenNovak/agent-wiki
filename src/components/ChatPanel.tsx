"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, Loader2, ChevronRight, Copy, Check, Search, FileText, FolderOpen, BookOpen } from "lucide-react";
import { useRef, useEffect, useState, lazy, Suspense, useCallback } from "react";
import type { UIMessage } from "ai";
import ShikiCode from "./ShikiCode";

const MermaidBlock = lazy(() => import("./MermaidBlock"));

interface Props {
  activeAgents: string[];
}

// ── Tool call — minimal inline indicator like ChatGPT ─────────────────────────

const TOOL_ICONS: Record<string, React.ReactNode> = {
  ls_directory: <FolderOpen size={12} />,
  read_file: <FileText size={12} />,
  grep_files: <Search size={12} />,
  get_wiki: <BookOpen size={12} />,
};

const TOOL_LABELS: Record<string, string> = {
  ls_directory: "Browsed directory",
  read_file: "Read file",
  grep_files: "Searched code",
  get_wiki: "Read wiki",
};

function ToolRow({ toolName, args, result }: {
  toolName: string; args: unknown; result?: string;
}) {
  const [open, setOpen] = useState(false);
  const safeArgs = (args && typeof args === "object") ? args as Record<string, unknown> : {};
  const label = TOOL_LABELS[toolName] ?? toolName;
  const icon = TOOL_ICONS[toolName] ?? <Search size={12} />;

  // Extract a short context string
  const context = safeArgs.path
    ? String(safeArgs.path).split("/").slice(-1)[0]
    : safeArgs.agent_name
    ? String(safeArgs.agent_name)
    : safeArgs.query
    ? String(safeArgs.query).slice(0, 40)
    : "";

  return (
    <div className="mb-1">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-[13px] text-[#8e8ea0] hover:text-[#555] transition-colors group"
      >
        <span className="text-[#aeaebb]">{icon}</span>
        <span>{label}</span>
        {context && <span className="text-[12px] text-[#c5c5d2] font-mono">{context}</span>}
        <ChevronRight
          size={11}
          className={`text-[#c5c5d2] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 ml-1 rounded-2xl bg-[#f4f4f5] border border-[#e4e4e7] overflow-hidden text-[12px] font-mono">
          <div className="px-4 py-3 border-b border-[#e4e4e7]">
            <span className="text-[10px] font-sans font-semibold text-[#a1a1aa] uppercase tracking-wider block mb-1.5">Input</span>
            <pre className="text-[#3f3f46] whitespace-pre-wrap overflow-auto max-h-28">
              {JSON.stringify(safeArgs, null, 2)}
            </pre>
          </div>
          {result && (
            <div className="px-4 py-3">
              <span className="text-[10px] font-sans font-semibold text-[#a1a1aa] uppercase tracking-wider block mb-1.5">Output</span>
              <pre className="text-[#52525b] whitespace-pre-wrap overflow-auto max-h-40">
                {result.length > 2000 ? result.slice(0, 2000) + "\n…" : result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Code block ────────────────────────────────────────────────────────────────

function CodeBlock({ lang, code }: { lang: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const isMermaid = lang === "mermaid";

  const copy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (isMermaid) {
    return (
      <Suspense fallback={<div className="my-3 rounded-2xl bg-[#f4f4f5] p-4 text-[#a1a1aa] text-[13px]">Loading diagram…</div>}>
        <MermaidBlock code={code} />
      </Suspense>
    );
  }

  return (
    <div className="my-3 rounded-2xl overflow-hidden border border-[#e4e4e7] bg-[#18181b]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272a]">
        <span className="text-[11px] text-[#71717a] font-mono">{lang || "code"}</span>
        <button onClick={copy} className="text-[#71717a] hover:text-[#a1a1aa] transition-colors">
          {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
        </button>
      </div>
      <ShikiCode code={code} lang={lang || "text"} className="text-[12.5px] [&_pre]:p-4 [&_pre]:!bg-[#18181b] [&_pre]:overflow-auto [&_pre]:max-h-[380px]" />
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

type Seg = { kind: "text"; raw: string } | { kind: "code"; lang: string; code: string };

function parseSegs(raw: string): Seg[] {
  const out: Seg[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) out.push({ kind: "text", raw: raw.slice(last, m.index) });
    out.push({ kind: "code", lang: m[1] || "text", code: m[2] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) out.push({ kind: "text", raw: raw.slice(last) });
  return out;
}

function inline(t: string) {
  return t
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-[#f4f4f5] text-[#18181b] rounded px-1 py-0.5 text-[12.5px] font-mono border border-[#e4e4e7]'>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' target='_blank' rel='noreferrer' class='text-[#2563eb] hover:underline'>$1</a>");
}

function TextSeg({ raw }: { raw: string }) {
  const nodes: React.ReactNode[] = [];
  let bullets: string[] = [];

  const flush = (key: number) => {
    if (!bullets.length) return;
    nodes.push(
      <ul key={`ul${key}`} className="my-2 ml-5 space-y-1 list-disc marker:text-[#a1a1aa]">
        {bullets.map((b, j) => (
          <li key={j} className="text-[15px] leading-7 text-[#0d0d0d]"
            dangerouslySetInnerHTML={{ __html: inline(b) }} />
        ))}
      </ul>
    );
    bullets = [];
  };

  raw.split("\n").forEach((line, i) => {
    const h = line.match(/^(#{1,3})\s+(.+)/);
    if (h) {
      flush(i);
      const cls = h[1].length === 1
        ? "text-[18px] font-semibold mt-5 mb-2 text-[#0d0d0d]"
        : h[1].length === 2
        ? "text-[16px] font-semibold mt-4 mb-1 text-[#0d0d0d]"
        : "text-[15px] font-semibold mt-3 text-[#0d0d0d]";
      nodes.push(<p key={i} className={cls} dangerouslySetInnerHTML={{ __html: inline(h[2]) }} />);
      return;
    }
    const b = line.match(/^[-*+]\s+(.+)/);
    if (b) { bullets.push(b[1]); return; }
    const n = line.match(/^\d+\.\s+(.+)/);
    if (n) { bullets.push(n[1]); return; }
    flush(i);
    if (!line.trim()) { if (i > 0) nodes.push(<div key={i} className="h-2" />); return; }
    nodes.push(
      <p key={i} className="text-[15px] leading-7 text-[#0d0d0d]"
        dangerouslySetInnerHTML={{ __html: inline(line) }} />
    );
  });
  flush(raw.length);
  return <>{nodes}</>;
}

function AIContent({ content }: { content: string }) {
  return (
    <div className="space-y-0.5">
      {parseSegs(content).map((s, i) =>
        s.kind === "code" ? <CodeBlock key={i} lang={s.lang} code={s.code} />
          : <TextSeg key={i} raw={s.raw} />
      )}
    </div>
  );
}

// ── Suggestions ───────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: "🔍", text: "opencode 和 cline 架构对比" },
  { icon: "⚙️", text: "aider 的 agent loop 实现" },
  { icon: "🧩", text: "Kun 多智能体协调机制" },
  { icon: "✏️", text: "哪个 prompt 文件最值得修改？" },
];

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export default function ChatPanel({ activeAgents }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = useCallback(() => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    sendMessage({ role: "user", parts: [{ type: "text", text }] }, { body: { agentContext: activeAgents } });
    setInputValue("");
    if (inputRef.current) { inputRef.current.style.height = "24px"; }
  }, [inputValue, isLoading, sendMessage, activeAgents]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "24px";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const canSend = inputValue.trim().length > 0 && !isLoading;

  return (
    <div
      className="h-full flex flex-col bg-white overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}
    >
      {/* ── Thin header ─────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-2.5 border-b border-[#f0f0f0] flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#0d0d0d]">AI Analysis</span>
        <div className="flex items-center gap-1.5">
          {activeAgents.length > 0
            ? activeAgents.map(a => (
                <span key={a} className="text-[11px] text-[#8e8ea0] bg-[#f7f7f7] border border-[#ebebeb] px-2 py-0.5 rounded-full font-mono">{a}</span>
              ))
            : <span className="text-[11px] text-[#c5c5d2]">DeepSeek V4 Flash</span>}
        </div>
      </div>

      {/* ── Messages ─────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-6 py-6 space-y-6">

          {/* Empty state — centered suggestions */}
          {messages.length === 0 && (
            <div className="flex flex-col items-center pt-8 pb-4">
              <p className="text-[22px] font-semibold text-[#0d0d0d] mb-1">What do you want to explore?</p>
              <p className="text-[14px] text-[#8e8ea0] mb-8">Ask anything about the agent repos below</p>
              <div className="grid grid-cols-2 gap-2 w-full max-w-[520px]">
                {SUGGESTIONS.map(s => (
                  <button
                    key={s.text}
                    onClick={() => { setInputValue(s.text); inputRef.current?.focus(); }}
                    className="flex items-start gap-2.5 text-left px-4 py-3.5 rounded-2xl border border-[#ebebeb] hover:border-[#d4d4d8] hover:bg-[#fafafa] transition-all duration-150 group"
                  >
                    <span className="text-[16px] mt-0.5 shrink-0">{s.icon}</span>
                    <span className="text-[13px] text-[#3f3f46] leading-snug group-hover:text-[#0d0d0d] transition-colors">{s.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          {(messages as UIMessage[]).map(msg => (
            <div key={msg.id}>
              {/* User message */}
              {msg.role === "user" && (
                <div className="flex justify-end">
                  <div className="max-w-[85%] bg-[#f4f4f5] text-[#0d0d0d] rounded-3xl rounded-br-lg px-5 py-3 text-[15px] leading-7 whitespace-pre-wrap" style={{ wordBreak: "break-word" }}>
                    {msg.parts?.map((p, i) => {
                      const tp = p as Record<string, unknown>;
                      return tp.type === "text" && tp.text ? <span key={i}>{String(tp.text)}</span> : null;
                    })}
                  </div>
                </div>
              )}

              {/* AI message */}
              {msg.role === "assistant" && (
                <div className="flex flex-col gap-1">
                  {/* Tool rows first */}
                  {msg.parts?.map((p, i) => {
                    const tp = p as Record<string, unknown>;
                    if (!tp.type || !(String(tp.type).startsWith("tool-") || tp.type === "dynamic-tool")) return null;
                    if (!tp.toolName) return null;
                    return (
                      <ToolRow key={i} toolName={String(tp.toolName)} args={tp.input ?? {}}
                        result={tp.output != null ? String(tp.output) : undefined} />
                    );
                  })}

                  {/* Text content */}
                  {msg.parts?.map((p, i) => {
                    const tp = p as Record<string, unknown>;
                    if (tp.type !== "text" || !tp.text) return null;
                    return <AIContent key={i} content={String(tp.text)} />;
                  })}
                </div>
              )}
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex items-center gap-1 h-7">
              {[0, 1, 2].map(i => (
                <div key={i} className="w-2 h-2 bg-[#d4d4d8] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.9s" }} />
              ))}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="text-[13px] text-[#dc2626] bg-[#fef2f2] border border-[#fecaca] rounded-2xl px-4 py-3">
              {String(error)}
            </div>
          )}
        </div>
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-6 pb-4 pt-2">
        <div className="mx-auto max-w-[680px]">
          <div className={`flex items-end gap-3 bg-white border rounded-[26px] px-4 py-3 shadow-sm transition-all duration-150 ${
            inputValue ? "border-[#d4d4d8] shadow-md" : "border-[#e4e4e7]"
          } focus-within:border-[#a1a1aa] focus-within:shadow-md`}>
            <textarea
              ref={inputRef}
              value={inputValue}
              onChange={onInput}
              onKeyDown={onKeyDown}
              placeholder="Message…"
              rows={1}
              className="flex-1 resize-none bg-transparent text-[15px] text-[#0d0d0d] placeholder-[#a1a1aa] focus:outline-none leading-6 min-h-[24px] max-h-[160px] py-0"
            />
            <button
              onClick={submit}
              disabled={!canSend}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-150 ${
                canSend ? "bg-[#0d0d0d] hover:bg-[#27272a]" : "bg-[#f4f4f5] cursor-not-allowed"
              }`}
            >
              {isLoading
                ? <Loader2 size={14} className="animate-spin text-[#a1a1aa]" />
                : <ArrowUp size={14} className={canSend ? "text-white" : "text-[#a1a1aa]"} />}
            </button>
          </div>
          <p className="text-center text-[11px] text-[#a1a1aa] mt-2">
            Press Enter to send · Shift + Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}
