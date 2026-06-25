"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  code: string;
}

export default function MermaidBlock({ code }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            primaryColor: "#1f6feb",
            primaryTextColor: "#e6edf3",
            primaryBorderColor: "#30363d",
            lineColor: "#8b949e",
            sectionBkgColor: "#161b22",
            altSectionBkgColor: "#0d1117",
            sectionBkgColor2: "#21262d",
            gridColor: "#30363d",
            fontSize: "13px",
            background: "#0d1117",
            mainBkg: "#161b22",
            nodeBkg: "#161b22",
            nodeBorder: "#30363d",
            clusterBkg: "#0d1117",
            defaultLinkColor: "#58a6ff",
            edgeLabelBackground: "#161b22",
            actorBkg: "#161b22",
            actorBorder: "#30363d",
            actorTextColor: "#e6edf3",
          },
        });

        const id = `mermaid-${Math.random().toString(36).slice(2)}`;
        const { svg } = await mermaid.render(id, code);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          // Make SVG responsive
          const svgEl = ref.current.querySelector("svg");
          if (svgEl) {
            svgEl.removeAttribute("height");
            svgEl.style.maxWidth = "100%";
            svgEl.style.height = "auto";
          }
          setReady(true);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    }

    render();
    return () => { cancelled = true; };
  }, [code]);

  if (error) {
    return (
      <div className="my-3 rounded-md bg-[#161b22] border border-[#30363d] overflow-hidden">
        <div className="px-3 py-1.5 bg-[#21262d] text-[10px] text-gray-500 font-mono flex items-center gap-2">
          <span className="text-[#f85149]">●</span> mermaid (render error)
        </div>
        <pre className="px-3 py-2 text-[11px] text-gray-400 overflow-auto whitespace-pre">{code}</pre>
        <div className="px-3 py-1 text-[10px] text-red-400 border-t border-[#30363d]">{error}</div>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-md bg-[#161b22] border border-[#30363d] overflow-hidden">
      <div className="px-3 py-1.5 bg-[#21262d] text-[10px] text-gray-500 font-mono flex items-center gap-2">
        <span className="text-[#7ee787]">◆</span> diagram
      </div>
      <div
        ref={ref}
        className={`p-4 transition-opacity duration-200 ${ready ? "opacity-100" : "opacity-0"}`}
      />
    </div>
  );
}
