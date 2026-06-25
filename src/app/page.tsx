"use client";

import { useState, useEffect, useCallback } from "react";
import AgentSidebar, { AgentMeta } from "@/components/AgentSidebar";
import FileTree from "@/components/FileTree";
import CodePane from "@/components/CodePane";
import ChatPanel from "@/components/ChatPanel";
import ServiceStatus from "@/components/ServiceStatus";
import { PanelLeft, Columns2, MessageSquare, ChevronDown } from "lucide-react";

interface PaneState {
  agentName: string;
  dir: string;
  selectedFile: string | null;
  selectedFileName: string | null;
}

const emptyPane = (): PaneState => ({ agentName: "", dir: "", selectedFile: null, selectedFileName: null });

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

export default function Home() {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [paneA, setPaneA] = useState<PaneState>(emptyPane());
  const [paneB, setPaneB] = useState<PaneState>(emptyPane());
  const [chatOpen, setChatOpen] = useState(true);
  const [chatHeight, setChatHeight] = useState(280);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetch("/api/agents").then(r => r.json()).then(setAgents).catch(console.error);
  }, []);

  const selectAgent = useCallback((name: string) => {
    if (!name) { setPaneA(emptyPane()); return; }
    const a = agents.find(a => a.name === name);
    if (a) setPaneA({ agentName: name, dir: a.dir, selectedFile: null, selectedFileName: null });
  }, [agents]);

  const compareAgent = useCallback((name: string) => {
    if (!name) { setPaneB(emptyPane()); return; }
    const a = agents.find(a => a.name === name);
    if (a) setPaneB({ agentName: name, dir: a.dir, selectedFile: null, selectedFileName: null });
  }, [agents]);

  const hasBPane = Boolean(paneB.agentName);
  const activeAgents = [paneA.agentName, paneB.agentName].filter(Boolean);

  // Chat drag resize
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY, startH = chatHeight;
    const move = (ev: MouseEvent) => setChatHeight(Math.max(160, Math.min(560, startH + startY - ev.clientY)));
    const up = () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [chatHeight]);

  return (
    <div className="h-screen flex flex-col bg-white overflow-hidden" style={{ fontFamily: FONT }}>

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="h-11 border-b border-[#e5e5e5] bg-white flex items-center px-4 gap-3 shrink-0 z-10">
        {/* Logo + title */}
        <div className="flex items-center gap-2.5 mr-3">
          <div className="w-6 h-6 bg-[#0d0d0d] rounded-lg flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">A</span>
          </div>
          <span className="text-[14px] font-semibold text-[#0d0d0d]">Agent Explorer</span>
        </div>

        {/* Current selection breadcrumb */}
        {paneA.agentName && (
          <div className="flex items-center gap-1.5 text-[12px] text-[#9b9b9b] min-w-0">
            <span className="text-[#3f3f46] font-medium">{paneA.agentName}</span>
            {paneA.selectedFileName && (
              <>
                <span>/</span>
                <span className="truncate text-[#6b6b6b]">{paneA.selectedFileName}</span>
              </>
            )}
            {paneB.agentName && (
              <>
                <span className="mx-1 text-[#d4d4d8]">↔</span>
                <span className="text-[#2563eb] font-medium">{paneB.agentName}</span>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 ml-auto">
          <HeaderBtn
            icon={<PanelLeft size={14} />} label="Sidebar"
            active={sidebarOpen} onClick={() => setSidebarOpen(v => !v)}
          />
          {hasBPane && (
            <HeaderBtn
              icon={<Columns2 size={14} />} label="Compare"
              active onClick={() => setPaneB(emptyPane())}
            />
          )}
          <HeaderBtn
            icon={<MessageSquare size={14} />} label="Chat"
            active={chatOpen} onClick={() => setChatOpen(v => !v)}
          />
          <div className="h-4 w-px bg-[#e5e5e5] mx-1.5" />
          <ServiceStatus />
        </div>
      </header>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        {sidebarOpen && (
          <div className="w-56 shrink-0 overflow-hidden">
            <AgentSidebar
              agents={agents}
              selected={paneA.agentName}
              compared={paneB.agentName}
              onSelect={selectAgent}
              onCompare={compareAgent}
            />
          </div>
        )}

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* Code panes */}
          <div className="flex-1 flex overflow-hidden">
            {!paneA.agentName ? (
              <WelcomeView onSidebarOpen={() => setSidebarOpen(true)} hasAgents={agents.length > 0} />
            ) : (
              <>
                {/* Pane A */}
                <div className={`flex flex-col overflow-hidden border-r border-[#e5e5e5] ${hasBPane ? "w-1/2" : "flex-1"}`}>
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-48 shrink-0 overflow-hidden">
                      <FileTree
                        rootDir={paneA.dir}
                        agentName={paneA.agentName}
                        onFileSelect={(path, name) => setPaneA(p => ({ ...p, selectedFile: path, selectedFileName: name }))}
                        selectedFile={paneA.selectedFile ?? undefined}
                      />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <CodePane
                        filePath={paneA.selectedFile}
                        fileName={paneA.selectedFileName}
                        agentName={paneA.agentName}
                        agentDir={paneA.dir}
                        agentRootDir={paneA.dir}
                        onClose={() => setPaneA(p => ({ ...p, selectedFile: null, selectedFileName: null }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Pane B */}
                {hasBPane && (
                  <div className="flex flex-col overflow-hidden w-1/2">
                    <div className="flex items-center px-4 py-1.5 bg-[#eff6ff] border-b border-[#dbeafe] shrink-0">
                      <div className="w-2 h-2 rounded-full bg-[#2563eb] shrink-0 mr-2" />
                      <span className="text-[12px] font-medium text-[#1d4ed8]">{paneB.agentName}</span>
                      <button onClick={() => setPaneB(emptyPane())}
                        className="ml-auto text-[#93c5fd] hover:text-[#1d4ed8] text-[11px]">✕</button>
                    </div>
                    <div className="flex flex-1 overflow-hidden">
                      <div className="w-48 shrink-0 overflow-hidden">
                        <FileTree
                          rootDir={paneB.dir}
                          agentName={paneB.agentName}
                          onFileSelect={(path, name) => setPaneB(p => ({ ...p, selectedFile: path, selectedFileName: name }))}
                          selectedFile={paneB.selectedFile ?? undefined}
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <CodePane
                          filePath={paneB.selectedFile}
                          fileName={paneB.selectedFileName}
                          agentName={paneB.agentName}
                          agentDir={paneB.dir}
                          agentRootDir={paneB.dir}
                          onClose={() => setPaneB(p => ({ ...p, selectedFile: null, selectedFileName: null }))}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Chat */}
          {chatOpen && (
            <>
              {/* Drag handle */}
              <div
                className="h-px bg-[#e5e5e5] hover:bg-[#0d0d0d] cursor-ns-resize shrink-0 transition-colors group"
                onMouseDown={onDragStart}
              >
                <div className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronDown size={12} className="text-[#6b6b6b]" />
                </div>
              </div>
              <div style={{ height: chatHeight }} className="shrink-0 overflow-hidden border-t border-[#e5e5e5]">
                <ChatPanel activeAgents={activeAgents} />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function HeaderBtn({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] transition-all duration-150 ${
        active
          ? "bg-[#f4f4f5] text-[#0d0d0d] font-medium"
          : "text-[#6b6b6b] hover:bg-[#f7f7f8] hover:text-[#0d0d0d]"
      }`}
    >
      {icon}
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

function WelcomeView({ onSidebarOpen, hasAgents }: { onSidebarOpen: () => void; hasAgents: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center bg-[#fafafa] text-center px-8 select-none">
      <div className="w-14 h-14 rounded-2xl bg-[#0d0d0d] flex items-center justify-center mb-5 shadow-lg">
        <span className="text-white text-2xl font-bold">A</span>
      </div>
      <h1 className="text-[22px] font-semibold text-[#0d0d0d] mb-2">Agent Source Explorer</h1>
      <p className="text-[14px] text-[#6b6b6b] mb-8 max-w-sm leading-relaxed">
        Browse 12 AI agent repos, compare architectures,
        edit prompts with live diff, and chat with AI analysis.
      </p>
      <div className="grid grid-cols-3 gap-2 mb-8 max-w-xs">
        {["opencode", "cline", "aider", "codex", "OpenHands", "Kun"].map(n => (
          <div key={n} className="bg-white border border-[#e5e5e5] rounded-xl px-3 py-1.5 text-[12px] text-[#3f3f46] font-mono text-center">
            {n}
          </div>
        ))}
      </div>
      {!hasAgents ? (
        <p className="text-[13px] text-[#9b9b9b]">Loading agents…</p>
      ) : (
        <button
          onClick={onSidebarOpen}
          className="flex items-center gap-2 bg-[#0d0d0d] text-white text-[13px] font-medium px-5 py-2.5 rounded-full hover:bg-[#27272a] transition-colors"
        >
          <PanelLeft size={14} />
          Select an Agent
        </button>
      )}
    </div>
  );
}
