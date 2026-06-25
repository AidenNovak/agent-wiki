"use client";

import { useState, useCallback } from "react";
import { ChevronRight, File, Folder, FolderOpen, Loader2, Search, X, Pencil } from "lucide-react";
import ShikiCode from "./ShikiCode";
import WorktreeBar from "./WorktreeBar";
import SplitEditor from "./SplitEditor";

interface AgentMeta {
  name: string;
  category: string;
  description: string;
  dir: string;
  url?: string;
}

/** Extract GitHub owner from repo URL, e.g. "https://github.com/openai/codex" → "openai" */
function githubOwner(url?: string): string | null {
  if (!url) return null;
  const m = url.match(/github\.com\/([^/]+)/);
  return m?.[1] ?? null;
}

function GitHubAvatar({ url, name, category }: { url?: string; name: string; category: string }) {
  const owner = githubOwner(url);
  const avatarUrl = owner ? `https://github.com/${owner}.png?size=80` : null;
  const [failed, setFailed] = useState(false);

  if (avatarUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt={name}
        width={22} height={22}
        className="rounded-md object-cover shrink-0"
        onError={() => setFailed(true)}
      />
    );
  }

  // Fallback: coloured initial square
  return (
    <div className={`w-[22px] h-[22px] rounded-md flex items-center justify-center shrink-0 text-[9px] font-bold text-white ${
      category === "collaboration" ? "bg-[#7c3aed]" : "bg-[#0d0d0d]"
    }`}>
      {name[0].toUpperCase()}
    </div>
  );
}

interface Entry {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: Entry[];
}

interface OpenTab {
  path: string;
  name: string;
  agentName: string;
  agentDir: string;
  content: string | null;
  loading: boolean;
  editMode: boolean;
  modified: string;
}

const EXT_LANG: Record<string, string> = {
  ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  py: "python", go: "go", rs: "rust", rb: "ruby",
  md: "markdown", json: "json", yaml: "yaml", yml: "yaml",
  toml: "toml", sh: "bash", css: "css", html: "html",
  txt: "text",
};
function getLang(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return EXT_LANG[ext] ?? (ext || "text");
}

// ── Project tree item ────────────────────────────────────────────────────────

function EntryRow({
  entry, basePath, depth, onOpenFile, selectedPath, agentDir, agentName,
}: {
  entry: Entry; basePath: string; depth: number;
  onOpenFile: (path: string, name: string, agentDir: string, agentName: string) => void;
  selectedPath?: string;
  agentDir: string;
  agentName: string;
}) {
  const [open, setOpen] = useState(depth < 1);
  const [children, setChildren] = useState<Entry[] | null>(entry.children ?? null);
  const [loading, setLoading] = useState(false);
  const fullPath = `${basePath}/${entry.name}`;
  const isSelected = selectedPath === fullPath;

  const expand = useCallback(async () => {
    if (entry.type !== "dir") return;
    if (!open && children === null) {
      setLoading(true);
      try {
        const r = await fetch(`/api/fs?action=ls&path=${encodeURIComponent(fullPath)}&depth=1`);
        setChildren(await r.json());
      } catch { setChildren([]); }
      setLoading(false);
    }
    setOpen(v => !v);
  }, [open, children, fullPath, entry.type]);

  const SKIP = new Set([".git", "node_modules", "__pycache__", ".venv", "dist", ".next", "target"]);
  if (SKIP.has(entry.name) && entry.type === "dir") return null;

  if (entry.type === "dir") {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1.5 py-0.5 rounded hover:bg-[#f0f0f0] transition-colors text-[12.5px] text-[#52525b] hover:text-[#0d0d0d]"
          style={{ paddingLeft: `${depth * 16 + 8}px`, paddingRight: "8px" }}
          onClick={expand}
        >
          {loading
            ? <Loader2 size={11} className="animate-spin shrink-0 text-[#9b9b9b]" />
            : <ChevronRight size={11} className={`shrink-0 text-[#b5b5b5] transition-transform ${open ? "rotate-90" : ""}`} />}
          {open
            ? <FolderOpen size={12} className="shrink-0 text-[#f59e0b]" />
            : <Folder size={12} className="shrink-0 text-[#f59e0b]" />}
          <span className="truncate">{entry.name}</span>
        </button>
        {open && children?.map(c => (
          <EntryRow key={c.name} entry={c} basePath={fullPath} depth={depth + 1}
            onOpenFile={onOpenFile} selectedPath={selectedPath}
            agentDir={agentDir} agentName={agentName} />
        ))}
      </div>
    );
  }

  return (
    <button
      className={`w-full flex items-center gap-1.5 py-0.5 rounded text-[12.5px] transition-all ${
        isSelected ? "bg-[#0d0d0d] text-white" : "text-[#52525b] hover:bg-[#f0f0f0] hover:text-[#0d0d0d]"
      }`}
      style={{ paddingLeft: `${depth * 16 + 20}px`, paddingRight: "8px" }}
      onClick={() => onOpenFile(fullPath, entry.name, agentDir, agentName)}
    >
      <File size={11} className={`shrink-0 ${isSelected ? "text-white/50" : "text-[#c4c4c7]"}`} />
      <span className="truncate flex-1">{entry.name}</span>
      <span className={`text-[10px] shrink-0 ${isSelected ? "text-white/40" : "text-[#c4c4c7]"}`}>
        {entry.size ? `${(entry.size / 1024).toFixed(0)}K` : ""}
      </span>
    </button>
  );
}

