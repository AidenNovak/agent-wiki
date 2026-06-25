"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp, Loader2,
  ChevronDown, ChevronRight,
  Copy, Check,
} from "lucide-react";
import { useRef, useEffect, useState, lazy, Suspense } from "react";
import type { UIMessage } from "ai";
import ShikiCode from "./ShikiCode";

const MermaidBlock = lazy(() => import("./MermaidBlock"));

interface Props {
  activeAgents: string[];
}

// ── Tool pill (ChatGPT-style inline tool indicator) ───────────────────────────

const TOOL_LABELS: Record<string, string> = {
  ls_directory: "Listed directory",
  read_file: "Read file",
  grep_files: "Searched code",
  get_wiki: "Read wiki",
};

function ToolPill({
  toolName, args, result,
}: {
  toolName: string;
  args: unknown;
  result?: string;
}) {
  const [open, setOpen] = useState(false);
  const safeArgs = (args && typeof args === "object") ? args as Record<string, unknown> : {};

  // Extract the most relevant arg for the label
  const label = TOOL_LABELS[toolName] ?? toolName;
  const detail = safeArgs.path
    ? String(safeArgs.path).split("/").slice(-2).join("/")
    : safeArgs.agent_name
    ? String(safeArgs.agent_name)
    : safeArgs.dir
    ? String(safeArgs.dir).split("/").slice(-2).join("/")
    : "";

  return (
    <div className="my-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[12px] text-[#8e8ea0] hover:text-[#acacbc] transition-colors group"
      >
        {/* Small rotating chevron */}
        <span className={`inline-block transition-transform duration-150 ${open ? "rotate-90" : ""}`}>
          <ChevronRight size={12} />
        </span>
        <span className="font-medium">{label}</span>
        {detail && <span className="text-[11px] opacity-60 font-mono">{detail}</span>}
      </button>

      {open && (
        <div className="mt-1.5 ml-4 rounded-xl bg-[#1c1c1e] border border-[#2c2c2e] overflow-hidden text-[11px] font-mono">
          {/* Args */}
          <div className="px-3 py-2 border-b border-[#2c2c2e]">
            <span className="text-[#636366] uppercase tracking-wider text-[9px] font-semibold block mb-1">Input</span>
            <pre className="text-[#ebebf599] whitespace-pre-wrap overflow-auto max-h-24">
              {JSON.stringify(safeArgs, null, 2)}
            </pre>
          </div>
          {/* Result */}
          {result && (
            <div className="px-3 py-2">
              <span className="text-[#636366] uppercase tracking-wider text-[9px] font-semibold block mb-1">Output</span>
              <pre className="text-[#ebebf580] whitespace-pre-wrap overflow-auto max-h-36">
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

function InlineCode({ children }: { children: string }) {
  return (
    <code className="bg-[#2c2c2e] text-[#ebebf5] rounded px-1 py-0.5 text-[12px] font-mono">
      {children}
    </code>
  );
}

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
      <Suspense fallback={
        <div className="my-3 rounded-2xl bg-[#1c1c1e] p-4 text-[#636366] text-[12px]">
          Loading diagram…
        </div>
      }>
        <MermaidBlock code={code} />
      </Suspense>
    );
  }

  return (
    <div className="my-3 rounded-2xl overflow-hidden bg-[#1c1c1e] border border-[#2c2c2e]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#2c2c2e]">
        <span className="text-[11px] text-[#636366] font-mono">{lang || "code"}</span>
        <button
          onClick={copy}
          className="text-[#636366] hover:text-[#ebebf5] transition-colors"
          title="Copy"
        >
          {copied
            ? <Check size={13} className="text-green-400" />
            : <Copy size={13} />}
        </button>
      </div>
      <ShikiCode
        code={code}
        lang={lang || "text"}
        className="text-[12px] [&_pre]:p-4 [&_pre]:!bg-transparent [&_pre]:overflow-auto [&_pre]:max-h-[400px]"
      />
    </div>
  );
}

// ── Markdown renderer ─────────────────────────────────────────────────────────

type ContentSeg =
  | { kind: "text"; raw: string }
  | { kind: "code"; lang: string; code: string };

function parseContent(raw: string): ContentSeg[] {
  const segs: ContentSeg[] = [];
  const re = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0, m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > last) segs.push({ kind: "text", raw: raw.slice(last, m.index) });
    segs.push({ kind: "code", lang: m[1] || "text", code: m[2] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) segs.push({ kind: "text", raw: raw.slice(last) });
  return segs;
}

function renderInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong class='font-semibold text-[#ebebf5]'>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-[#2c2c2e] text-[#ebebf5] rounded px-1 py-0.5 text-[12px] font-mono'>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' target='_blank' rel='noreferrer' class='text-[#0a84ff] hover:underline'>$1</a>");
}

function MarkdownContent({ content }: { content: string }) {
  const segments = parseContent(content);

  return (
    <div className="space-y-1.5">
      {segments.map((seg, i) =>
        seg.kind === "code" ? (
          <CodeBlock key={i} lang={seg.lang} code={seg.code} />
        ) : (
          <TextSegment key={i} raw={seg.raw} />
        )
      )}
    </div>
  );
}

function TextSegment({ raw }: { raw: string }) {
  const lines = raw.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flush = (i: number) => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`ul-${i}`} className="my-2 ml-4 space-y-1 list-disc">
        {listItems.map((item, j) => (
          <li key={j} className="text-[14px] leading-relaxed text-[#ebebf5cc]"
            dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flush(i);
      const level = h[1].length;
      const sz = level === 1 ? "text-[16px] font-semibold mt-4 mb-1 text-[#ebebf5]"
        : level === 2 ? "text-[14px] font-semibold mt-3 mb-0.5 text-[#ebebf5]"
        : "text-[13px] font-medium mt-2 text-[#ebebf5]";
      nodes.push(<p key={i} className={sz} dangerouslySetInnerHTML={{ __html: renderInline(h[2]) }} />);
      return;
    }
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (bullet) { listItems.push(bullet[1]); return; }
    if (numbered) { listItems.push(numbered[1]); return; }
    if (/^-{3,}$/.test(line.trim())) {
      flush(i);
      nodes.push(<hr key={i} className="my-3 border-[#2c2c2e]" />);
      return;
    }
    flush(i);
    if (!line.trim()) { if (i > 0) nodes.push(<div key={i} className="h-1.5" />); return; }
    nodes.push(
      <p key={i} className="text-[14px] leading-[1.7] text-[#ebebf5cc]"
        dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
    );
  });
  flush(lines.length);
  return <>{nodes}</>;
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "对比 opencode 和 cline 的架构",
  "aider 的 agent loop 实现",
  "Kun 多智能体协调机制",
  "哪个 agent 的 prompt 最值得参考？",
];

// ── Main ChatPanel ─────────────────────────────────────────────────────────────

export default function ChatPanel({ activeAgents }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [inputValue, setInputValue] = useState("");

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: "/api/chat" }),
  });

  const isLoading = status === "streaming" || status === "submitted";

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const submit = () => {
    const text = inputValue.trim();
    if (!text || isLoading) return;
    sendMessage(
      { role: "user", parts: [{ type: "text", text }] },
      { body: { agentContext: activeAgents } },
    );
    setInputValue("");
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  // Auto-resize textarea
  const onInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  };

  return (
    <div className="h-full flex flex-col bg-[#111111] overflow-hidden" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif' }}>
      {/* ── Slim header ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-b border-[#1c1c1e] shrink-0">
        <span className="text-[13px] font-medium text-[#ebebf5]">AI Analysis</span>
        <div className="flex items-center gap-1.5">
          {activeAgents.map((a) => (
            <span key={a} className="text-[11px] bg-[#1c1c1e] text-[#636366] px-2 py-0.5 rounded-full font-mono">
              {a}
            </span>
          ))}
          {!activeAgents.length && (
            <span className="text-[11px] text-[#3a3a3c]">DeepSeek V4 Flash</span>
          )}
        </div>
      </div>

      {/* ── Messages ───────────────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-6">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full min-h-[160px] text-center">
            <div className="w-10 h-10 rounded-full bg-[#1c1c1e] flex items-center justify-center mb-4">
              <span className="text-lg">⚡</span>
            </div>
            <p className="text-[14px] text-[#636366] mb-5">Ask anything about the agent repos</p>
            <div className="flex flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInputValue(s); inputRef.current?.focus(); }}
                  className="text-[12px] text-[#8e8ea0] border border-[#2c2c2e] rounded-xl px-3.5 py-1.5 hover:bg-[#1c1c1e] hover:text-[#ebebf5] hover:border-[#3a3a3c] transition-all duration-150"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {(messages as UIMessage[]).map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}>

            {/* Tool calls (AI only, above text) */}
            {msg.role === "assistant" && msg.parts?.map((part, i) => {
              const tp = part as Record<string, unknown>;
              if (tp.type && (String(tp.type).startsWith("tool-") || tp.type === "dynamic-tool")) {
                if (!tp.toolName) return null;
                return (
                  <ToolPill
                    key={i}
                    toolName={String(tp.toolName)}
                    args={tp.input ?? {}}
                    result={tp.output != null ? String(tp.output) : undefined}
                  />
                );
              }
              return null;
            })}

            {/* Message bubble / text */}
            {msg.parts?.map((part, i) => {
              const tp = part as Record<string, unknown>;
              if (tp.type !== "text" || !tp.text) return null;
              const text = String(tp.text);

              if (msg.role === "user") {
                return (
                  <div
                    key={i}
                    className="max-w-[80%] bg-[#0a84ff] text-white rounded-[20px] rounded-br-[4px] px-4 py-2.5 text-[14px] leading-[1.5] whitespace-pre-wrap"
                    style={{ wordBreak: "break-word" }}
                  >
                    {text}
                  </div>
                );
              }

              return (
                <div key={i} className="max-w-full">
                  <MarkdownContent content={text} />
                </div>
              );
            })}
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center gap-2">
            {/* Pulsing dots (Apple style) */}
            <div className="flex gap-1 items-center h-5">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 bg-[#636366] rounded-full animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="text-[12px] text-[#ff453a] bg-[#2c1215] border border-[#3d1219] rounded-xl px-4 py-3">
            {String(error)}
          </div>
        )}
      </div>

      {/* ── Input area ─────────────────────────────────────────────────────── */}
      <div className="px-4 py-3 shrink-0">
        <div className={`flex items-end gap-2 bg-[#1c1c1e] rounded-[22px] px-4 py-2.5 transition-all duration-200 border ${
          inputValue ? "border-[#3a3a3c]" : "border-transparent"
        } focus-within:border-[#3a3a3c]`}>
          <textarea
            ref={inputRef}
            className="flex-1 bg-transparent text-[#ebebf5] placeholder-[#48484a] text-[14px] leading-[1.5] resize-none focus:outline-none min-h-[22px] max-h-[120px] py-0.5"
            placeholder="Message…"
            value={inputValue}
            onChange={onInput}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button
            onClick={submit}
            disabled={isLoading || !inputValue.trim()}
            className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 ${
              inputValue.trim() && !isLoading
                ? "bg-[#ebebf5] hover:bg-white"
                : "bg-[#2c2c2e] cursor-not-allowed"
            }`}
            title="Send (Enter)"
          >
            {isLoading
              ? <Loader2 size={13} className="animate-spin text-[#636366]" />
              : <ArrowUp size={13} className={inputValue.trim() ? "text-[#111111]" : "text-[#48484a]"} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-[#3a3a3c] mt-1.5">
          Enter to send · Shift+Enter for newline
        </p>
      </div>
    </div>
  );
}
