"use client";

import { useState, useEffect, useCallback } from "react";
import AgentSidebar, { AgentMeta } from "@/components/AgentSidebar";
import FileTree from "@/components/FileTree";
import CodePane from "@/components/CodePane";
import ChatPanel from "@/components/ChatPanel";
import PromptLab from "@/components/PromptLab";
import ServiceStatus from "@/components/ServiceStatus";
import { PanelLeft, SplitSquareHorizontal, MessageSquare, Columns2 } from "lucide-react";

type MainTab = "explorer" | "prompt-lab";

const ACCENT_A = "#58a6ff";
const ACCENT_B = "#79c0ff";

interface PaneState {
  agentName: string;
  dir: string;
  selectedFile: string | null;
  selectedFileName: string | null;
}

const emptyPane = (): PaneState => ({ agentName: "", dir: "", selectedFile: null, selectedFileName: null });

export default function Home() {
  const [agents, setAgents] = useState<AgentMeta[]>([]);
  const [paneA, setPaneA] = useState<PaneState>(emptyPane());
  const [paneB, setPaneB] = useState<PaneState>(emptyPane());
  const [chatOpen, setChatOpen] = useState(true);
  const [chatHeight, setChatHeight] = useState(300);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>("explorer");

  useEffect(() => {
    fetch("/api/agents").then((r) => r.json()).then(setAgents).catch(console.error);
  }, []);

  const selectAgent = useCallback((name: string) => {
    if (!name) { setPaneA(emptyPane()); return; }
    const agent = agents.find((a) => a.name === name);
    if (!agent) return;
    setPaneA({ agentName: name, dir: agent.dir, selectedFile: null, selectedFileName: null });
  }, [agents]);

  const compareAgent = useCallback((name: string) => {
    if (!name) { setPaneB(emptyPane()); return; }
    const agent = agents.find((a) => a.name === name);
    if (!agent) return;
    setPaneB({ agentName: name, dir: agent.dir, selectedFile: null, selectedFileName: null });
  }, [agents]);

  const selected = [paneA.agentName, paneB.agentName].filter(Boolean);
  const hasBPane = Boolean(paneB.agentName);

  // Drag to resize chat panel
  const onDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startH = chatHeight;
    const move = (ev: MouseEvent) => {
      const delta = startY - ev.clientY;
      setChatHeight(Math.max(180, Math.min(600, startH + delta)));
    };
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  }, [chatHeight]);

  return (
    <div className="h-screen flex flex-col bg-[#0d1117] text-gray-300 overflow-hidden">
      {/* Top toolbar */}
      <header className="h-10 border-b border-[#21262d] bg-[#010409] flex items-center px-3 gap-3 shrink-0 z-10">
        <div className="flex items-center gap-2 mr-2">
          <div className="w-5 h-5 bg-[#1f6feb] rounded flex items-center justify-center text-[10px] font-bold text-white">A</div>
          <span className="text-[13px] font-semibold text-gray-200">Agent Explorer</span>
        </div>
        {/* Main tab switcher */}
        <div className="flex items-center gap-0.5 border border-[#30363d] rounded-md p-0.5">
          <TabBtn label="Explorer" active={mainTab === "explorer"} onClick={() => setMainTab("explorer")} />
          <TabBtn label="⚡ Prompt Lab" active={mainTab === "prompt-lab"} onClick={() => setMainTab("prompt-lab")} color="purple" />
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {mainTab === "explorer" && <>
            <ToolbarBtn icon={<PanelLeft size={14} />} label="Sidebar" active={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)} />
            <ToolbarBtn icon={<SplitSquareHorizontal size={14} />} label="Compare" active={hasBPane}
              onClick={() => !hasBPane ? undefined : setPaneB(emptyPane())} />
            <ToolbarBtn icon={<MessageSquare size={14} />} label="AI Chat" active={chatOpen} onClick={() => setChatOpen((v) => !v)} />
          </>}
          <div className="h-4 w-px bg-[#30363d] mx-1" />
          <ServiceStatus />
        </div>
        {paneA.agentName && (
          <div className="flex items-center gap-1 text-[11px] text-gray-500 ml-2">
            <span className="text-[#58a6ff] font-mono">{paneA.agentName}</span>
            {paneB.agentName && <>
              <span className="text-gray-600">↔</span>
              <span className="text-[#79c0ff] font-mono">{paneB.agentName}</span>
            </>}
            {paneA.selectedFileName && <span className="text-gray-600">· {paneA.selectedFileName}</span>}
          </div>
        )}
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Prompt Lab tab */}
        {mainTab === "prompt-lab" && <PromptLab agents={agents} />}

        {/* Explorer tab */}
        {mainTab !== "prompt-lab" && sidebarOpen && (
          <AgentSidebar
            agents={agents}
            selected={selected}
            onSelect={selectAgent}
            onCompare={compareAgent}
          />
        )}

        {/* Explorer editor area */}
        {mainTab !== "prompt-lab" && <div className="flex-1 flex flex-col overflow-hidden">
          {/* Code panes */}
          <div className="flex-1 flex overflow-hidden">
            {!paneA.agentName ? (
              <WelcomeScreen onSelectFirst={() => setSidebarOpen(true)} />
            ) : (
              <>
                {/* Pane A */}
                <div className={`flex flex-col overflow-hidden ${hasBPane ? "w-1/2" : "flex-1"} border-r border-[#21262d]`}>
                  <PanelHeader label={paneA.agentName} color={ACCENT_A} icon="A" />
                  <div className="flex flex-1 overflow-hidden">
                    <div className="w-52 shrink-0 border-r border-[#21262d] overflow-hidden">
                      <FileTree
                        rootDir={paneA.dir}
                        agentName={paneA.agentName}
                        color={ACCENT_A}
                        onFileSelect={(path, name) => setPaneA((p) => ({ ...p, selectedFile: path, selectedFileName: name }))}
                        selectedFile={paneA.selectedFile ?? undefined}
                      />
                    </div>
                    <div className="flex-1 overflow-hidden">
                      <CodePane
                        filePath={paneA.selectedFile}
                        fileName={paneA.selectedFileName}
                        agentName={paneA.agentName}
                        accentColor={ACCENT_A}
                        onClose={() => setPaneA((p) => ({ ...p, selectedFile: null, selectedFileName: null }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Pane B */}
                {hasBPane && (
                  <div className="flex flex-col overflow-hidden w-1/2">
                    <PanelHeader label={paneB.agentName} color={ACCENT_B} icon="B"
                      onClose={() => setPaneB(emptyPane())} />
                    <div className="flex flex-1 overflow-hidden">
                      <div className="w-52 shrink-0 border-r border-[#21262d] overflow-hidden">
                        <FileTree
                          rootDir={paneB.dir}
                          agentName={paneB.agentName}
                          color={ACCENT_B}
                          onFileSelect={(path, name) => setPaneB((p) => ({ ...p, selectedFile: path, selectedFileName: name }))}
                          selectedFile={paneB.selectedFile ?? undefined}
                        />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <CodePane
                          filePath={paneB.selectedFile}
                          fileName={paneB.selectedFileName}
                          agentName={paneB.agentName}
                          accentColor={ACCENT_B}
                          onClose={() => setPaneB((p) => ({ ...p, selectedFile: null, selectedFileName: null }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Hint to open B pane when only A is open */}
                {!hasBPane && (
                  <div className="w-8 shrink-0 flex flex-col items-center justify-center gap-2 border-l border-[#21262d] bg-[#010409]">
                    <button
                      className="p-1.5 rounded text-gray-600 hover:text-gray-300 hover:bg-[#21262d] transition-all rotate-90"
                      title="⌘-click an agent in sidebar to compare"
                    >
                      <Columns2 size={14} />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* AI Chat panel */}
          {chatOpen && (
            <>
              {/* Drag handle */}
              <div
                className="h-1 bg-[#21262d] hover:bg-[#1f6feb] cursor-ns-resize transition-colors shrink-0"
                onMouseDown={onDragStart}
              />
              <div style={{ height: chatHeight }} className="shrink-0 overflow-hidden">
                <ChatPanel activeAgents={selected} />
              </div>
            </>
          )}
        </div>}
      </div>
    </div>
  );
}

function TabBtn({ label, active, onClick, color = "blue" }: { label: string; active: boolean; onClick: () => void; color?: "blue" | "purple" }) {
  const activeStyle = color === "purple"
    ? "bg-[#8957e5]/20 text-[#d2a8ff] border-[#8957e5]/40"
    : "bg-[#1f6feb22] text-[#58a6ff] border-[#1f6feb44]";
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${active ? activeStyle + " border" : "text-gray-500 hover:text-gray-300"}`}
    >
      {label}
    </button>
  );
}

function ToolbarBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active?: boolean; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] transition-all ${active ? "bg-[#1f6feb22] text-[#58a6ff] border border-[#1f6feb44]" : "text-gray-500 hover:text-gray-300 hover:bg-[#21262d]"}`}
      title={label}
    >
      {icon}
      <span className="hidden sm:block">{label}</span>
    </button>
  );
}

function PanelHeader({ label, color, icon, onClose }: { label: string; color: string; icon: string; onClose?: () => void }) {
  return (
    <div className="h-8 border-b border-[#21262d] bg-[#010409] flex items-center px-3 gap-2 shrink-0">
      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: color + "33", color }}>{icon}</span>
      <span className="text-[12px] font-mono font-semibold" style={{ color }}>{label}</span>
      {onClose && (
        <button onClick={onClose} className="ml-auto text-gray-600 hover:text-gray-400 text-[11px]">✕</button>
      )}
    </div>
  );
}

function WelcomeScreen({ onSelectFirst }: { onSelectFirst: () => void }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 select-none bg-[#0d1117]">
      <div className="text-6xl mb-4">🤖</div>
      <h2 className="text-xl font-semibold text-gray-200 mb-2">Agent Source Explorer</h2>
      <p className="text-gray-500 text-sm mb-6 max-w-sm">
        Browse and compare 12 AI agent source code repos.<br />
        Side-by-side diff, AI analysis, full file tree.
      </p>
      <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-600 mb-6">
        {["opencode", "cline", "aider", "codex", "OpenHands", "Kun"].map((n) => (
          <span key={n} className="bg-[#161b22] border border-[#21262d] rounded px-2 py-1 font-mono">{n}</span>
        ))}
        <span className="text-gray-700 col-span-3">+ 6 more</span>
      </div>
      <button
        onClick={onSelectFirst}
        className="bg-[#238636] hover:bg-[#2ea043] text-white text-sm px-4 py-2 rounded-lg transition-colors"
      >
        Select an Agent →
      </button>
    </div>
  );
}
