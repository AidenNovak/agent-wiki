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
  accentColor?: string;
  onFileSelect: (path: string, name: string) => void;
  selectedFile?: string;
}

const SKIP_DIRS = new Set([".git", "node_modules", "__pycache__", ".venv", "dist", ".next", "target"]);

function formatSize(bytes?: number): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}K`;
  return `${(bytes / 1024 / 1024).toFixed(1)}M`;
}

// ── Entry node ───────────────────────────────────────────────────────────────

function EntryNode({ entry, basePath, depth, onFileSelect, selectedFile }: {
  entry: Entry; basePath: string; depth: number;
  onFileSelect: (path: string, name: string) => void;
  selectedFile?: string;
}) {
  const [open, setOpen] = useState(depth < 1);
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
      } catch { setChildren([]); }
      setLoading(false);
    }
    setOpen(v => !v);
  }, [open, children, fullPath, entry.type]);

  if (SKIP_DIRS.has(entry.name) && entry.type === "dir") return null;

  if (entry.type === "dir") {
    return (
      <div>
        <button
          className="w-full flex items-center gap-1.5 py-[3px] text-left rounded-md hover:bg-[#f0f0f0] transition-colors text-[12.5px] text-[#3f3f46] hover:text-[#0d0d0d]"
          style={{ paddingLeft: `${depth * 14 + 8}px`, paddingRight: "8px" }}
          onClick={expand}
        >
          {loading
            ? <Loader2 size={11} className="animate-spin text-[#9b9b9b] shrink-0" />
            : <ChevronRight size={11} className={`text-[#b5b5b5] transition-transform duration-150 shrink-0 ${open ? "rotate-90" : ""}`} />}
          {open
            ? <FolderOpen size={12} className="shrink-0 text-[#f59e0b]" />
            : <Folder size={12} className="shrink-0 text-[#f59e0b]" />}
          <span className="truncate">{entry.name}</span>
        </button>
        {open && children && children.map(c => (
          <EntryNode key={c.name} entry={c} basePath={fullPath} depth={depth + 1}
            onFileSelect={onFileSelect} selectedFile={selectedFile} />
        ))}
      </div>
    );
  }

  return (
    <button
      className={`w-full flex items-center gap-1.5 py-[3px] text-left rounded-md text-[12.5px] transition-all duration-100 ${
        isSelected
          ? "bg-[#0d0d0d] text-white"
          : "text-[#52525b] hover:bg-[#f0f0f0] hover:text-[#0d0d0d]"
      }`}
      style={{ paddingLeft: `${depth * 14 + 22}px`, paddingRight: "8px" }}
      onClick={() => onFileSelect(fullPath, entry.name)}
      title={entry.name}
    >
      <File size={11} className={`shrink-0 ${isSelected ? "text-white/60" : "text-[#c4c4c7]"}`} />
      <span className="truncate flex-1">{entry.name}</span>
      <span className={`text-[10px] shrink-0 ${isSelected ? "text-white/50" : "text-[#c4c4c7]"}`}>
        {formatSize(entry.size)}
      </span>
    </button>
  );
}

// ── Search results ───────────────────────────────────────────────────────────

function SearchResults({ results, loading, query, onFileSelect }: {
  results: SearchResult[]; loading: boolean; query: string;
  onFileSelect: (path: string, name: string) => void;
}) {
  if (!query) return null;
  return (
    <div className="flex-1 overflow-y-auto px-2 py-1">
      {loading && (
        <div className="flex items-center gap-2 px-2 py-3 text-[12px] text-[#9b9b9b]">
          <Loader2 size={12} className="animate-spin" /> Searching…
        </div>
      )}
      {!loading && results.length === 0 && (
        <div className="px-2 py-4 text-center text-[12px] text-[#b5b5b5]">
          No files matching <span className="font-mono text-[#6b6b6b]">"{query}"</span>
        </div>
      )}
      {!loading && results.map((r, i) => (
        <button
          key={i}
          className="w-full flex flex-col px-2 py-1.5 text-left rounded-md hover:bg-[#f0f0f0] transition-colors"
          onClick={() => onFileSelect(r.path, r.name)}
        >
          <span className="text-[12.5px] font-medium text-[#0d0d0d] truncate">
            {highlightMatch(r.name, query)}
          </span>
          <span className="text-[11px] text-[#9b9b9b] truncate">{r.dir}</span>
        </button>
      ))}
    </div>
  );
}

function highlightMatch(name: string, q: string): React.ReactNode {
  if (!q) return name;
  const idx = name.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return name;
  return (
    <>
      {name.slice(0, idx)}
      <mark className="bg-yellow-100 text-[#0d0d0d] rounded-sm">{name.slice(idx, idx + q.length)}</mark>
      {name.slice(idx + q.length)}
    </>
  );
}

// ── FileTree ─────────────────────────────────────────────────────────────────

export default function FileTree({ rootDir, agentName, onFileSelect, selectedFile }: Props) {
  const [entries, setEntries] = useState<Entry[] | null>(null);
  const [loadingTree, setLoadingTree] = useState(false);

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadingTree(true);
    try {
      const res = await fetch(`/api/fs?action=ls&path=${encodeURIComponent(rootDir)}&depth=2`);
      setEntries(await res.json());
    } catch { setEntries([]); }
    setLoadingTree(false);
  }, [rootDir]);

  // Reset and reload when rootDir changes
  useEffect(() => {
    setEntries(null);
    setQuery("");
    setSearchResults([]);
  }, [rootDir]);

  if (entries === null && !loadingTree) load();

  // Search debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) { setSearchResults([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const r = await fetch(`/api/fs?action=find&path=${encodeURIComponent(rootDir)}&q=${encodeURIComponent(q)}`);
        const d = await r.json();
        setSearchResults(Array.isArray(d) ? d : []);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 250);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, rootDir]);

  const isSearching = query.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden border-r border-[#e5e5e5]"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-[#ebebeb]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[12px] font-semibold text-[#0d0d0d] truncate">{agentName}</span>
        </div>
        {/* Search */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b5b5b5]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search files…"
            className="w-full text-[12px] bg-[#f4f4f5] border border-transparent rounded-lg pl-7 pr-6 py-1.5 text-[#0d0d0d] placeholder-[#9b9b9b] focus:outline-none focus:border-[#d4d4d8] focus:bg-white transition-all"
          />
          {query && (
            <button
              onClick={() => { setQuery(""); inputRef.current?.focus(); }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#b5b5b5] hover:text-[#6b6b6b]"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      {isSearching ? (
        <SearchResults
          results={searchResults} loading={searchLoading} query={query.trim()}
          onFileSelect={(p, n) => { onFileSelect(p, n); setQuery(""); }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto px-2 py-1.5">
          {loadingTree && (
            <div className="flex justify-center py-6">
              <Loader2 size={16} className="animate-spin text-[#b5b5b5]" />
            </div>
          )}
          {entries && entries.map(e => (
            <EntryNode key={e.name} entry={e} basePath={rootDir} depth={0}
              onFileSelect={onFileSelect} selectedFile={selectedFile} />
          ))}
        </div>
      )}
    </div>
  );
}
