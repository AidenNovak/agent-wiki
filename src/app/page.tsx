"use client";

import { useState, useEffect } from "react";
import { MessageSquare, FolderOpen } from "lucide-react";
import ChatPanel from "@/components/ChatPanel";
import KnowledgePanel from "@/components/KnowledgePanel";
import ProjectBrowser from "@/components/ProjectBrowser";
import ServiceStatus from "@/components/ServiceStatus";
import type { AgentMeta } from "@/components/AgentSidebar";

type View = "chat" | "projects";

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export default function Home() {
  const [view, setView] = useState<View>("chat");
  const [agents, setAgents] = useState<AgentMeta[]>([]);

  // Knowledge selection state
  const [selectedRepos, setSelectedRepos] = useState<Set<string>>(new Set());
  const [selectedDocs, setSelectedDocs] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/agents")
      .then(r => r.json())
      .then((data: AgentMeta[]) => {
        setAgents(data);
        // Default: select all repos
        setSelectedRepos(new Set(data.map((a: AgentMeta) => a.name)));
      })
      .catch(console.error);
  }, []);

  const toggleRepo = (name: string) => {
    setSelectedRepos(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleDoc = (id: string) => {
    setSelectedDocs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden" style={{ fontFamily: FONT }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="h-11 border-b border-[#e5e5e5] flex items-center px-4 shrink-0 z-10 bg-white">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mr-6">
          <div className="w-6 h-6 bg-[#0d0d0d] rounded-lg flex items-center justify-center shrink-0">
            <span className="text-white text-[10px] font-bold">A</span>
          </div>
          <span className="text-[14px] font-semibold text-[#0d0d0d]">Agent Explorer</span>
        </div>

        {/* Navigation */}
        <nav className="flex items-center gap-0.5">
          <NavBtn
            icon={<MessageSquare size={13} />}
            label="Chat"
            active={view === "chat"}
            onClick={() => setView("chat")}
          />
          <NavBtn
            icon={<FolderOpen size={13} />}
            label="Projects"
            active={view === "projects"}
            onClick={() => setView("projects")}
          />
        </nav>

        {/* Status */}
        <div className="ml-auto">
          <ServiceStatus />
        </div>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-hidden">
        {view === "chat" ? (
          /* ── Chat View ─────────────────────────────────────────────────── */
          <div className="h-full flex overflow-hidden">
            {/* Left: knowledge selector */}
            <div className="w-52 shrink-0 overflow-hidden">
              <KnowledgePanel
                selected={selectedRepos}
                onToggleRepo={toggleRepo}
                onSelectAll={() => setSelectedRepos(new Set(agents.map(a => a.name)))}
                onSelectNone={() => setSelectedRepos(new Set())}
                selectedDocs={selectedDocs}
                onToggleDoc={toggleDoc}
              />
            </div>

            {/* Main: chat */}
            <div className="flex-1 overflow-hidden">
              <ChatPanel
                activeAgents={[]}
                selectedSources={Array.from(selectedRepos)}
                selectedDocs={Array.from(selectedDocs)}
              />
            </div>
          </div>
        ) : (
          /* ── Projects View ─────────────────────────────────────────────── */
          <ProjectBrowser agents={agents} />
        )}
      </div>
    </div>
  );
}

function NavBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[13px] font-medium transition-all duration-150 ${
        active
          ? "bg-[#0d0d0d] text-white"
          : "text-[#6b6b6b] hover:text-[#0d0d0d] hover:bg-[#f4f4f5]"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}
