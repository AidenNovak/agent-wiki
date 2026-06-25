"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  Send, Loader2, Bot, User,
  ChevronDown, ChevronRight, Terminal, Copy, Check,
} from "lucide-react";
import { useRef, useEffect, useState, lazy, Suspense } from "react";
import type { UIMessage } from "ai";
import ShikiCode from "./ShikiCode";

// Lazy-load Mermaid to keep initial bundle small
const MermaidBlock = lazy(() => import("./MermaidBlock"));

interface Props {
  activeAgents: string[];
}

// ── Tool call collapsible ─────────────────────────────────────────────────────

function ToolCallBlock({
  toolName, args, result,
}: {
  toolName: string;
  args: unknown;
  result?: string;
}) {
  const [open, setOpen] = useState(false);
  const safeArgs = (args && typeof args === "object") ? args as Record<string, unknown> : {};
  const shortArg = Object.entries(safeArgs)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(", ");

  return (
    <div className="my-2 rounded-md border border-[#30363d] bg-[#161b22] text-[11px] font-mono overflow-hidden">
      <button
        className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-[#21262d] transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <Terminal size={11} className="text-[#7ee787] shrink-0" />
        <span className="text-[#7ee787] font-semibold">{toolName}</span>
        <span className="text-gray-500 truncate flex-1">
          ({shortArg.slice(0, 70)}{shortArg.length > 70 ? "…" : ""})
        </span>
        {open
          ? <ChevronDown size={11} className="text-gray-500 shrink-0" />
          : <ChevronRight size={11} className="text-gray-500 shrink-0" />}
      </button>

      {open && (
        <div className="border-t border-[#30363d]">
          <div className="px-3 py-2 bg-[#0d1117]">
            <div className="text-[10px] text-gray-600 mb-1">ARGS</div>
            <pre className="whitespace-pre-wrap text-[11px] text-gray-300 overflow-auto">
              {JSON.stringify(safeArgs, null, 2)}
            </pre>
          </div>
          {result && (
            <div className="px-3 py-2 bg-[#0d1117] border-t border-[#30363d]">
              <div className="text-[10px] text-gray-600 mb-1">RESULT</div>
              <pre className="whitespace-pre-wrap text-[11px] text-gray-400 max-h-56 overflow-auto">
                {result.length > 3000 ? result.slice(0, 3000) + "\n…(truncated)" : result}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Code block with copy + shiki ──────────────────────────────────────────────

function ChatCodeBlock({ lang, code }: { lang: string; code: string }) {
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
        <div className="my-2 rounded-md border border-[#30363d] bg-[#161b22] p-4 text-gray-500 text-xs">
          Loading diagram…
        </div>
      }>
        <MermaidBlock code={code} />
      </Suspense>
    );
  }

  return (
    <div className="my-2 rounded-md border border-[#30363d] bg-[#0d1117] overflow-hidden">
      {/* header */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#21262d]">
        <span className="text-[10px] text-gray-500 font-mono">{lang || "code"}</span>
        <button
          onClick={copy}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          title="Copy code"
        >
          {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
        </button>
      </div>
      {/* shiki highlighted code */}
      <div className="overflow-auto max-h-[400px]">
        <ShikiCode code={code} lang={lang || "text"} className="text-[12px] [&_pre]:p-4 [&_pre]:!bg-[#0d1117]" />
      </div>
    </div>
  );
}

// ── Markdown → React (no extra deps) ─────────────────────────────────────────

type ContentSegment =
  | { kind: "text"; raw: string }
  | { kind: "code"; lang: string; code: string };

function parseContent(raw: string): ContentSegment[] {
  const segs: ContentSegment[] = [];
  const codeRe = /```(\w*)\n?([\s\S]*?)```/g;
  let last = 0;
  let m: RegExpExecArray | null;

  while ((m = codeRe.exec(raw)) !== null) {
    if (m.index > last) segs.push({ kind: "text", raw: raw.slice(last, m.index) });
    segs.push({ kind: "code", lang: m[1] || "text", code: m[2] });
    last = m.index + m[0].length;
  }
  if (last < raw.length) segs.push({ kind: "text", raw: raw.slice(last) });
  return segs;
}

// Inline markdown: **bold**, `code`, headers, bullets
function renderInline(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g,
      '<code class="bg-[#161b22] border border-[#30363d] px-1 py-0.5 rounded text-[11px] font-mono text-[#e6edf3]">$1</code>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" target="_blank" rel="noreferrer" class="text-[#58a6ff] hover:underline">$1</a>');
}

function renderTextSegment(raw: string): React.ReactNode {
  const lines = raw.split("\n");
  const nodes: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (!listItems.length) return;
    nodes.push(
      <ul key={`ul-${nodes.length}`} className="my-1 ml-4 space-y-0.5 list-disc">
        {listItems.map((item, i) => (
          <li key={i} className="text-gray-300 text-[13px]"
            dangerouslySetInnerHTML={{ __html: renderInline(item) }} />
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, i) => {
    // Heading
    const h = line.match(/^(#{1,3})\s+(.+)$/);
    if (h) {
      flushList();
      const level = h[1].length;
      const cls = level === 1
        ? "text-[15px] font-bold text-gray-100 mt-3 mb-1"
        : level === 2
          ? "text-[14px] font-semibold text-gray-200 mt-2 mb-0.5"
          : "text-[13px] font-semibold text-gray-300 mt-1";
      nodes.push(
        <p key={i} className={cls}
          dangerouslySetInnerHTML={{ __html: renderInline(h[2]) }} />
      );
      return;
    }

    // Bullet list
    const bullet = line.match(/^[-*+]\s+(.+)$/);
    if (bullet) { listItems.push(bullet[1]); return; }

    // Numbered list
    const num = line.match(/^\d+\.\s+(.+)$/);
    if (num) { listItems.push(num[1]); return; }

    // Horizontal rule
    if (/^---+$/.test(line.trim())) {
      flushList();
      nodes.push(<hr key={i} className="my-2 border-[#30363d]" />);
      return;
    }

    // Empty line = paragraph break
    if (!line.trim()) {
      flushList();
      if (i > 0) nodes.push(<div key={i} className="my-1" />);
      return;
    }

    // Regular text
    flushList();
    nodes.push(
      <p key={i} className="text-gray-300 text-[13px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: renderInline(line) }} />
    );
  });
  flushList();
  return <>{nodes}</>;
}

function MessageContent({ content }: { content: string }) {
  const segments = parseContent(content);
  return (
    <div className="space-y-1">
      {segments.map((seg, i) =>
        seg.kind === "code"
          ? <ChatCodeBlock key={i} lang={seg.lang} code={seg.code} />
          : <div key={i}>{renderTextSegment(seg.raw)}</div>
      )}
    </div>
  );
}

// ── Main ChatPanel ─────────────────────────────────────────────────────────────

const SUGGESTIONS = [
  "对比 opencode 和 cline 的架构设计差异",
  "opencode 的 agent loop 是如何实现的？",
  "Kun 多智能体协调的核心机制",
  "aider 和 openinterpreter 的工具调用方式对比",
];

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

  return (
    <div className="h-full flex flex-col bg-[#0d1117] border-t border-[#21262d]">
      {/* Header */}
      <div className="px-4 py-2 border-b border-[#21262d] flex items-center gap-2 shrink-0 bg-[#010409]">
        <Bot size={14} className="text-[#58a6ff]" />
        <span className="text-[12px] font-semibold text-gray-300">AI Analysis</span>
        <span className="text-[10px] text-gray-600 ml-1">
          DeepSeek V4 Flash · tools: ls / read / grep / wiki
        </span>
        {activeAgents.length > 0 && (
          <div className="ml-auto flex gap-1">
            {activeAgents.map((a) => (
              <span
                key={a}
                className="text-[10px] bg-[#1f6feb22] text-[#58a6ff] border border-[#1f6feb44] px-1.5 py-0.5 rounded font-mono"
              >
                {a}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-6">
            <Bot size={32} className="mx-auto text-gray-700 mb-3" />
            <p className="text-gray-500 text-sm mb-4">Ask anything about the agent repos</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-lg mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setInputValue(s); inputRef.current?.focus(); }}
                  className="text-left px-3 py-2 rounded-md border border-[#21262d] text-[12px] text-gray-400 hover:border-[#30363d] hover:text-gray-300 hover:bg-[#161b22] transition-all"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {(messages as UIMessage[]).map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${
              msg.role === "user" ? "bg-[#1f6feb]" : "bg-[#21262d]"
            }`}>
              {msg.role === "user"
                ? <User size={11} className="text-white" />
                : <Bot size={11} className="text-[#58a6ff]" />}
            </div>

            <div className={`flex-1 min-w-0 ${msg.role === "user" ? "flex flex-col items-end" : ""}`}>
              {msg.parts?.map((part, i) => {
                const tp = part as Record<string, unknown>;

                if (tp.type && (String(tp.type).startsWith("tool-") || tp.type === "dynamic-tool")) {
                  if (!tp.toolName) return null;
                  return (
                    <ToolCallBlock
                      key={i}
                      toolName={String(tp.toolName)}
                      args={tp.input ?? {}}
                      result={tp.output != null ? String(tp.output) : undefined}
                    />
                  );
                }

                if (tp.type === "text" && tp.text) {
                  const text = String(tp.text);
                  return (
                    <div
                      key={i}
                      className={`rounded-lg px-3 py-2 max-w-[92%] ${
                        msg.role === "user"
                          ? "bg-[#1f6feb] text-white"
                          : "bg-[#161b22] text-gray-200 border border-[#21262d]"
                      }`}
                    >
                      {msg.role === "user"
                        ? <span className="text-[13px] whitespace-pre-wrap">{text}</span>
                        : <MessageContent content={text} />}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-gray-500">
            <Loader2 size={14} className="animate-spin text-[#58a6ff]" />
            <span className="text-[12px]">Analyzing…</span>
          </div>
        )}
        {error && (
          <div className="text-red-400 text-xs bg-red-950/30 border border-red-900/50 rounded px-3 py-2">
            {String(error)}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-[#21262d] shrink-0">
        <div className="flex gap-2 items-end">
          <textarea
            ref={inputRef}
            className="flex-1 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-2 text-[13px] text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-[#1f6feb] transition-colors min-h-[38px] max-h-32"
            placeholder="Ask about agent architecture, compare implementations… (Enter to send, Shift+Enter for newline)"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
          />
          <button
            onClick={submit}
            disabled={isLoading || !inputValue.trim()}
            className="bg-[#238636] hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-lg px-3 py-2 transition-colors shrink-0"
          >
            {isLoading
              ? <Loader2 size={16} className="animate-spin" />
              : <Send size={16} />}
          </button>
        </div>
      </div>
    </div>
  );
}