// ── Project accordion item ────────────────────────────────────────────────────

function ProjectItem({
  agent, onOpenFile, selectedPath,
}: {
  agent: AgentMeta;
  onOpenFile: (path: string, name: string, agentDir: string, agentName: string) => void;
  selectedPath?: string;
}) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (!open && entries === null) {
      setLoading(true);
      try {
        const r = await fetch(`/api/fs?action=ls&path=${encodeURIComponent(agent.dir)}&depth=2`);
        setEntries(await r.json());
      } catch { setEntries([]); }
      setLoading(false);
    }
    setOpen(v => !v);
  }, [open, entries, agent.dir]);

  return (
    <div className="border-b border-[#f0f0f0] last:border-0">
      {/* Project header */}
      <button
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left hover:bg-[#f7f7f8] transition-colors group"
        onClick={toggle}
      >
        <ChevronRight
          size={13}
          className={`text-[#9b9b9b] transition-transform duration-200 shrink-0 ${open ? "rotate-90" : ""}`}
        />
        {loading
          ? <Loader2 size={14} className="animate-spin text-[#9b9b9b]" />
          : <GitHubAvatar url={agent.url} name={agent.name} category={agent.category} />}
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-[#0d0d0d] truncate">{agent.name}</p>
          <p className="text-[10px] text-[#9b9b9b] truncate">{agent.description}</p>
        </div>
      </button>

      {/* File tree */}
      {open && entries && (
        <div className="px-2 pb-2">
          {entries.map(e => (
            <EntryRow key={e.name} entry={e} basePath={agent.dir} depth={1}
              onOpenFile={onOpenFile} selectedPath={selectedPath}
              agentDir={agent.dir} agentName={agent.name} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── File tab viewer ───────────────────────────────────────────────────────────

function FileTab({ tab, isActive, onActivate, onClose }: {
  tab: OpenTab; isActive: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 border-r border-[#e5e5e5] cursor-pointer shrink-0 transition-colors ${
        isActive ? "bg-white border-b-2 border-b-[#0d0d0d]" : "bg-[#f7f7f8] hover:bg-[#f0f0f0] text-[#6b6b6b]"
      }`}
      onClick={onActivate}
    >
      <span className="text-[12px] font-mono">{tab.name}</span>
      {tab.editMode && <span className="text-[9px] text-[#7c3aed] font-bold">✏</span>}
      <button
        onClick={e => { e.stopPropagation(); onClose(); }}
        className="text-[#9b9b9b] hover:text-[#0d0d0d] transition-colors ml-0.5"
      >
        <X size={11} />
      </button>
    </div>
  );
}

// ── Main ProjectBrowser ───────────────────────────────────────────────────────

export default function ProjectBrowser({ agents }: { agents: AgentMeta[] }) {
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [sidebarQuery, setSidebarQuery] = useState("");

  const openFile = useCallback(async (path: string, name: string, agentDir: string, agentName: string) => {
    // If already open, just activate
    if (tabs.find(t => t.path === path)) {
      setActiveTab(path);
      return;
    }

    const tab: OpenTab = {
      path, name, agentName, agentDir,
      content: null, loading: true, editMode: false, modified: "",
    };
    setTabs(prev => [...prev, tab]);
    setActiveTab(path);

    // Load content
    try {
      const r = await fetch(`/api/fs?action=read&path=${encodeURIComponent(path)}`);
      const d = await r.json();
      const content = d.content ?? d.error ?? "";
      setTabs(prev => prev.map(t =>
        t.path === path ? { ...t, content, modified: content, loading: false } : t
      ));
    } catch (e) {
      setTabs(prev => prev.map(t =>
        t.path === path ? { ...t, content: String(e), loading: false } : t
      ));
    }
  }, [tabs]);

  const closeTab = (path: string) => {
    setTabs(prev => {
      const next = prev.filter(t => t.path !== path);
      if (activeTab === path) setActiveTab(next[next.length - 1]?.path ?? null);
      return next;
    });
  };

  const toggleEdit = (path: string) => {
    setTabs(prev => prev.map(t => t.path === path ? { ...t, editMode: !t.editMode } : t));
  };

  const currentTab = tabs.find(t => t.path === activeTab) ?? null;
  const filteredAgents = sidebarQuery
    ? agents.filter(a => a.name.toLowerCase().includes(sidebarQuery.toLowerCase()))
    : agents;

  return (
    <div className="h-full flex overflow-hidden bg-white"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* ── Left sidebar: project list ──────────────────────────────────── */}
      <div className="w-56 shrink-0 border-r border-[#e5e5e5] flex flex-col bg-[#fafafa] overflow-hidden">
        <div className="px-3 py-2.5 border-b border-[#ebebeb]">
          <p className="text-[11px] font-semibold text-[#6b6b6b] uppercase tracking-wider mb-2">Projects</p>
          <div className="relative">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b5b5b5]" />
            <input
              type="text" value={sidebarQuery}
              onChange={e => setSidebarQuery(e.target.value)}
              placeholder="Filter projects…"
              className="w-full text-[12px] bg-[#f0f0f0] rounded-lg pl-7 pr-3 py-1 text-[#0d0d0d] placeholder-[#9b9b9b] focus:outline-none focus:bg-white border border-transparent focus:border-[#d4d4d8] transition-all"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredAgents.map(a => (
            <ProjectItem
              key={a.name} agent={a}
              onOpenFile={openFile}
              selectedPath={currentTab?.path}
            />
          ))}
        </div>
      </div>

      {/* ── Right: tabs + content ───────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab bar */}
        {tabs.length > 0 ? (
          <>
            <div className="flex border-b border-[#e5e5e5] bg-[#f7f7f8] overflow-x-auto shrink-0">
              {tabs.map(t => (
                <FileTab
                  key={t.path} tab={t}
                  isActive={t.path === activeTab}
                  onActivate={() => setActiveTab(t.path)}
                  onClose={() => closeTab(t.path)}
                />
              ))}
            </div>

            {/* Content area */}
            {currentTab && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* File action bar */}
                <div className="flex items-center gap-3 px-4 py-1.5 bg-white border-b border-[#e5e5e5] shrink-0">
                  <span className="text-[11px] text-[#9b9b9b] font-mono">{currentTab.agentName}/</span>
                  <span className="text-[12px] font-medium text-[#0d0d0d]">{currentTab.name}</span>
                  <span className="text-[10px] text-[#9b9b9b] bg-[#f4f4f5] border border-[#e4e4e7] px-1.5 rounded-md">
                    {getLang(currentTab.name)}
                  </span>
                  {currentTab.content && (
                    <span className="text-[10px] text-[#b5b5b5]">
                      {currentTab.content.split("\n").length} lines
                    </span>
                  )}
                  <button
                    onClick={() => toggleEdit(currentTab.path)}
                    className={`ml-auto flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] border transition-all ${
                      currentTab.editMode
                        ? "text-[#7c3aed] border-[#ddd6fe] bg-[#f5f3ff]"
                        : "text-[#6b6b6b] border-[#e4e4e7] hover:border-[#c4c4c7]"
                    }`}
                  >
                    <Pencil size={11} />
                    {currentTab.editMode ? "View" : "Edit"}
                  </button>
                </div>

                {/* Code / Split editor */}
                {currentTab.loading ? (
                  <div className="flex-1 flex items-center justify-center bg-[#0d1117]">
                    <Loader2 size={18} className="animate-spin text-[#484f58]" />
                  </div>
                ) : currentTab.editMode ? (
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="flex-1 overflow-hidden">
                      <SplitEditor
                        original={currentTab.content ?? ""}
                        modified={currentTab.modified}
                        onChange={v => setTabs(prev => prev.map(t =>
                          t.path === currentTab.path ? { ...t, modified: v } : t
                        ))}
                      />
                    </div>
                    <WorktreeBar
                      agentName={currentTab.agentName}
                      agentDir={currentTab.agentDir}
                      selectedFileRel={currentTab.path.replace(currentTab.agentDir + "/", "")}
                      originalContent={currentTab.content ?? ""}
                      modifiedContent={currentTab.modified}
                      onDiscard={() => {
                        setTabs(prev => prev.map(t =>
                          t.path === currentTab.path
                            ? { ...t, editMode: false, modified: t.content ?? "" }
                            : t
                        ));
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto bg-[#0d1117]">
                    <ShikiCode
                      code={currentTab.content ?? ""}
                      lang={getLang(currentTab.name)}
                      className={[
                        "min-h-full [&_.shiki]:bg-transparent [&_pre]:!bg-[#0d1117]",
                        "[&_pre]:p-0 [&_code]:block [&_code]:pl-[3.5rem]",
                        "[&_.line]:relative [&_.line]:min-h-[1.25rem] [&_.line]:leading-5",
                        "[&_.line]:before:content-[attr(data-line)] [&_.line]:before:absolute",
                        "[&_.line]:before:left-0 [&_.line]:before:w-[2.75rem]",
                        "[&_.line]:before:text-right [&_.line]:before:pr-4",
                        "[&_.line]:before:text-[#484f58] [&_.line]:before:text-[11px]",
                        "[&_.line]:before:font-mono [&_.line]:before:select-none",
                        "[&_pre]:overflow-x-auto [&_code]:text-[12.5px] [&_code]:font-mono",
                      ].join(" ")}
                    />
                  </div>
                )}
              </div>
            )}
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center bg-[#fafafa] text-center px-8">
            <div className="text-5xl mb-4">🗂️</div>
            <p className="text-[15px] font-medium text-[#3f3f46]">Open a file</p>
            <p className="text-[13px] text-[#9b9b9b] mt-1">
              Expand a project on the left, then click any file
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
