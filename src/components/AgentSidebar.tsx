"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink } from "lucide-react";

export interface AgentMeta {
  name: string;
  category: string;
  description: string;
  url?: string;
  dir: string;
  wikiPath: string;
}

interface Props {
  agents: AgentMeta[];
  /** The primary selected agent (pane A) */
  selected: string;
  /** The compare agent (pane B) */
  compared?: string;
  onSelect: (name: string) => void;
  onCompare: (name: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  agent: "Single Agents",
  collaboration: "Multi-Agent",
};

export default function AgentSidebar({ agents, selected, compared, onSelect, onCompare }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [hoveredCompare, setHoveredCompare] = useState<string | null>(null);

  const groups = agents.reduce<Record<string, AgentMeta[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  return (
    <aside
      className="flex flex-col h-full border-r border-[#e5e5e5] bg-[#f7f7f8] overflow-hidden select-none"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#ebebeb]">
        <h2 className="text-[11px] font-semibold text-[#6b6b6b] uppercase tracking-widest">
          Agent Explorer
        </h2>
        <p className="text-[11px] text-[#9b9b9b] mt-0.5">
          {agents.length} repos · ⌘-click to compare
        </p>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto py-2">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="mb-1">
            {/* Category header */}
            <button
              className="w-full flex items-center gap-1.5 px-4 py-1.5 text-left hover:bg-[#efefef] transition-colors"
              onClick={() => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))}
            >
              <ChevronRight
                size={11}
                className={`text-[#9b9b9b] transition-transform duration-150 shrink-0 ${collapsed[cat] ? "" : "rotate-90"}`}
              />
              <span className="text-[11px] font-semibold text-[#6b6b6b] uppercase tracking-wider">
                {CATEGORY_LABELS[cat] ?? cat}
              </span>
              <span className="ml-auto text-[10px] text-[#b5b5b5]">{items.length}</span>
            </button>

            {/* Agent items */}
            {!collapsed[cat] && items.map(agent => {
              const isSelected = selected === agent.name;
              const isCompared = compared === agent.name;

              return (
                <div
                  key={agent.name}
                  className={`group mx-2 mb-0.5 rounded-xl px-3 py-2 cursor-pointer transition-all duration-150 relative ${
                    isSelected
                      ? "bg-white shadow-sm border border-[#e5e5e5]"
                      : isCompared
                      ? "bg-[#eef4ff] border border-[#c7d8f8]"
                      : "hover:bg-[#efefef] border border-transparent"
                  }`}
                  onClick={e => {
                    if (e.metaKey || e.ctrlKey) onCompare(agent.name);
                    else onSelect(agent.name);
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    {/* Color dot + name */}
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isSelected ? "bg-[#0d0d0d]" : isCompared ? "bg-[#2563eb]" : "bg-[#d4d4d8]"}`} />
                      <span className={`text-[13px] font-medium truncate ${isSelected ? "text-[#0d0d0d]" : isCompared ? "text-[#1d4ed8]" : "text-[#3f3f46]"}`}>
                        {agent.name}
                      </span>
                    </div>

                    {/* Compare indicator + external link */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isSelected && <span className="text-[9px] font-bold text-[#6b6b6b] bg-[#f4f4f5] px-1 rounded">A</span>}
                      {isCompared && <span className="text-[9px] font-bold text-[#2563eb] bg-[#eff6ff] px-1 rounded">B</span>}
                      <button
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-[#9b9b9b] hover:text-[#3f3f46]"
                        onClick={e => { e.stopPropagation(); if (agent.url) window.open(agent.url, "_blank"); }}
                        title="Open on GitHub"
                      >
                        <ExternalLink size={11} />
                      </button>
                    </div>
                  </div>

                  {/* Description — visible only when selected or hovered */}
                  <p className={`text-[11px] leading-snug mt-1 ml-4 truncate transition-colors ${
                    isSelected ? "text-[#6b6b6b]" : "text-[#9b9b9b] opacity-0 group-hover:opacity-100"
                  }`}>
                    {agent.description}
                  </p>

                  {/* Compare hint on hover (not selected, not compared) */}
                  {!isSelected && !isCompared && hoveredCompare === agent.name && (
                    <p className="text-[10px] text-[#9b9b9b] ml-4 mt-0.5">⌘-click to compare</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Footer: active selection summary */}
      {(selected || compared) && (
        <div className="px-4 py-2.5 border-t border-[#ebebeb] text-[11px]">
          {selected && (
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#0d0d0d]" />
              <span className="text-[#3f3f46] font-medium">{selected}</span>
              <span className="text-[#9b9b9b]">active</span>
              <button onClick={() => onSelect("")} className="ml-auto text-[#9b9b9b] hover:text-[#3f3f46]">✕</button>
            </div>
          )}
          {compared && (
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 rounded-full bg-[#2563eb]" />
              <span className="text-[#1d4ed8] font-medium">{compared}</span>
              <span className="text-[#9b9b9b]">compare</span>
              <button onClick={() => onCompare("")} className="ml-auto text-[#9b9b9b] hover:text-[#3f3f46]">✕</button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
}
