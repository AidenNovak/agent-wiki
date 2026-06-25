"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical, Loader2, GitBranch, Save, Trash2, Download,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle, RefreshCw,
} from "lucide-react";
import SplitEditor from "./SplitEditor";
import type { AgentMeta } from "./AgentSidebar";
import { apiFetch, apiPost } from "@/lib/api-client";

interface PromptFile {
  path: string;
  rel: string;
  size: number;
  confidence: "known" | "pattern";
}

interface WorktreeState {
  id: string;
  agentName: string;
  worktreePath: string;
  branch: string;
  isGit: boolean;
  modifiedFiles: string[];
}

type Phase =
  | "idle"            // no worktree
  | "creating"        // worktree being created
  | "active"          // worktree exists, editing
  | "saving"
  | "saved"
  | "discarding";

interface Props {
  agents: AgentMeta[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

async function wtPost(action: string, body: object): Promise<Record<string, unknown>> {
  return apiPost<Record<string, unknown>>("/api/worktree", { action, ...body }, { timeout: 60_000, retries: 1 });
}

// ── PromptLab ─────────────────────────────────────────────────────────────────

export default function PromptLab({ agents }: Props) {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [promptFiles, setPromptFiles] = useState<PromptFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<PromptFile | null>(null);
  const [loadingFiles, setLoadingFiles] = useState(false);

  const [originalContent, setOriginalContent] = useState("");
  const [modifiedContent, setModifiedContent] = useState("");
  const [loadingContent, setLoadingContent] = useState(false);

  const [phase, setPhase] = useState<Phase>("idle");
  const [worktree, setWorktree] = useState<WorktreeState | null>(null);
  const [commitMessage, setCommitMessage] = useState("");
  const [lastCommit, setLastCommit] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const [fileListOpen, setFileListOpen] = useState(true);

  const hasChanges = modifiedContent !== originalContent;

  // ── Load prompt files for agent ────────────────────────────────────────────
  const loadPrompts = useCallback(async (agentName: string) => {
    if (!agentName) return;
    setLoadingFiles(true);
    setPromptFiles([]);
    setSelectedFile(null);
    setOriginalContent("");
    setModifiedContent("");
    setError(null);
    try {
      const d = await apiFetch<{ files: PromptFile[]; error?: string }>(
        `/api/prompts?agent=${encodeURIComponent(agentName)}`,
        { timeout: 15_000 }
      );
      if (d.error) throw new Error(String(d.error));
      setPromptFiles(d.files ?? []);
      if (!d.files?.length) setStatusMsg("No prompt files found — try using the AI to locate them");
    } catch (e) {
      setError(`Failed to scan prompts: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoadingFiles(false);
  }, []);

  useEffect(() => {
    if (selectedAgent) loadPrompts(selectedAgent);
  }, [selectedAgent, loadPrompts]);

  // ── Load file content ──────────────────────────────────────────────────────
  const loadFile = useCallback(async (file: PromptFile) => {
    setLoadingContent(true);
    setSelectedFile(file);
    setError(null);
    try {
      const d = await apiFetch<{ content: string; size: number; error?: string }>(
        `/api/prompts?file=${encodeURIComponent(file.path)}`,
        { timeout: 10_000 }
      );
      if (d.error) throw new Error(String(d.error));
      setOriginalContent(d.content ?? "");
      setModifiedContent(d.content ?? "");
    } catch (e) {
      setError(`Failed to load file: ${e instanceof Error ? e.message : String(e)}`);
    }
    setLoadingContent(false);
  }, []);

  // ── Worktree: create ───────────────────────────────────────────────────────
  const createWorktree = async () => {
    if (!selectedAgent) return;
    setPhase("creating");
    setError(null);
    try {
      const d = await wtPost("create", { agent: selectedAgent });
      if (d.error) throw new Error(String(d.error));
      setWorktree(d as unknown as WorktreeState);
      setPhase("active");
      setStatusMsg(`Worktree created: ${String(d.branch)}`);
    } catch (e) {
      setError(String(e));
      setPhase("idle");
    }
  };

  // ── Worktree: apply current file ───────────────────────────────────────────
  const applyChange = useCallback(async () => {
    if (!worktree || !selectedFile || !hasChanges) return;
    const r = await wtPost("apply", {
      id: worktree.id,
      filePath: selectedFile.rel,
      content: modifiedContent,
    });
    if (r.error) setError(String(r.error));
    else setStatusMsg(`Applied changes to ${selectedFile.rel}`);
  }, [worktree, selectedFile, modifiedContent, hasChanges]);

  // ── Worktree: save ─────────────────────────────────────────────────────────
  const saveWorktree = async () => {
    if (!worktree) return;
    await applyChange();
    setPhase("saving");
    setError(null);
    try {
      const d = await wtPost("save", { id: worktree.id, message: commitMessage || undefined });
      if (d.error) throw new Error(String(d.error));
      setLastCommit(String(d.commitHash ?? ""));
      setPhase("saved");
      setStatusMsg(`Committed: ${String(d.commitHash ?? "")}`);
    } catch (e) {
      setError(String(e));
      setPhase("active");
    }
  };

  // ── Worktree: discard ──────────────────────────────────────────────────────
  const discardWorktree = async () => {
    if (!worktree) return;
    setPhase("discarding");
    await wtPost("discard", { id: worktree.id });
    setWorktree(null);
    setPhase("idle");
    setModifiedContent(originalContent);
    setLastCommit(null);
    setStatusMsg("Worktree discarded");
  };

  // ── Download ───────────────────────────────────────────────────────────────
  const download = async () => {
    if (!worktree) return;
    const url = `/api/worktree?action=download&id=${worktree.id}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${worktree.agentName}-modified.zip`;
    a.click();
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex overflow-hidden bg-[#0d1117] text-gray-300">
      {/* LEFT PANEL: agent + file selector */}
      <div className="w-60 shrink-0 border-r border-[#21262d] flex flex-col overflow-hidden bg-[#010409]">
        {/* Header */}
        <div className="px-3 py-2.5 border-b border-[#21262d] flex items-center gap-2">
          <FlaskConical size={14} className="text-[#d2a8ff]" />
          <span className="text-[12px] font-semibold text-gray-200">Prompt Lab</span>
        </div>

        {/* Agent selector */}
        <div className="px-3 py-2 border-b border-[#21262d]">
          <label className="text-[10px] text-gray-500 uppercase tracking-wider block mb-1">Agent</label>
          <select
            className="w-full bg-[#161b22] border border-[#30363d] rounded text-[12px] text-gray-300 px-2 py-1 focus:outline-none focus:border-[#1f6feb]"
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
          >
            <option value="">— select agent —</option>
            {agents.map((a) => (
              <option key={a.name} value={a.name}>{a.name}</option>
            ))}
          </select>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto">
          {loadingFiles && (
            <div className="flex items-center gap-2 px-3 py-3 text-gray-500 text-[11px]">
              <Loader2 size={12} className="animate-spin" /> Scanning for prompts…
            </div>
          )}
          {!loadingFiles && promptFiles.length === 0 && selectedAgent && (
            <div className="px-3 py-3 text-gray-600 text-[11px]">
              No prompt files found.<br />
              <button className="text-[#58a6ff] mt-1" onClick={() => loadPrompts(selectedAgent)}>
                Retry
              </button>
            </div>
          )}
          {promptFiles.length > 0 && (
            <>
              <button
                className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] text-gray-500 uppercase tracking-wider hover:bg-[#161b22] transition-colors"
                onClick={() => setFileListOpen((v) => !v)}
              >
                {fileListOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                Prompt Files ({promptFiles.length})
              </button>
              {fileListOpen && promptFiles.map((f) => (
                <button
                  key={f.path}
                  className={`w-full flex flex-col px-3 py-1.5 text-left hover:bg-[#161b22] transition-colors border-b border-[#21262d]/50 ${selectedFile?.path === f.path ? "bg-[#1f6feb22] border-l-2 border-l-[#58a6ff]" : ""}`}
                  onClick={() => loadFile(f)}
                >
                  <span className={`text-[12px] font-mono truncate ${selectedFile?.path === f.path ? "text-[#58a6ff]" : "text-gray-300"}`}>
                    {f.rel.split("/").pop()}
                  </span>
                  <span className="text-[10px] text-gray-600 truncate">
                    {f.rel} · {formatSize(f.size)}
                    {f.confidence === "known" && " ★"}
                  </span>
                </button>
              ))}
            </>
          )}
        </div>

        {/* Worktree status */}
        <div className="border-t border-[#21262d] px-3 py-2">
          {worktree ? (
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[10px]">
                <GitBranch size={11} className="text-[#56d364]" />
                <span className="text-[#56d364] font-mono truncate">{worktree.branch}</span>
              </div>
              {lastCommit && (
                <div className="text-[10px] text-gray-500 flex items-center gap-1">
                  <CheckCircle size={10} className="text-green-400" /> {lastCommit}
                </div>
              )}
              {worktree.isGit && <div className="text-[10px] text-gray-600">git worktree active</div>}
              {!worktree.isGit && <div className="text-[10px] text-amber-600">copy mode (no git)</div>}
            </div>
          ) : (
            <div className="text-[10px] text-gray-600">No active worktree</div>
          )}
        </div>
      </div>

      {/* MAIN AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[#21262d] bg-[#010409] shrink-0 flex-wrap">
          {selectedFile && (
            <span className="text-[12px] text-gray-400 font-mono mr-2">{selectedFile.rel}</span>
          )}

          <div className="ml-auto flex items-center gap-2 flex-wrap">
            {/* Phase: idle → create worktree */}
            {phase === "idle" && selectedFile && hasChanges && (
              <ToolBtn
                icon={<GitBranch size={13} />}
                label="Create Worktree"
                color="purple"
                onClick={createWorktree}
              />
            )}

            {phase === "creating" && (
              <ToolBtn icon={<Loader2 size={13} className="animate-spin" />} label="Creating…" disabled />
            )}

            {/* Phase: active */}
            {(["active", "saved", "saving", "discarding"] as Phase[]).includes(phase) && (
              <>
                {hasChanges && (
                  <ToolBtn
                    icon={<RefreshCw size={13} />}
                    label="Apply"
                    color="blue"
                    onClick={applyChange}
                    title="Write changes to worktree without committing"
                  />
                )}
                <div className="flex items-center gap-1">
                  <input
                    className="bg-[#161b22] border border-[#30363d] rounded px-2 py-1 text-[12px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#1f6feb] w-48"
                    placeholder="Commit message (optional)"
                    value={commitMessage}
                    onChange={(e) => setCommitMessage(e.target.value)}
                  />
                  <ToolBtn
                    icon={phase === "saving" ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    label="Save"
                    color="green"
                    onClick={saveWorktree}
                    disabled={phase === "saving"}
                  />
                </div>
                <ToolBtn
                  icon={<Download size={13} />}
                  label="Download ZIP"
                  color="gray"
                  onClick={download}
                  title="Download the full modified agent as ZIP"
                />
                <ToolBtn
                  icon={phase === "discarding" ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                  label="Discard"
                  color="red"
                  onClick={discardWorktree}
                  disabled={phase === "discarding"}
                />
              </>
            )}
          </div>
        </div>

        {/* Status / error */}
        {(error || statusMsg) && (
          <div className={`px-4 py-1.5 text-[11px] flex items-center gap-2 shrink-0 ${error ? "bg-red-950/30 text-red-400" : "bg-[#1b3a2a] text-[#56d364]"}`}>
            {error ? <AlertCircle size={12} /> : <CheckCircle size={12} />}
            <span>{error ?? statusMsg}</span>
            <button className="ml-auto text-current opacity-50 hover:opacity-100" onClick={() => { setError(null); setStatusMsg(null); }}>✕</button>
          </div>
        )}

        {/* Editor area */}
        {loadingContent && (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        )}

        {!loadingContent && !selectedFile && (
          <EmptyState hasAgent={Boolean(selectedAgent)} />
        )}

        {!loadingContent && selectedFile && (
          <SplitEditor
            original={originalContent}
            modified={modifiedContent}
            onChange={setModifiedContent}
          />
        )}
      </div>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ToolBtn({
  icon, label, color = "gray", onClick, disabled = false, title,
}: {
  icon: React.ReactNode;
  label: string;
  color?: "blue" | "green" | "red" | "purple" | "gray";
  onClick?: () => void;
  disabled?: boolean;
  title?: string;
}) {
  const cls: Record<string, string> = {
    blue: "bg-[#1f6feb22] text-[#58a6ff] border-[#1f6feb44] hover:bg-[#1f6feb33]",
    green: "bg-[#238636]/20 text-[#56d364] border-[#238636]/40 hover:bg-[#238636]/30",
    red: "bg-[#da3633]/20 text-[#f85149] border-[#da3633]/40 hover:bg-[#da3633]/30",
    purple: "bg-[#8957e5]/20 text-[#d2a8ff] border-[#8957e5]/40 hover:bg-[#8957e5]/30",
    gray: "bg-[#21262d] text-gray-400 border-[#30363d] hover:bg-[#30363d]",
  };
  return (
    <button
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[12px] border transition-colors ${cls[color]} disabled:opacity-40 disabled:cursor-not-allowed`}
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      {icon}{label}
    </button>
  );
}

function EmptyState({ hasAgent }: { hasAgent: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-center text-gray-600 select-none px-8">
      <FlaskConical size={36} className="text-[#d2a8ff]/30 mb-4" />
      {hasAgent ? (
        <>
          <p className="text-sm text-gray-500">Select a prompt file to start editing</p>
          <p className="text-xs mt-1 text-gray-700">
            Files marked ★ are from known prompt directories
          </p>
        </>
      ) : (
        <>
          <p className="text-sm text-gray-500">Select an agent to discover its prompt files</p>
          <p className="text-xs mt-1 text-gray-700">
            Prompt Lab creates an isolated git worktree for edits — the original is never modified
          </p>
        </>
      )}
    </div>
  );
}
