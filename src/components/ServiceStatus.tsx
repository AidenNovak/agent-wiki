"use client";

import { useState, useEffect, useCallback } from "react";
import { Wifi, WifiOff, Loader2 } from "lucide-react";

type Status = "checking" | "ok" | "error";

interface ServiceState {
  everos: Status;
  errorMsg?: string;
}

const CHECK_INTERVAL = 30_000; // 30 s

export default function ServiceStatus() {
  const [state, setState] = useState<ServiceState>({ everos: "checking" });
  const [tooltip, setTooltip] = useState(false);

  const check = useCallback(async () => {
    setState((s) => ({ ...s, everos: "checking" }));
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const r = await fetch("http://127.0.0.1:8000/health", { signal: ctrl.signal });
      clearTimeout(t);
      const d = await r.json();
      setState({ everos: d.status === "ok" ? "ok" : "error", errorMsg: d.status !== "ok" ? "Unexpected status" : undefined });
    } catch (e) {
      setState({ everos: "error", errorMsg: String(e) });
    }
  }, []);

  useEffect(() => {
    check();
    const id = setInterval(check, CHECK_INTERVAL);
    return () => clearInterval(id);
  }, [check]);

  const { everos, errorMsg } = state;

  const icon =
    everos === "checking" ? <Loader2 size={12} className="animate-spin text-gray-500" /> :
    everos === "ok" ? <Wifi size={12} className="text-[#56d364]" /> :
    <WifiOff size={12} className="text-[#f85149]" />;

  const label =
    everos === "checking" ? "EverOS…" :
    everos === "ok" ? "EverOS" :
    "EverOS offline";

  const color =
    everos === "checking" ? "text-gray-500" :
    everos === "ok" ? "text-[#56d364]" :
    "text-[#f85149]";

  return (
    <div className="relative">
      <button
        className={`flex items-center gap-1 text-[10px] font-mono ${color} hover:opacity-80 transition-opacity`}
        onClick={() => setTooltip((v) => !v)}
        title={everos === "error" ? `EverOS unreachable: ${errorMsg}` : "EverOS Knowledge + Memory API"}
      >
        {icon}
        <span>{label}</span>
      </button>

      {tooltip && (
        <div className="absolute right-0 top-6 z-50 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl p-3 w-64 text-[11px]">
          <div className="font-semibold text-gray-200 mb-2">Service Status</div>

          <StatusRow
            name="EverOS API"
            url="http://127.0.0.1:8000"
            status={everos}
            errorMsg={errorMsg}
          />
          <StatusRow
            name="Agent Explorer"
            url="http://127.0.0.1:3001"
            status="ok"
          />

          {everos === "error" && (
            <div className="mt-2 p-2 bg-[#3a1b1b] rounded text-red-400 text-[10px] break-all">
              <div className="font-semibold mb-0.5">Fix:</div>
              Start EverOS via launchd:<br />
              <code className="font-mono">launchctl start ai.evermind.everos</code>
            </div>
          )}

          <button
            className="mt-2 w-full text-center text-[10px] text-gray-500 hover:text-gray-300 border border-[#30363d] rounded py-1 hover:bg-[#21262d] transition-colors"
            onClick={() => { check(); setTooltip(false); }}
          >
            Refresh
          </button>
        </div>
      )}
    </div>
  );
}

function StatusRow({
  name, url, status, errorMsg,
}: {
  name: string;
  url: string;
  status: Status;
  errorMsg?: string;
}) {
  const dot = status === "ok"
    ? "bg-[#56d364]"
    : status === "error"
    ? "bg-[#f85149]"
    : "bg-yellow-400 animate-pulse";

  return (
    <div className="flex items-start justify-between gap-2 py-1 border-b border-[#21262d] last:border-0">
      <div>
        <div className="text-gray-300">{name}</div>
        <div className="text-gray-600 font-mono text-[9px]">{url}</div>
        {errorMsg && status === "error" && (
          <div className="text-red-400 text-[9px] mt-0.5 break-all">{errorMsg.slice(0, 80)}</div>
        )}
      </div>
      <div className="flex items-center gap-1 mt-0.5 shrink-0">
        <div className={`w-2 h-2 rounded-full ${dot}`} />
        <span className={status === "ok" ? "text-[#56d364]" : status === "error" ? "text-[#f85149]" : "text-yellow-400"}>
          {status === "checking" ? "…" : status}
        </span>
      </div>
    </div>
  );
}
