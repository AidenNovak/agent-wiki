"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { ChevronRight, File, Folder, FolderOpen, Loader2, Search, X } from "lucide-react";

interface Entry {
  name: string;
  type: "file" | "dir";
  size?: number;
  children?: Entry[];
}

interface SearchResult {
  path: string;
  name: string;
  dir: string;
}

interface Props {
  rootDir: string;
  agentName: string;
  color?: string;
  onFileSelect: (path: string, name: string) => void;
  selectedFile?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "dist", ".next", "target"]);

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

// ── EntryNode (tree item) ─────────────────────────────────────────────────────

function EntryNode({
  entry, basePath, depth, onFileSelect, selectedFile, color,
}: {
  entry: Entry;
  basePath: string;
  depth: number;
  onFileSelect: (path: string, name: string) => void;
  selectedFile?: string;
  color: string;
}) {
  const [open, setOpen] = useState(depth < 2);
  const [children, setChildren] = useState<Entry[] | null>(entry.children ?? null);
  const [loading, setLoading] = useState(false);
  const fullPath = `${basePath}/${entry.name}`;
  const isSelected = selectedFile === fullPath;

  const expand = useCallback(async () => {
    if (entry.type !== "dir") return;
    if (!open && children === null) {
      setLoading(true);
      try {
        const res = await fetch(`/api/fs?action=ls&path=${encodeURIComponent(fullPath)}&depth=1`);
        setChildren(await res.json());
      } catch {
        setChildren([]);
      }
      setLoading(false);
    }
    setOpen((v) => !v);
  }, [open, children, fullPath, entry.type]);

  if (SKIP_DIRS.has(entry.name) && entry.type === "dir") return null;

  if (entry.type === "dir") {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1 py-0.5 text-left hover:bg-[#161b22] rounded text-[12px] text-gray-400 hover:text-gray-200 transition-colors"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onClick={expand}
        >
          {loading
            ? <Loader2 size={12} className="animate-spin text-gray-500 shrink-0" />
            : <ChevronRight size={12} className={`transition-transform shrink-0 ${open ? "rotate-90" : ""}`} />}
          {open
            ? <FolderOpen size={12} className="shrink-0" style={{ color }} />
            : <Folder size={12} className="shrink-0" style={{ color }} />}
          <span className="truncate">{entry.name}</span>
        </button>
        {open && children && (
          <div>
            {children.map((c) => (
              <EntryNode
                key={c.name} entry={c} basePath={fullPath} depth={depth + 1}
                onFileSelect={onFileSelect} selectedFile={selectedFile} color={color}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      className={`w-full flex items-center gap-1.5 py-0.5 text-left rounded text-[12px] transition-colors ${
        isSelected
          ? "bg-[#1f6feb22] text-[#58a6ff]"
          : "text-gray-400 hover:bg-[#161b22] hover:text-gray-200"
      }`}
      style={{ paddingLeft: `${depth * 12 + 16}px` }}
      onClick={() => onFileSelect(fullPath, entry.name)}
      title={entry.name}
    >
      <File size={11} className="shrink-0 text-gray-600" />
      <span className="truncate flex-1">{entry.name}</span>
      <span className="text-gray-600 text-[10px] shrink-0 pr-1">{formatSize(entry.size)}</span>
    </button>
  );
}

// ── Search results panel ──────────────────────────────────────────────────────

function SearchPanel({
  results, loading, query, onFileSelect, color,
}: {
  results: SearchResult[];
  loading: boolean;
  query: string;
  onFileSelect: (path: string, name: string) => void;
  color: string;
}) {
  if (!query) return null;

  return (
    <div className="flex-1 overflow-y-auto py-1">
      {loading && (
        <div className="flex items-center gap-2 px-3 py-2 text-gray-500 text-[11px]">
          <Loader2 size={12} className="animate-spin" /> Searching…
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-3 py-4 text-center text-gray-600 text-[11px]">
          No files matching <span className="text-gray-400">"{query}"</span>
        </div>
      )}
      {!loading && results.map((r, i) => (
        <button
          key={i}
          className="w-full flex flex-col px-3 py-1 text-left hover:bg-[#161b22] transition-colors rounded"
          onClick={() => onFileSelect(r.path, r.name)}
        >
          <span className="text-[12px] font-mono" style={{ color }}>
            {highlightMatch(r.name, query)}
          </span>
          <span className="text-[10px] text-gray-600 truncate">{r.dir}</span>
        </button>
      ))}
    </div>
  );
}

function highlightMatch(name: string, query: string): React.ReactNode {
  if (!query) return name;
  const idx = name.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-[#f78166]/30 text-inherit rounded px-0.5">
        {name.slice(idx, idx + query.length)}
      </mark>
      {name.slice(idx + query.length)}
    </>
  );
}

// ── FileTree ──────────────────────────────────────────────────────────────────

export default function FileTree({
  rootDir, agentName, color = "#58a6ff", onFileSelect, selectedFile,
}: Props) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);
  const [treeError, setTreeError] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load tree on mount
  const load = useCallback(async () => {
    setLoadingTree(true);
    setTreeError(null);
    try {
      const res = await fetch(`/api/fs?action=ls&path=${encodeURIComponent(rootDir)}&depth=2`);
      if (!res.ok) throw new Error(await res.text());
      setEntries(await res.json());
    } catch (e) {
      setTreeError(String(e));
    }
    setLoadingTree(false);
  }, [rootDir]);

  if (entries === null && !loadingTree && !treeError) load();

  // Debounced search
  useEffect(() => {
    const q = query.trim();

    if (!q) {
      setSearchResults([]);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/fs?action=find&path=${encodeURIComponent(rootDir)}&q=${encodeURIComponent(q)}`
        );
        const data = await res.json();
        setSearchResults(Array.isArray(data) ? data : []);
      } catch {
        setSearchResults([]);
      }
      setSearchLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, rootDir]);

  const isSearching = query.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-[#0d1117] overflow-hidden">
      {/* Header: agent name + search toggle */}
      <div className="px-2 py-1.5 border-b border-[#21262d] shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <Folder size={12} style={{ color }} />
          <span className="text-[11px] font-mono font-semibold truncate" style={{ color }}>
            {agentName}
          </span>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search
            size={11}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-600 pointer-events-none"
          />
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search files…"
            className={`w-full bg-[#161b22] border rounded text-[12px] text-gray-300 placeholder-gray-600
              focus:outline-none transition-colors pl-6 pr-6 py-1
              ${isSearching
                ? "border-[#58a6ff66] ring-1 ring-[#1f6feb22]"
                : "border-[#30363d] hover:border-[#484f58]"}`}
          />
          {query && (
            <button
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-gray-600 hover:text-gray-400"
              onClick={() => { setQuery(""); searchRef.current?.focus(); }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Tree or search results */}
      {isSearching ? (
        <SearchPanel
          results={searchResults}
          loading={searchLoading}
          query={query.trim()}
          onFileSelect={(p, n) => { onFileSelect(p, n); setQuery(""); }}
          color={color}
        />
      ) : (
        <div className="flex-1 overflow-y-auto py-1">
          {loadingTree && (
            <div className="flex items-center justify-center py-8 text-gray-500">
              <Loader2 size={16} className="animate-spin" />
            </div>
          )}
          {treeError && (
            <div className="px-3 py-2 text-red-400 text-xs">{treeError}</div>
          )}
          {entries && entries.map((e) => (
            <EntryNode
              key={e.name} entry={e} basePath={rootDir} depth={0}
              onFileSelect={onFileSelect} selectedFile={selectedFile} color={color}
            />
          ))}
        </div>
      )}
    </div>
  );
}
