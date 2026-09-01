"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { OTGraph, OTNode, CutEdge } from "@/types";

interface Props {
  graph: OTGraph;
  compromisedNode: string | null;
  cutEdges: CutEdge[];
  attackPath: string[];   // nodes in lateral movement sequence
  mode: "idle" | "attacking" | "safecut" | "quarantine";
}

// Node colours by type
const TYPE_COLOR: Record<OTNode["type"], string> = {
  PLC:               "#3b82f6",
  Sensor:            "#a78bfa",
  Actuator:          "#34d399",
  HMI:               "#f59e0b",
  SCADA:             "#f59e0b",
  Historian:         "#64748b",
  SafetyController:  "#22d3ee",
  Switch:            "#64748b",
};

export default function NetworkTopology({ graph, compromisedNode, cutEdges, attackPath, mode }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 760, height: 300 });

  // Track container size
  useEffect(() => {
    const el = svgRef.current?.parentElement;
    if (!el) return;
    const obs = new ResizeObserver(() => {
      setDimensions({ width: el.clientWidth, height: el.clientHeight });
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!svgRef.current || !graph.nodes.length) return;

    const { width, height } = dimensions;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // ── Defs: arrowheads & glows ─────────────────────────────────────────
    const defs = svg.append("defs");

    // Glow filter
    const glowFilter = defs.append("filter").attr("id", "glow").attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Attack glow (red)
    const attackGlow = defs.append("filter").attr("id", "attack-glow").attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    attackGlow.append("feGaussianBlur").attr("stdDeviation", "6").attr("result", "blur");
    const am = attackGlow.append("feMerge");
    am.append("feMergeNode").attr("in", "blur");
    am.append("feMergeNode").attr("in", "SourceGraphic");

    // Safety glow (cyan)
    const safetyGlow = defs.append("filter").attr("id", "safety-glow").attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    safetyGlow.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "blur");
    const sm = safetyGlow.append("feMerge");
    sm.append("feMergeNode").attr("in", "blur");
    sm.append("feMergeNode").attr("in", "SourceGraphic");

    // ── Data prep ────────────────────────────────────────────────────────
    const cutSet = new Set(
      cutEdges.flatMap((e) => [`${e.source}:${e.target}`, `${e.target}:${e.source}`])
    );
    const attackPathSet = new Set<string>();
    for (let i = 0; i < attackPath.length - 1; i++) {
      attackPathSet.add(`${attackPath[i]}:${attackPath[i + 1]}`);
      attackPathSet.add(`${attackPath[i + 1]}:${attackPath[i]}`);
    }

    const nodes = graph.nodes.map((n) => ({ ...n })) as (OTNode & d3.SimulationNodeDatum)[];
    const links = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      isSafetyLoop: e.isSafetyLoop,
    }));

    // ── Force simulation ─────────────────────────────────────────────────
    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(90).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(38));

    const container = svg.append("g");

    // ── Edges ────────────────────────────────────────────────────────────
    const linkG = container.append("g").selectAll("g").data(links).join("g");
    
    const link = linkG
      .append("line")
      .attr("stroke-width", (d) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (cutSet.has(key)) return 3;
        return d.isSafetyLoop ? 2.5 : 1.5;
      })
      .attr("stroke-dasharray", (d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (attackPathSet.has(key)) return "6 4";
        return d.isSafetyLoop ? "6 3" : "none";
      })
      .attr("stroke", (d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (cutSet.has(key)) return "#ef4444";
        if (attackPathSet.has(key)) return "#ef4444";
        if (d.isSafetyLoop) return mode === "safecut" ? "#4ade80" : "#22d3ee";
        return "#334155";
      })
      .attr("opacity", (d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (cutSet.has(key)) return 1;
        return 0.7;
      })
      .attr("class", (d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (cutSet.has(key)) return "animate-snap-fade";
        if (attackPathSet.has(key)) return "animate-dash-flow";
        if (d.isSafetyLoop && mode === "safecut") return "animate-pulse-green-once";
        return "";
      });

    // ── Cut Edge 'X' Glyphs ──────────────────────────────────────────────
    const cutX = linkG
      .filter((d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        return cutSet.has(key);
      })
      .append("text")
      .text("✕")
      .attr("fill", "#ef4444")
      .attr("font-size", "16")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("opacity", 0)
      .attr("class", "animate-fade-in");

    // ── Nodes ────────────────────────────────────────────────────────────
    const nodeG = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    // Isolation boundary
    nodeG
      .append("circle")
      .attr("r", 32)
      .attr("fill", "none")
      .attr("stroke", "#ef4444")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "4 4")
      .attr("opacity", (d) => (d.id === compromisedNode && (mode === "safecut" || mode === "quarantine") ? 0.6 : 0))
      .attr("class", (d) => (d.id === compromisedNode && (mode === "safecut" || mode === "quarantine") ? "animate-fade-in animate-dash-flow" : ""));

    // Outer ring
    nodeG
      .append("circle")
      .attr("r", 22)
      .attr("fill", "none")
      .attr("stroke", (d) => {
        if (d.id === compromisedNode) return "#ef4444";
        if (d.isSafetyCritical) return "#22d3ee";
        return "transparent";
      })
      .attr("stroke-width", (d) => (d.id === compromisedNode ? 3 : 2))
      .attr("opacity", 0.8)
      .attr("class", (d) => (d.id === compromisedNode ? "animate-pulse-red" : ""))
      .attr("filter", (d) => (d.id === compromisedNode ? "url(#attack-glow)" : d.isSafetyCritical ? "url(#safety-glow)" : "none"));

    // Main circle
    nodeG
      .append("circle")
      .attr("r", 17)
      .attr("fill", (d) => {
        if (d.id === compromisedNode) return "#450a0a";
        return TYPE_COLOR[d.type] + "22";
      })
      .attr("stroke", (d) => {
        if (d.id === compromisedNode) return "#ef4444";
        if (attackPath.includes(d.id) && d.id !== compromisedNode) return "#f59e0b";
        return TYPE_COLOR[d.type];
      })
      .attr("stroke-width", (d) => (d.id === compromisedNode ? 2.5 : 1.5))
      .attr("filter", (d) => (d.id === compromisedNode ? "url(#attack-glow)" : "none"));

    // Icon text (type initials)
    nodeG
      .append("text")
      .text((d) => {
        if (d.id === compromisedNode) return "☠";
        const icons: Record<OTNode["type"], string> = {
          PLC: "⚙", Sensor: "◈", Actuator: "⊕", HMI: "▦",
          SCADA: "◉", Historian: "⊞", SafetyController: "⊛", Switch: "◈",
        };
        return icons[d.type] ?? "●";
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("font-size", (d) => (d.id === compromisedNode ? "16" : "13"))
      .attr("fill", (d) => {
        if (d.id === compromisedNode) return "#ef4444";
        return TYPE_COLOR[d.type];
      });

    // Labels
    nodeG
      .append("text")
      .text((d) => d.id.replace("_", " "))
      .attr("text-anchor", "middle")
      .attr("y", 29)
      .attr("font-size", "9")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("fill", (d) => (d.id === compromisedNode ? "#f87171" : "#94a3b8"))
      .attr("font-weight", (d) => (d.id === compromisedNode ? "700" : "400"));

    // ── Drag + zoom ──────────────────────────────────────────────────────
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2.5])
      .on("zoom", (e) => container.attr("transform", e.transform.toString()));
    svg.call(zoom as any);

    const drag = d3.drag<SVGGElement, OTNode & d3.SimulationNodeDatum>()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    nodeG.call(drag as any);

    // ── Tick ─────────────────────────────────────────────────────────────
    sim.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);
      
      cutX
        .attr("x", (d: any) => (d.source.x + d.target.x) / 2)
        .attr("y", (d: any) => (d.source.y + d.target.y) / 2);

      nodeG.attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => { sim.stop(); };
  }, [graph, compromisedNode, cutEdges, attackPath, dimensions, mode]);

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      {/* Legend */}
      <div className="absolute bottom-2 left-2 flex flex-col gap-1 text-xs font-mono">
        {[
          { color: "#22d3ee", dash: true,  label: "Safety Loop Edge"   },
          { color: "#ef4444", dash: false, label: "Compromised / Cut"  },
          { color: "#f59e0b", dash: false, label: "Lateral Movement"   },
          { color: "#334155", dash: false, label: "Normal Link"        },
        ].map((l) => (
          <div key={l.label} className="flex items-center gap-2 opacity-70">
            <svg width="24" height="6">
              <line x1="0" y1="3" x2="24" y2="3" stroke={l.color} strokeWidth="1.5"
                strokeDasharray={l.dash ? "4 2" : "none"} />
            </svg>
            <span className="text-text-muted">{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
