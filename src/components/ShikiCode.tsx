"use client";

import { useEffect, useState, useRef } from "react";

interface Props {
  code: string;
  lang: string;
  className?: string;
}

// Simple LRU cache keyed by "lang::code" to avoid re-fetching
const _cache = new Map<string, string>();
const _MAX_CACHE = 100;

function cacheGet(key: string) { return _cache.get(key); }
function cacheSet(key: string, val: string) {
  if (_cache.size >= _MAX_CACHE) {
    const first = _cache.keys().next().value;
    if (first !== undefined) _cache.delete(first);
  }
  _cache.set(key, val);
}

// Plain text escape for fallback rendering
function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export default function ShikiCode({ code, lang, className = "" }: Props) {
  const [html, setHtml] = useState<string>("");
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!code) return;

    const key = `${lang}::${code}`;
    const cached = cacheGet(key);
    if (cached) { setHtml(cached); return; }

    // Show plain escaped code immediately while fetching
    setHtml(`<pre style="margin:0;padding:0;font-family:monospace;font-size:12px;color:#e6edf3;white-space:pre">${escapeHtml(code)}</pre>`);

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    fetch("/api/highlight", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, lang }),
      signal: ctrl.signal,
    })
      .then((r) => r.json())
      .then((d) => {
        if (ctrl.signal.aborted) return;
        if (d.html) {
          cacheSet(key, d.html);
          setHtml(d.html);
        }
      })
      .catch(() => { /* aborted or network error — keep fallback */ });

    return () => ctrl.abort();
  }, [code, lang]);

  return (
    <div
      className={`shiki-wrapper overflow-auto ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
