"use client";

import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

type Status = "checking" | "ok" | "error";

export default function ServiceStatus() {
  const [everos, setEveros] = useState<Status>("checking");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [panel, setPanel] = useState(false);

  const check = useCallback(async () => {
    setEveros("checking");
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("http://127.0.0.1:8000/health", { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      setEveros(d.status === "ok" ? "ok" : "error");
      setErrMsg(d.status !== "ok" ? "Unexpected status" : null);
    } catch (e) {
      setEveros("error");
      setErrMsg(String(e));
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [check]);

  const color = everos === "ok" ? "#16a34a" : everos === "error" ? "#dc2626" : "#9b9b9b";
  const label = everos === "ok" ? "EverOS" : everos === "error" ? "EverOS offline" : "…";

  return (
    <div className="relative">
      <button
        onClick={() => setPanel(v => !v)}
        className="flex items-center gap-1.5 text-[12px] text-[#6b6b6b] hover:text-[#0d0d0d] transition-colors"
        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {everos === "checking"
          ? <Loader2 size={12} className="animate-spin" />
          : everos === "ok"
          ? <Wifi size={12} style={{ color }} />
          : <WifiOff size={12} style={{ color }} />}
        <span style={{ color }}>{label}</span>
      </button>

      {panel && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPanel(false)} />
          <div className="absolute right-0 top-7 z-50 bg-white border border-[#e5e5e5] rounded-2xl shadow-lg p-4 w-56 text-[12px]"
            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>
            <p className="font-semibold text-[#0d0d0d] mb-3">Service Status</p>
            <Row label="EverOS API" url="http://127.0.0.1:8000" status={everos} errMsg={errMsg} />
            <Row label="Agent Explorer" url="http://127.0.0.1:3001" status="ok" />
            {everos === "error" && (
              <div className="mt-3 p-2 bg-red-50 border border-red-100 rounded-xl text-[11px] text-red-600">
                <code className="block">launchctl start ai.evermind.everos</code>
              </div>
            )}
            <button
              onClick={() => { check(); setPanel(false); }}
              className="mt-3 w-full py-1.5 text-center text-[11px] text-[#6b6b6b] border border-[#e5e5e5] rounded-xl hover:bg-[#f7f7f8] transition-colors"
            >
              Refresh
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function Row({ label, url, status, errMsg }: { label: string; url: string; status: Status; errMsg?: string | null }) {
  const dot = status === "ok" ? "bg-green-500" : status === "error" ? "bg-red-500" : "bg-yellow-400 animate-pulse";
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#f4f4f5] last:border-0">
      <div>
        <p className="text-[#3f3f46]">{label}</p>
        <p className="text-[10px] text-[#9b9b9b] font-mono">{url}</p>
        {errMsg && status === "error" && (
          <p className="text-[10px] text-red-500 mt-0.5 break-all">{errMsg.slice(0, 60)}</p>
        )}
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={status === "ok" ? "text-green-600" : status === "error" ? "text-red-500" : "text-[#9b9b9b]"}>
          {status === "checking" ? "…" : status}
        </span>
      </div>
    </div>
  );
}
