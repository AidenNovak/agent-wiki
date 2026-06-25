"use client";

import "markstream-react/index.css";
import OpenAILogo from "./OpenAILogo";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import {
  ArrowUp, Loader2,
  ChevronDown, ChevronRight,
  Search, FileText, FolderOpen, BookOpen,
  CheckCircle2, Clock,
} from "lucide-react";
import { useRef, useEffect, useState, useCallback, lazy, Suspense } from "react";
import type { UIMessage } from "ai";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
import MarkdownRender from "markstream-react";

const MermaidBlock = lazy(() => import("./MermaidBlock"));

interface Props {
  activeAgents: string[];
  selectedSources?: string[];
  selectedDocs?: string[];
}

// ── Tool icon map ─────────────────────────────────────────────────────────────

const TOOL_META: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  ls_directory: { label: "Browsed directory",  icon: <FolderOpen size={12} />, color: "#f59e0b" },
  read_file:    { label: "Read file",          icon: <FileText size={12} />,   color: "#3b82f6" },
  grep_files:   { label: "Searched code",      icon: <Search size={12} />,     color: "#8b5cf6" },
  get_wiki:     { label: "Read wiki",          icon: <BookOpen size={12} />,   color: "#10b981" },
};

// ── Tool bubble ───────────────────────────────────────────────────────────────

