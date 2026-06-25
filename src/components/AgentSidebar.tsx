"use client";

import { useState } from "react";
import { ChevronRight, ExternalLink, Code2, Users } from "lucide-react";

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
  selected: string[];
  onSelect: (name: string) => void;
  onCompare: (name: string) => void;
}

const CATEGORY_LABELS: Record<string, string> = {
  agent: "Single Agent",
  collaboration: "Multi-Agent",
  "frontend-render": "Frontend Tools",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  agent: <Code2 size={13} />,
  collaboration: <Users size={13} />,
};

export default function AgentSidebar({ agents, selected, onSelect, onCompare }: Props) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const groups = agents.reduce<Record<string, AgentMeta[]>>((acc, a) => {
    (acc[a.category] ??= []).push(a);
    return acc;
  }, {});

  const toggleCat = (cat: string) =>
    setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }));

  return (
    <aside className="w-64 min-w-[200px] max-w-xs bg-[#0d1117] border-r border-[#21262d] flex flex-col h-full text-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-[#21262d]">
        <h2 className="font-semibold text-gray-200 text-xs uppercase tracking-widest">Agent Explorer</h2>
        <p className="text-gray-500 text-[10px] mt-0.5">{agents.length} repos · click to open · ⌘-click to compare</p>
      </div>

      <div className="flex-1 overflow-y-auto py-2">
        {Object.entries(groups).map(([cat, items]) => (
          <div key={cat} className="mb-1">
            {/* Category header */}
            <button
              className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-200 transition-colors"
              onClick={() => toggleCat(cat)}
            >
              <ChevronRight
                size={12}
                className={`transition-transform ${collapsed[cat] ? "" : "rotate-90"}`}
              />
              <span>{CATEGORY_ICONS[cat]}</span>
              <span>{CATEGORY_LABELS[cat] ?? cat}</span>
              <span className="ml-auto bg-[#21262d] text-gray-400 text-[10px] rounded px-1">{items.length}</span>
            </button>

            {/* Agent items */}
            {!collapsed[cat] && items.map((agent) => {
              const isSelected = selected[0] === agent.name;
              const isCompare = selected[1] === agent.name;
              return (
                <div
                  key={agent.name}
                  className={`group mx-2 mb-0.5 rounded-md px-2 py-1.5 cursor-pointer transition-all
                    ${isSelected ? "bg-[#1f6feb33] border border-[#1f6feb66]" : isCompare ? "bg-[#388bfd22] border border-[#388bfd44]" : "border border-transparent hover:bg-[#161b22]"}`}
                  onClick={(e) => e.metaKey || e.ctrlKey ? onCompare(agent.name) : onSelect(agent.name)}
                  title={`${agent.description}\n⌘-click to open in compare panel`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className={`font-mono text-[12px] truncate ${isSelected ? "text-[#58a6ff]" : isCompare ? "text-[#79c0ff]" : "text-gray-300"}`}>
                      {agent.name}
                    </span>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {isSelected && <span className="text-[9px] text-[#58a6ff] font-bold">A</span>}
                      {isCompare && <span className="text-[9px] text-[#79c0ff] font-bold">B</span>}
                      {agent.url && (
                        <a href={agent.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                          <ExternalLink size={10} className="text-gray-500 hover:text-gray-300" />
                        </a>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-500 text-[10px] mt-0.5 truncate leading-tight">{agent.description}</p>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="px-3 py-2 border-t border-[#21262d] text-[10px] text-gray-500">
          {selected[0] && <span className="text-[#58a6ff]">A: {selected[0]}</span>}
          {selected[1] && <> · <span className="text-[#79c0ff]">B: {selected[1]}</span></>}
          {selected.length > 0 && (
            <button
              className="ml-2 text-gray-600 hover:text-gray-400"
              onClick={() => { onSelect(""); onCompare(""); }}
            >clear</button>
          )}
        </div>
      )}
    </aside>
  );
}
