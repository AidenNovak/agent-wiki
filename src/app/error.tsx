"use client";

import { useEffect } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Agent Explorer] route error:", error);
  }, [error]);

  return (
    <div className="h-screen flex flex-col items-center justify-center bg-[#0d1117] text-gray-300 px-8">
      <AlertCircle size={40} className="text-[#f85149] mb-4" />
      <h2 className="text-lg font-semibold text-gray-200 mb-2">Something went wrong</h2>
      <p className="text-gray-500 text-sm text-center max-w-md mb-2">
        {error.message ?? "An unexpected error occurred."}
      </p>
      {error.digest && (
        <p className="text-gray-700 text-xs font-mono mb-4">Digest: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="flex items-center gap-2 px-4 py-2 bg-[#21262d] border border-[#30363d] rounded-lg text-[13px] hover:bg-[#30363d] transition-colors"
      >
        <RefreshCw size={14} /> Try again
      </button>
    </div>
  );
}
