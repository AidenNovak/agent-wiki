"use client";

import { useMemo, useRef, useEffect } from "react";
import { diffLines, diffStats, DiffLine } from "@/lib/diff";

interface Props {
  original: string;
  modified: string;
  onChange: (v: string) => void;
  lang?: string;
  readOnly?: boolean;
}

// ── Colour palette ────────────────────────────────────────────────────────────
const LINE_BG: Record<DiffLine["kind"], string> = {
  equal: "",
  insert: "bg-[#1b3a2a]",
  delete: "bg-[#3a1b1b]",
};
const LINE_GUTTER: Record<DiffLine["kind"], string> = {
  equal: "text-[#484f58]",
  insert: "text-[#56d364]",
  delete: "text-[#f85149]",
};
const LINE_SYMBOL: Record<DiffLine["kind"], string> = {
  equal: " ",
  insert: "+",
  delete: "−",
};

// ── Render one pane (original = deletions + equals, modified = insertions + equals)
function Pane({
  lines,
  side,
  className = "",
}: {
  lines: DiffLine[];
  side: "orig" | "mod";
  className?: string;
}) {
  const visible = lines.filter((l) =>
    side === "orig" ? l.kind !== "insert" : l.kind !== "delete"
  );

  return (
    <div className={`font-mono text-[12px] leading-5 overflow-auto ${className}`}>
      <table className="w-full border-separate border-spacing-0">
        <tbody>
          {visible.map((line, i) => {
            const num = side === "orig" ? line.origLine : line.modLine;
            return (
              <tr key={i} className={LINE_BG[line.kind]}>
                {/* gutter: line number */}
                <td className={`select-none w-10 pr-2 text-right text-[11px] sticky left-0 bg-[#010409] border-r border-[#21262d] ${LINE_GUTTER[line.kind]}`}>
                  {num ?? ""}
                </td>
                {/* diff symbol */}
                <td className={`select-none w-5 text-center text-[11px] ${LINE_GUTTER[line.kind]}`}>
                  {LINE_SYMBOL[line.kind]}
                </td>
                {/* content */}
                <td className={`pl-2 pr-4 whitespace-pre ${line.kind === "equal" ? "text-gray-300" : line.kind === "insert" ? "text-[#aff3c0]" : "text-[#ffbab8]"}`}>
                  {line.text}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Main SplitEditor ──────────────────────────────────────────────────────────
export default function SplitEditor({ original, modified, onChange }: Props) {
  const diffResult = useMemo(() => diffLines(original, modified), [original, modified]);
  const stats = useMemo(() => diffStats(diffResult), [diffResult]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [modified]);

  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#010409] border-b border-[#21262d] shrink-0 text-[11px]">
        {hasChanges ? (
          <>
            <span className="text-[#56d364] font-mono">+{stats.added}</span>
            <span className="text-[#f85149] font-mono">−{stats.removed}</span>
            <span className="text-gray-600">lines changed</span>
          </>
        ) : (
          <span className="text-gray-600">No changes</span>
        )}
      </div>

      {/* Two-pane diff */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: original read-only diff view */}
        <div className="w-1/2 flex flex-col border-r border-[#30363d] overflow-hidden">
          <div className="px-3 py-1 bg-[#0d1117] border-b border-[#21262d] text-[10px] font-semibold text-gray-500 uppercase tracking-wider shrink-0">
            Original
          </div>
          <Pane lines={diffResult} side="orig" className="flex-1" />
        </div>

        {/* RIGHT: editable textarea overlaid with diff rendering */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-3 py-1 bg-[#0d1117] border-b border-[#21262d] text-[10px] font-semibold text-[#56d364] uppercase tracking-wider shrink-0">
            Modified <span className="text-gray-600 normal-case">(editable)</span>
          </div>
          <div className="relative flex-1 overflow-hidden">
            {/* Diff colour layer (pointer-events-none, behind textarea) */}
            <div className="absolute inset-0 overflow-auto pointer-events-none">
              <Pane lines={diffResult} side="mod" />
            </div>
            {/* Actual textarea – transparent so diff shows through */}
            <textarea
              ref={textareaRef}
              className="absolute inset-0 w-full h-full resize-none bg-transparent text-transparent caret-white font-mono text-[12px] leading-5 pl-[3.75rem] pr-4 pt-0 pb-0 focus:outline-none overflow-auto z-10"
              spellCheck={false}
              value={modified}
              onChange={(e) => onChange(e.target.value)}
              style={{ caretColor: "#58a6ff" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
