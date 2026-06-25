"use client";

import { useState, useEffect } from "react";
import { Loader2, Copy, Check, X, Pencil, Eye } from "lucide-react";
import ShikiCode from "./ShikiCode";
import SplitEditor from "./SplitEditor";
import WorktreeBar from "./WorktreeBar";

interface Props {
  filePath: string | null;
  fileName: string | null;
  agentName?: string;
  agentDir?: string;
  agentRootDir?: string;
  accentColor?: string;
  onClose?: () => void;
}

const EXT_TO_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  mjs: "javascript", cjs: "javascript",
  py: "python", pyi: "python", go: "go", rs: "rust",
  rb: "ruby", java: "java", kt: "kotlin",
  sh: "bash", bash: "bash", zsh: "bash",
  md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
  toml: "toml", css: "css", scss: "scss", html: "html",
  xml: "xml", c: "c", cpp: "cpp", cc: "cpp", h: "c", hpp: "cpp",
  txt: "text",
};

function getLang(name: string | null): string {
  if (!name) return "text";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_LANG[ext] ?? (ext || "text");
}

function lineCount(s: string) { return s.split("\n").length; }
function fmtLines(n: number) { return n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n); }

export default function CodePane({
  filePath, fileName, agentName, agentDir, agentRootDir,
  accentColor = "#0d0d0d", onClose,
}: Props) {
  const [content, setContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [modified, setModified] = useState("");

  useEffect(() => {
    if (!filePath) { setContent(null); setEditMode(false); return; }
    setLoading(true); setContent(null); setEditMode(false);
    fetch(`/api/fs?action=read&path=${encodeURIComponent(filePath)}`)
      .then(r => r.json())
      .then(d => { const t = d.content ?? d.error ?? ""; setContent(t); setModified(t); })
      .catch(e => { setContent(String(e)); setModified(String(e)); })
      .finally(() => setLoading(false));
  }, [filePath]);

  const copy = async () => {
    if (!content) return;
    await navigator.clipboard.writeText(editMode ? modified : content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const lang = getLang(fileName);
  const lines = content ? lineCount(content) : 0;

  const relPath = filePath && agentRootDir
    ? filePath.replace(agentRootDir + "/", "")
    : fileName ?? "";

  if (!filePath) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#fafafa] text-center select-none px-8">
        <div className="text-4xl mb-4">📂</div>
        <p className="text-[14px] font-medium text-[#3f3f46]">Select a file to view</p>
        <p className="text-[12px] text-[#9b9b9b] mt-1">
          Click any file in the tree · Press ✏️ Edit to enter Prompt Lab
        </p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-[#0d1117]">
      {/* ── Tab bar (white) ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-[#e5e5e5] shrink-0"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {/* File name + lang badge */}
        <span className="text-[12px] text-[#9b9b9b] font-mono shrink-0">
          {agentName && `${agentName}/`}
        </span>
        <span className="text-[13px] font-medium text-[#0d0d0d] truncate">{fileName}</span>
        <span className="text-[10px] text-[#9b9b9b] bg-[#f4f4f5] border border-[#e4e4e7] px-1.5 py-0.5 rounded-md shrink-0">
          {lang}
        </span>
        {content && (
          <span className="text-[10px] text-[#b5b5b5] shrink-0">{fmtLines(lines)} lines</span>
        )}

        {/* Edit / View toggle */}
        {content && !loading && (
          <button
            onClick={() => setEditMode(v => !v)}
            className={`ml-1 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-all duration-150 shrink-0 ${
              editMode
                ? "text-[#7c3aed] border-[#ddd6fe] bg-[#f5f3ff]"
                : "text-[#6b6b6b] border-[#e4e4e7] hover:border-[#c4c4c7] hover:text-[#3f3f46]"
            }`}
            title={editMode ? "Back to view" : "Edit as prompt (live diff)"}
          >
            {editMode ? <Eye size={11} /> : <Pencil size={11} />}
            <span>{editMode ? "View" : "Edit"}</span>
          </button>
        )}

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button onClick={copy} className="text-[#9b9b9b] hover:text-[#3f3f46] transition-colors" title="Copy">
            {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="text-[#9b9b9b] hover:text-[#3f3f46] transition-colors">
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────── */}
      {loading && (
        <div className="flex-1 flex items-center justify-center bg-[#0d1117]">
          <Loader2 size={18} className="animate-spin text-[#484f58]" />
        </div>
      )}

      {!loading && content !== null && (
        <>
          {editMode ? (
            <div className="flex-1 overflow-hidden">
              <SplitEditor original={content} modified={modified} onChange={setModified} />
            </div>
          ) : (
            <div className="flex-1 overflow-auto bg-[#0d1117]">
              <ShikiCode
                code={lines > 5000
                  ? content.split("\n").slice(0, 5000).join("\n") + "\n…(truncated)"
                  : content}
                lang={lang}
                className={[
                  "min-h-full [&_.shiki]:bg-transparent [&_pre]:!bg-[#0d1117]",
                  "[&_pre]:p-0 [&_pre]:m-0 [&_code]:block [&_code]:pl-[3.5rem]",
                  "[&_.line]:relative [&_.line]:min-h-[1.25rem] [&_.line]:leading-5",
                  "[&_.line]:before:content-[attr(data-line)] [&_.line]:before:absolute",
                  "[&_.line]:before:left-0 [&_.line]:before:w-[2.75rem]",
                  "[&_.line]:before:text-right [&_.line]:before:pr-4",
                  "[&_.line]:before:text-[#484f58] [&_.line]:before:text-[11px]",
                  "[&_.line]:before:font-mono [&_.line]:before:select-none",
                  "[&_pre]:overflow-x-auto [&_pre]:min-w-max",
                  "[&_code]:text-[12.5px] [&_code]:font-mono",
                ].join(" ")}
              />
            </div>
          )}

          {editMode && agentName && agentDir && (
            <WorktreeBar
              agentName={agentName} agentDir={agentDir}
              selectedFileRel={relPath}
              modifiedContent={modified} originalContent={content}
              onDiscard={() => { setModified(content); setEditMode(false); }}
            />
          )}
        </>
      )}
    </div>
  );
}
