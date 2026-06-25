"use client";

import { useState, useEffect, useRef } from "react";
import { Upload, Loader2, Check, ChevronDown, ChevronRight, BookOpen, FolderOpen } from "lucide-react";

interface Repo {
  name: string;
  category: string;
  description: string;
}

interface UserDoc {
  docId: string;
  title: string;
  topicCount: number;
  createdAt: string;
}

interface Props {
  /** Selected repo names for search context */
  selected: Set<string>;
  onToggleRepo: (name: string) => void;
  onSelectAll: () => void;
  onSelectNone: () => void;
  /** Selected user doc IDs */
  selectedDocs: Set<string>;
  onToggleDoc: (id: string) => void;
}

export default function KnowledgePanel({
  selected, onToggleRepo, onSelectAll, onSelectNone,
  selectedDocs, onToggleDoc,
}: Props) {
  const [repos, setRepos] = useState<Repo[]>([]);
  const [userDocs, setUserDocs] = useState<UserDoc[]>([]);
  const [everosOnline, setEverosOnline] = useState(false);
  const [reposOpen, setReposOpen] = useState(true);
  const [docsOpen, setDocsOpen] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/everos/sources")
      .then(r => r.json())
      .then(d => {
        setRepos(d.repos ?? []);
        setUserDocs(d.userDocs ?? []);
        setEverosOnline(d.everosOnline ?? false);
      })
      .catch(() => {});
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    setUploadMsg(null);
    const form = new FormData();
    form.append("file", file);
    form.append("title", file.name);
    try {
      const r = await fetch("/api/everos/upload", { method: "POST", body: form });
      const d = await r.json();
      if (d.error) { setUploadMsg(`✗ ${d.error}`); }
      else {
        setUploadMsg(`✓ Uploaded (${d.topic_count ?? 0} topics)`);
        setUserDocs(prev => [...prev, {
          docId: d.doc_id ?? "",
          title: file.name,
          topicCount: d.topic_count ?? 0,
          createdAt: new Date().toISOString(),
        }]);
      }
    } catch (e) {
      setUploadMsg(`✗ ${e}`);
    }
    setUploading(false);
    setTimeout(() => setUploadMsg(null), 4000);
  };

  const allSelected = repos.length > 0 && repos.every(r => selected.has(r.name));
  const someSelected = repos.some(r => selected.has(r.name));

  const groupedRepos = repos.reduce<Record<string, Repo[]>>((acc, r) => {
    (acc[r.category] ??= []).push(r);
    return acc;
  }, {});

  return (
    <div className="h-full flex flex-col bg-[#fafafa] border-r border-[#e5e5e5] overflow-hidden"
      style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#ebebeb]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[12px] font-semibold text-[#0d0d0d] uppercase tracking-wider">Knowledge</span>
          <div className={`w-1.5 h-1.5 rounded-full ${everosOnline ? "bg-green-500" : "bg-[#d4d4d8]"}`}
            title={everosOnline ? "EverOS online" : "EverOS offline"} />
        </div>
        {/* All / None */}
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={allSelected ? onSelectNone : onSelectAll}
            className={`flex-1 text-[11px] py-1 rounded-lg border transition-all ${
              allSelected
                ? "bg-[#0d0d0d] text-white border-[#0d0d0d]"
                : someSelected
                ? "bg-[#f4f4f5] text-[#3f3f46] border-[#e4e4e7]"
                : "bg-white text-[#6b6b6b] border-[#e4e4e7] hover:border-[#c4c4c7]"
            }`}
          >
            {allSelected ? "✓ All selected" : someSelected ? `${selected.size} selected` : "Select all"}
          </button>
          {someSelected && !allSelected && (
            <button onClick={onSelectNone}
              className="text-[11px] text-[#9b9b9b] hover:text-[#3f3f46] transition-colors">
              None
            </button>
          )}
        </div>
      </div>

      {/* Scrollable list */}
      <div className="flex-1 overflow-y-auto">

        {/* Repos section */}
        <div className="px-3 pt-3">
          <button
            className="flex items-center gap-1 text-[11px] font-semibold text-[#6b6b6b] uppercase tracking-wider mb-1.5 w-full"
            onClick={() => setReposOpen(v => !v)}
          >
            {reposOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <FolderOpen size={11} className="ml-0.5" />
            <span className="ml-1">Repos</span>
            <span className="ml-auto text-[#b5b5b5] font-normal">{repos.length}</span>
          </button>
          {reposOpen && Object.entries(groupedRepos).map(([cat, items]) => (
            <div key={cat} className="mb-2">
              <p className="text-[10px] text-[#b5b5b5] px-1 mb-1 uppercase">{cat}</p>
              {items.map(r => {
                const on = selected.has(r.name);
                return (
                  <button
                    key={r.name}
                    onClick={() => onToggleRepo(r.name)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all duration-100 ${
                      on ? "bg-[#eff6ff] text-[#1d4ed8]" : "hover:bg-[#f0f0f0] text-[#3f3f46]"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-all ${
                      on ? "bg-[#2563eb] border-[#2563eb]" : "border-[#d4d4d8]"
                    }`}>
                      {on && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-[12px] font-mono truncate">{r.name}</span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* User knowledge section */}
        <div className="px-3 pt-2 pb-3 border-t border-[#ebebeb] mt-1">
          <button
            className="flex items-center gap-1 text-[11px] font-semibold text-[#6b6b6b] uppercase tracking-wider mb-2 w-full"
            onClick={() => setDocsOpen(v => !v)}
          >
            {docsOpen ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
            <BookOpen size={11} className="ml-0.5" />
            <span className="ml-1">My Knowledge</span>
            {userDocs.length > 0 && <span className="ml-auto text-[#b5b5b5] font-normal">{userDocs.length}</span>}
          </button>

          {docsOpen && (
            <>
              {/* Upload button */}
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading || !everosOnline}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-dashed text-[12px] transition-all mb-2 ${
                  everosOnline
                    ? "border-[#d4d4d8] text-[#6b6b6b] hover:border-[#2563eb] hover:text-[#2563eb] hover:bg-[#eff6ff]"
                    : "border-[#e4e4e7] text-[#c4c4c7] cursor-not-allowed"
                }`}
              >
                {uploading
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Upload size={13} />}
                <span>{uploading ? "Uploading…" : everosOnline ? "Upload file / doc" : "EverOS offline"}</span>
              </button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".md,.txt,.pdf,.docx,.py,.ts,.js,.json,.yaml"
                onChange={e => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
              />

              {uploadMsg && (
                <p className={`text-[11px] px-1 mb-2 ${uploadMsg.startsWith("✓") ? "text-green-600" : "text-red-500"}`}>
                  {uploadMsg}
                </p>
              )}

              {userDocs.map(doc => {
                const on = selectedDocs.has(doc.docId);
                return (
                  <button
                    key={doc.docId}
                    onClick={() => onToggleDoc(doc.docId)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-all ${
                      on ? "bg-[#eff6ff] text-[#1d4ed8]" : "hover:bg-[#f0f0f0] text-[#3f3f46]"
                    }`}
                  >
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${
                      on ? "bg-[#2563eb] border-[#2563eb]" : "border-[#d4d4d8]"
                    }`}>
                      {on && <Check size={9} className="text-white" strokeWidth={3} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] truncate">{doc.title}</p>
                      <p className="text-[10px] text-[#9b9b9b]">{doc.topicCount} topics</p>
                    </div>
                  </button>
                );
              })}

              {userDocs.length === 0 && !uploading && (
                <p className="text-[11px] text-[#b5b5b5] px-1">No documents yet</p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
