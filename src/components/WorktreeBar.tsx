"use client";

import { useState, useCallback } from "react";
import { GitBranch, Save, Trash2, Download, RefreshCw, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { apiPost } from "@/lib/api-client";

export interface WorktreeInfo {
  id: string;
  agentName: string;
  worktreePath: string;
  branch: string;
  isGit: boolean;
}

type Phase = "idle" | "creating" | "active" | "saving" | "saved" | "discarding";

interface Props {
  agentName: string;
  agentDir: string;
  selectedFileRel: string | null;   // relative path from agent root
  modifiedContent: string;
  originalContent: string;
  /** Called after discard so parent can reset edit mode */
  onDiscard: () => void;
}

async function wtPost(action: string, body: object): Promise<Record<string, unknown>> {
  return apiPost<Record<string, unknown>>("/api/worktree", { action, ...body }, { timeout: 60_000, retries: 1 });
}

export default function WorktreeBar({
  agentName, agentDir, selectedFileRel, modifiedContent, originalContent, onDiscard,
}: Props) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [worktree, setWorktree] = useState<WorktreeInfo | null>(null);
  const [commitMsg, setCommitMsg] = useState("");
  const [lastCommit, setLastCommit] = useState<string | null>(null);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const hasChanges = modifiedContent !== originalContent;
  const isActivePhase = (["active", "saving", "saved", "discarding"] as Phase[]).includes(phase);

  const showStatus = (ok: boolean, msg: string) => {
    setStatus({ ok, msg });
    setTimeout(() => setStatus(null), 5000);
  };

  const applyChange = useCallback(async () => {
    if (!worktree || !selectedFileRel || !hasChanges) return;
    const r = await wtPost("apply", { id: worktree.id, filePath: selectedFileRel, content: modifiedContent });
    if (r.error) showStatus(false, String(r.error));
    else showStatus(true, `Applied ${selectedFileRel}`);
  }, [worktree, selectedFileRel, modifiedContent, hasChanges]);

  const create = async () => {
    setPhase("creating");
    try {
      const d = await wtPost("create", { agent: agentName });
      if (d.error) { showStatus(false, String(d.error)); setPhase("idle"); return; }
      setWorktree(d as unknown as WorktreeInfo);
      setPhase("active");
      showStatus(true, `Worktree: ${String(d.branch)}`);
    } catch (e) {
      showStatus(false, e instanceof Error ? e.message : String(e));
      setPhase("idle");
    }
  };

  const save = async () => {
    if (!worktree) return;
    await applyChange();
    setPhase("saving");
    try {
      const d = await wtPost("save", { id: worktree.id, message: commitMsg || undefined });
      if (d.error) throw new Error(String(d.error));
      setLastCommit(String(d.commitHash ?? ""));
      setPhase("saved");
      showStatus(true, `Committed: ${String(d.commitHash ?? "")}`);
    } catch (e) {
      showStatus(false, e instanceof Error ? e.message : String(e));
      setPhase("active");
    }
  };

  const discard = async () => {
    if (worktree) {
      setPhase("discarding");
      await wtPost("discard", { id: worktree.id });
    }
    setWorktree(null);
    setPhase("idle");
    setLastCommit(null);
    onDiscard();
  };

  const download = () => {
    if (!worktree) return;
    const a = document.createElement("a");
    a.href = `/api/worktree?action=download&id=${worktree.id}`;
    a.download = `${worktree.agentName}-modified.zip`;
    a.click();
  };

  const loading = phase === "creating" || phase === "saving" || phase === "discarding";

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#010409] border-t border-[#21262d] text-[11px] shrink-0 flex-wrap">
      {/* Worktree branch indicator */}
      {worktree ? (
        <div className="flex items-center gap-1 text-[#56d364] font-mono">
          <GitBranch size={11} />
          <span className="truncate max-w-[160px]">{worktree.branch}</span>
          {lastCommit && <span className="text-gray-600">· {lastCommit}</span>}
        </div>
      ) : (
        <span className="text-gray-600 font-mono">⚡ Prompt Edit</span>
      )}

      <div className="flex items-center gap-1.5 ml-auto flex-wrap">
        {/* No worktree yet → Create */}
        {phase === "idle" && hasChanges && (
          <Btn icon={<GitBranch size={12} />} label="Create Worktree" color="purple" onClick={create} />
        )}
        {phase === "creating" && (
          <Btn icon={<Loader2 size={12} className="animate-spin" />} label="Creating…" disabled />
        )}

        {/* Worktree active → Apply / commit msg / Save / Download / Discard */}
        {isActivePhase && (
          <>
            {hasChanges && (
              <Btn icon={<RefreshCw size={12} />} label="Apply" color="blue" onClick={applyChange} />
            )}
            <input
              className="bg-[#161b22] border border-[#30363d] rounded px-2 py-0.5 text-[11px] text-gray-300 placeholder-gray-600 focus:outline-none focus:border-[#1f6feb] w-36"
              placeholder="Commit message…"
              value={commitMsg}
              onChange={(e) => setCommitMsg(e.target.value)}
            />
            <Btn
              icon={phase === "saving" ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              label="Save"
              color="green"
              onClick={save}
              disabled={phase === "saving"}
            />
            <Btn icon={<Download size={12} />} label="ZIP" color="gray" onClick={download} title="Download modified agent as ZIP" />
            <Btn
              icon={phase === "discarding" ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
              label="Discard"
              color="red"
              onClick={discard}
              disabled={phase === "discarding"}
            />
          </>
        )}
      </div>

      {/* Status message */}
      {status && (
        <div className={`flex items-center gap-1 ml-1 text-[10px] ${status.ok ? "text-[#56d364]" : "text-[#f85149]"}`}>
          {status.ok ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
          {status.msg}
        </div>
      )}
    </div>
  );
}

function Btn({ icon, label, color = "gray", onClick, disabled = false, title }: {
  icon: React.ReactNode; label: string; color?: string;
  onClick?: () => void; disabled?: boolean; title?: string;
}) {
  const c: Record<string, string> = {
    blue: "text-[#58a6ff] border-[#1f6feb44] bg-[#1f6feb11] hover:bg-[#1f6feb22]",
    green: "text-[#56d364] border-[#238636]/40 bg-[#238636]/10 hover:bg-[#238636]/20",
    red: "text-[#f85149] border-[#da3633]/40 bg-[#da3633]/10 hover:bg-[#da3633]/20",
    purple: "text-[#d2a8ff] border-[#8957e5]/40 bg-[#8957e5]/10 hover:bg-[#8957e5]/20",
    gray: "text-gray-400 border-[#30363d] bg-[#21262d] hover:bg-[#30363d]",
  };
  return (
    <button
      className={`flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] transition-colors ${c[color] ?? c.gray} disabled:opacity-40 disabled:cursor-not-allowed`}
      onClick={onClick} disabled={disabled} title={title}
    >
      {icon}{label}
    </button>
  );
}
