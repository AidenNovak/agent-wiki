"use client";

import { useMemo, useRef, useEffect } from "react";
import { diffLines, diffStats, DiffLine } from "@/lib/diff";

interface Props {
  original: string;
  modified: string;
  onChange: (v: string) => void;
}

// ── Colour tokens (GitHub PR diff style, light) ────────────────────────────

const ROW_STYLE: Record<DiffLine["kind"], string> = {
  equal:  "",
  insert: "bg-[#d1fae5]",      // light green
  delete: "bg-[#fee2e2]",      // light red / pink
};

const NUM_STYLE: Record<DiffLine["kind"], string> = {
  equal:  "text-[#9b9b9b]",
  insert: "text-[#059669] font-medium",
  delete: "text-[#dc2626] font-medium",
};

const TEXT_STYLE: Record<DiffLine["kind"], string> = {
  equal:  "text-[#0d0d0d]",
  insert: "text-[#065f46] font-[450]",
  delete: "text-[#991b1b] font-[450] line-through decoration-[#dc2626]/40",
};

const SYMBOL: Record<DiffLine["kind"], string> = {
  equal:  " ",
  insert: "+",
  delete: "−",
};

const SYMBOL_COLOR: Record<DiffLine["kind"], string> = {
  equal:  "text-transparent",
  insert: "text-[#059669] font-bold",
  delete: "text-[#dc2626] font-bold",
};

// ── One pane (read-only diff view) ────────────────────────────────────────────

function Pane({
  lines,
  side,
  className = "",
}: {
  lines: DiffLine[];
  side: "orig" | "mod";
  className?: string;
}) {
  const visible = lines.filter(l =>
    side === "orig" ? l.kind !== "insert" : l.kind !== "delete"
  );

  return (
    <div className={`overflow-auto bg-white ${className}`}>
      <table className="w-full border-separate border-spacing-0 min-w-max">
        <tbody>
          {visible.map((line, i) => {
            const num = side === "orig" ? line.origLine : line.modLine;
            return (
              <tr key={i} className={`${ROW_STYLE[line.kind]} hover:brightness-[0.97] transition-all`}>
                {/* Line number */}
                <td className={`select-none text-right pr-3 pl-4 text-[11px] font-mono w-10 min-w-[2.5rem] border-r border-[#e5e5e5] sticky left-0 bg-[#fafafa] ${NUM_STYLE[line.kind]}`}>
                  {num ?? ""}
                </td>
                {/* Diff symbol */}
                <td className={`select-none text-center w-5 text-[12px] font-mono ${SYMBOL_COLOR[line.kind]}`}>
                  {SYMBOL[line.kind]}
                </td>
                {/* Content */}
                <td className={`pl-3 pr-6 text-[13px] font-mono leading-[1.6] whitespace-pre ${TEXT_STYLE[line.kind]}`}>
                  {line.text || " "}
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
  const diff = useMemo(() => diffLines(original, modified), [original, modified]);
  const stats = useMemo(() => diffStats(diff), [diff]);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep textarea height in sync with content
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 400)}px`;
  }, [modified]);

  const hasChanges = stats.added > 0 || stats.removed > 0;

  return (
    <div className="flex flex-col h-full overflow-hidden bg-white"
      style={{ fontFamily: '"JetBrains Mono", "Fira Code", ui-monospace, monospace' }}>

      {/* Stats bar */}
      <div className="flex items-center gap-3 px-4 py-1.5 bg-[#fafafa] border-b border-[#e5e5e5] shrink-0"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
        {hasChanges ? (
          <>
            <span className="text-[12px] text-[#059669] font-semibold">+{stats.added}</span>
            <span className="text-[12px] text-[#dc2626] font-semibold">−{stats.removed}</span>
            <span className="text-[11px] text-[#9b9b9b]">lines changed</span>
          </>
        ) : (
          <span className="text-[11px] text-[#9b9b9b]">No changes</span>
        )}
      </div>

      {/* Two-pane layout */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — original (read-only rendered diff) */}
        <div className="w-1/2 flex flex-col border-r border-[#e5e5e5] overflow-hidden">
          <div className="px-4 py-1 bg-[#fafafa] border-b border-[#e5e5e5] shrink-0"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <span className="text-[10px] font-semibold text-[#6b6b6b] uppercase tracking-wider">Original</span>
          </div>
          <Pane lines={diff} side="orig" className="flex-1" />
        </div>

        {/* RIGHT — editable (textarea overlays the diff rendering) */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-4 py-1 bg-[#f0fdf4] border-b border-[#bbf7d0] shrink-0"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <span className="text-[10px] font-semibold text-[#059669] uppercase tracking-wider">
              Modified <span className="normal-case font-normal text-[#9b9b9b] ml-1">— editable</span>
            </span>
          </div>

          <div className="relative flex-1 overflow-hidden">
            {/* Diff colour layer — behind the textarea */}
            <div className="absolute inset-0 overflow-auto pointer-events-none">
              <Pane lines={diff} side="mod" />
            </div>
            {/* Editable textarea — transparent so diff shows through */}
            <textarea
              ref={taRef}
              value={modified}
              onChange={e => onChange(e.target.value)}
              spellCheck={false}
              className="absolute inset-0 w-full resize-none bg-transparent text-transparent caret-[#0d0d0d] font-mono text-[13px] leading-[1.6] pl-[3.75rem] pr-4 pt-0 pb-0 focus:outline-none overflow-auto z-10 min-h-full"
              style={{ caretColor: "#0d0d0d" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