function ToolBubble({
  toolName, args, result, state,
}: {
  toolName: string;
  args: unknown;
  result?: string;
  state: "running" | "done";
}) {
  const [open, setOpen] = useState(true);   // starts expanded
  const prevState = useRef(state);

  // Auto-collapse 1.8s after completing
  useEffect(() => {
    if (prevState.current !== "done" && state === "done") {
      const t = setTimeout(() => setOpen(false), 1800);
      prevState.current = "done";
      return () => clearTimeout(t);
    }
    prevState.current = state;
  }, [state]);

  const meta = TOOL_META[toolName] ?? { label: toolName, icon: <Search size={12} />, color: "#6b7280" };
  const safeArgs = (args && typeof args === "object") ? args as Record<string, unknown> : {};

  // Brief context string
  const hint = safeArgs.path
    ? String(safeArgs.path).split("/").slice(-1)[0]
    : safeArgs.agent_name
    ? String(safeArgs.agent_name)
    : safeArgs.pattern
    ? `"${String(safeArgs.pattern).slice(0, 30)}"`
    : "";

  return (
    <div className="mb-2 rounded-2xl overflow-hidden border border-[#f0f0f0] bg-[#fafafa] text-[12px]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header row — always visible */}
      <button
        className="w-full flex items-center gap-2 px-3.5 py-2 text-left hover:bg-[#f0f0f0] transition-colors"
        onClick={() => setOpen(v => !v)}
      >
        {/* Animated state indicator */}
        {state === "running" ? (
          <Loader2 size={12} className="animate-spin shrink-0" style={{ color: meta.color }} />
        ) : (
          <CheckCircle2 size={12} className="shrink-0 text-[#10b981]" />
        )}

        {/* Icon + label */}
        <span style={{ color: meta.color }} className="shrink-0">{meta.icon}</span>
        <span className="font-medium text-[#3f3f46]">{meta.label}</span>
        {hint && <span className="text-[#9b9b9b] font-mono truncate max-w-[200px]">{hint}</span>}

        {/* State badge */}
        {state === "running" && (
          <span className="ml-auto flex items-center gap-1 text-[10px] text-[#9b9b9b]">
            <Clock size={9} /> running
          </span>
        )}

        {/* Chevron */}
        <ChevronRight
          size={11}
          className={`ml-auto text-[#c4c4c7] transition-transform duration-200 shrink-0 ${open ? "rotate-90" : ""}`}
          style={{ marginLeft: state === "running" ? undefined : "auto" }}
        />
      </button>

      {/* Expandable details */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${open ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="border-t border-[#ebebeb]">
          {/* Args */}
          <div className="px-4 py-2.5">
            <p className="text-[9px] font-semibold text-[#b5b5b5] uppercase tracking-wider mb-1.5">Input</p>
            <pre className="text-[11px] font-mono text-[#52525b] whitespace-pre-wrap overflow-auto max-h-24">
              {JSON.stringify(safeArgs, null, 2)}
            </pre>
          </div>

          {/* Result */}
          {result && (
            <div className="px-4 py-2.5 border-t border-[#f0f0f0]">
              <p className="text-[9px] font-semibold text-[#b5b5b5] uppercase tracking-wider mb-1.5">Output</p>
              <pre className="text-[11px] font-mono text-[#52525b] whitespace-pre-wrap overflow-auto max-h-40">
                {result.length > 2500 ? result.slice(0, 2500) + "\n…(truncated)" : result}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Suggestion chips ──────────────────────────────────────────────────────────

const SUGGESTIONS = [
  { icon: "🔍", text: "opencode 和 cline 架构对比" },
  { icon: "⚙️", text: "aider 的 agent loop 实现" },
  { icon: "🧩", text: "Kun 多智能体协调机制" },
  { icon: "✏️", text: "哪个 prompt 文件最值得修改？" },
];

// ── ChatPanel ─────────────────────────────────────────────────────────────────

export default function ChatPanel({ activeAgents, selectedSources = [], selectedDocs = [] }: Props) {
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
    sendMessage(
      { role: "user", parts: [{ type: "text", text }] },
      { body: { agentContext: activeAgents, selectedSources, selectedDocs } },
    );
    setInputValue("");
    if (inputRef.current) { inputRef.current.style.height = "24px"; }
  }, [inputValue, isLoading, sendMessage, activeAgents, selectedSources, selectedDocs]);

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
      {/* Header */}
      <div className="shrink-0 px-6 py-2.5 border-b border-[#f0f0f0] flex items-center justify-between">
        <span className="text-[13px] font-medium text-[#0d0d0d]">AI Analysis</span>
        <div className="flex items-center gap-1.5">
          {activeAgents.length > 0
            ? activeAgents.map(a => (
                <span key={a} className="text-[11px] text-[#8e8ea0] bg-[#f7f7f7] border border-[#ebebeb] px-2 py-0.5 rounded-full font-mono">{a}</span>
              ))
            : selectedSources.length > 0
            ? <span className="text-[11px] text-[#9b9b9b]">{selectedSources.length} sources selected</span>
            : <span className="text-[11px] text-[#c5c5d2]">DeepSeek V4 Flash</span>}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[680px] px-6 py-6 space-y-6">

          {/* Empty state */}
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
                <div className="flex items-end justify-end gap-2.5">
                  <div className="max-w-[78%] bg-[#f4f4f5] text-[#0d0d0d] rounded-3xl rounded-br-lg px-5 py-3 text-[15px] leading-7 whitespace-pre-wrap" style={{ wordBreak: "break-word" }}>
                    {msg.parts?.map((p, i) => {
                      const tp = p as Record<string, unknown>;
                      return tp.type === "text" && tp.text ? <span key={i}>{String(tp.text)}</span> : null;
                    })}
                  </div>
                  {/* User avatar */}
                  <div className="w-7 h-7 rounded-full bg-[#e4e4e7] flex items-center justify-center shrink-0 text-[11px] font-semibold text-[#52525b]">
                    U
                  </div>
                </div>
              )}

              {/* AI message */}
              {msg.role === "assistant" && (
                <div className="flex items-start gap-2.5">
                  {/* AI avatar — OpenAI logo */}
                  <div className="w-7 h-7 rounded-full bg-[#0d0d0d] flex items-center justify-center shrink-0 mt-0.5">
                    <OpenAILogo size={15} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                  {msg.parts?.map((p, i) => {
                    const tp = p as Record<string, unknown>;

                    // ── Tool bubble ─────────────────────────────────────
                    if (tp.type && (String(tp.type).startsWith("tool-") || tp.type === "dynamic-tool")) {
                      if (!tp.toolName) return null;
                      const hasResult = tp.output != null;
                      return (
                        <ToolBubble
                          key={i}
                          toolName={String(tp.toolName)}
                          args={tp.input ?? {}}
                          result={hasResult ? String(tp.output) : undefined}
                          state={hasResult ? "done" : "running"}
                        />
                      );
                    }

                    // ── Text (markstream-react) ──────────────────────────
                    if (tp.type === "text" && tp.text) {
                      const text = String(tp.text);
                      const isFinal = status !== "streaming";
                      return (
                        <div key={i} className="markstream-chat-content">
                          <MarkdownRender
                            content={text}
                            final={isFinal}
                          />
                        </div>
                      );
                    }
                    return null;
                  })}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Typing dots */}
          {isLoading && (
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-[#0d0d0d] flex items-center justify-center shrink-0">
                <OpenAILogo size={15} className="text-white" />
              </div>
              <div className="flex items-center gap-1 h-7">
                {[0, 1, 2].map(i => (
                  <div key={i} className="w-2 h-2 bg-[#d4d4d8] rounded-full animate-bounce"
                    style={{ animationDelay: `${i * 0.12}s`, animationDuration: "0.9s" }} />
                ))}
              </div>
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

      {/* Input */}
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
