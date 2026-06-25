"use client";

import { useState, useEffect } from "react";
import { Loader2, Copy, Check, X } from "lucide-react";
import ShikiCode from "./ShikiCode";

interface Props {
  filePath: string | null;
  fileName: string | null;
  agentName?: string;
  accentColor?: string;
  onClose?: () => void;
}

const EXT_TO_LANG: Record<string, string> = {
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
  txt: "text",
};

function getLang(name: string | null): string {
  if (!name) return "text";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? (ext || "text");
}

function formatLineCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}k lines` : `${n} lines`;
}

export default function CodePane({
  filePath, fileName, agentName, accentColor = "#58a6ff", onClose,
}: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!filePath) { setContent(null); return; }
    setLoading(true);
    setContent(null);
    fetch(`/api/fs?action=read&path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => setContent(d.content ?? d.error ?? ""))
      .catch((e) => setContent(String(e)))
      .finally(() => setLoading(false));
  }, [filePath]);

  const copy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lang = getLang(fileName);
  const lineCount = content ? content.split("\n").length : 0;

  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-600 bg-[#0d1117] select-none">
        <div className="text-5xl mb-4">📂</div>
        <p className="text-sm">Click a file to view it</p>
        <p className="text-xs mt-1 text-gray-700">or ask the AI to explore the code</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#21262d] bg-[#010409] shrink-0">
        <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: accentColor }} />
        <span className="text-[11px] text-gray-500 font-mono truncate">
          {agentName && `${agentName}/`}{fileName}
        </span>
        <span className="text-[10px] text-gray-600 bg-[#21262d] px-1.5 rounded shrink-0">{lang}</span>
        {content && (
          <span className="text-[10px] text-gray-700 shrink-0">{formatLineCount(lineCount)}</span>
        )}
        <div className="ml-auto flex items-center gap-2 shrink-0">
          <button onClick={copy} className="text-gray-500 hover:text-gray-300 transition-colors" title="Copy">
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="text-gray-500 hover:text-gray-300">
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 size={20} className="animate-spin text-gray-500" />
        </div>
      )}

      {!loading && content !== null && (
        <div className="flex-1 overflow-auto">
          {/*
            Shiki renders a <pre> with per-token spans. We overlay a
            gutter column via a CSS grid trick on .shiki-wrapper.
            For very large files (>5000 lines) we cap at 5000 to keep UI snappy.
          */}
          <ShikiCode
            code={lineCount > 5000 ? content.split("\n").slice(0, 5000).join("\n") + "\n…(truncated at 5000 lines)" : content}
            lang={lang}
            className={[
              "min-h-full",
              // Override shiki defaults to match our theme
              "[&_.shiki]:bg-transparent [&_.shiki]:m-0",
              "[&_pre]:!bg-[#0d1117] [&_pre]:p-0 [&_pre]:m-0",
              // Counter-column
              "[&_code]:block [&_code]:pl-[3.5rem]",
              "[&_.line]:relative [&_.line]:min-h-[1.25rem] [&_.line]:leading-5",
              "[&_.line]:before:content-[attr(data-line)]",
              "[&_.line]:before:absolute [&_.line]:before:left-0 [&_.line]:before:w-[2.75rem]",
              "[&_.line]:before:text-right [&_.line]:before:pr-4",
              "[&_.line]:before:text-[#484f58] [&_.line]:before:text-[11px]",
              "[&_.line]:before:font-mono [&_.line]:before:select-none",
              "[&_.line]:hover:before:text-[#8b949e]",
              // Horizontal scroll within lines
              "[&_pre]:overflow-x-auto [&_pre]:min-w-max",
              // Font
              "[&_code]:text-[12px] [&_code]:font-mono",
            ].join(" ")}
          />
          {lineCount > 5000 && (
            <div className="px-4 py-2 text-[11px] text-amber-400 border-t border-[#21262d]">
              File truncated — showing first 5000 lines of {formatLineCount(lineCount)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
