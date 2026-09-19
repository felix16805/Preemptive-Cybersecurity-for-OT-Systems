"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { OTGraph, OTNode, CutEdge } from "@/types";

interface Props {
  graph: OTGraph;
  compromisedNode: string | null;
  cutEdges: CutEdge[];
  step: number;
}

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

export default function TopologyGraph({ graph, compromisedNode, cutEdges, step }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

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

    const defs = svg.append("defs");
    
    // Safety glow (cyan)
    const safetyGlow = defs.append("filter").attr("id", "safety-glow").attr("x", "-40%").attr("y", "-40%").attr("width", "180%").attr("height", "180%");
    safetyGlow.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    const sm = safetyGlow.append("feMerge");
    sm.append("feMergeNode").attr("in", "blur");
    sm.append("feMergeNode").attr("in", "SourceGraphic");

    const cutSet = new Set(
      cutEdges.flatMap((e) => [`${e.source}:${e.target}`, `${e.target}:${e.source}`])
    );

    const nodes = graph.nodes.map((n) => ({ ...n })) as (OTNode & d3.SimulationNodeDatum)[];
    const links = graph.edges.map((e) => ({
      source: e.source,
      target: e.target,
      isSafetyLoop: e.isSafetyLoop,
    }));

    const sim = d3
      .forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(120).strength(0.5))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(45));

    const container = svg.append("g");

    // Edges
    const linkG = container.append("g").selectAll("g").data(links).join("g");
    
    const link = linkG
      .append("line")
      .attr("stroke-width", (d) => d.isSafetyLoop ? 3 : 1.5)
      .attr("stroke-dasharray", (d: any) => d.isSafetyLoop ? "6 4" : "none")
      .attr("stroke", (d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (cutSet.has(key) && step > 0) return "#ef4444"; // Red for cut
        if (d.isSafetyLoop) {
          if (step === 2) return "#4ade80"; // Green for verified
          if (step === 3 && cutSet.has(key)) return "#ef4444"; // Red if severed in quarantine
          return "#22d3ee"; // Cyan otherwise
        }
        return "#334155";
      })
      .attr("opacity", (d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        if (cutSet.has(key) && step > 0) return 0.3; // Dim severed edges
        return 0.8;
      });

    // Cut Edge 'X' Glyphs
    const cutX = linkG
      .filter((d: any) => {
        const key = `${(d.source as any).id ?? d.source}:${(d.target as any).id ?? d.target}`;
        return cutSet.has(key) && step > 0;
      })
      .append("text")
      .text("✕")
      .attr("fill", "#ef4444")
      .attr("font-size", "20")
      .attr("font-weight", "bold")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central");

    // Nodes
    const nodeG = container
      .append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("cursor", "pointer");

    // Outer ring for compromised
    nodeG
      .append("circle")
      .attr("r", 26)
      .attr("fill", "none")
      .attr("stroke", (d) => d.id === compromisedNode && step > 0 ? "#ef4444" : "transparent")
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", "4 4");

    // Main circle
    nodeG
      .append("circle")
      .attr("r", 20)
      .attr("fill", "#111318") // Background color
      .attr("stroke", (d) => {
        if (d.id === compromisedNode && step > 0) return "#ef4444";
        if (d.isSafetyCritical) {
          if (step === 2) return "#4ade80";
          return "#22d3ee";
        }
        return TYPE_COLOR[d.type] ?? "#64748b";
      })
      .attr("stroke-width", 2)
      .attr("filter", (d) => d.isSafetyCritical ? "url(#safety-glow)" : "none");

    // Label
    nodeG
      .append("text")
      .text((d) => {
        const parts = d.label.split("\n");
        return parts[0];
      })
      .attr("text-anchor", "middle")
      .attr("y", 4)
      .attr("font-size", "10")
      .attr("font-family", "JetBrains Mono, monospace")
      .attr("fill", (d) => (d.id === compromisedNode && step > 0 ? "#f87171" : "#e2e8f0"))
      .attr("font-weight", "600");

    // Drag + zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 2.5])
      .on("zoom", (e) => container.attr("transform", e.transform.toString()));
    svg.call(zoom as any);

    const drag = d3.drag<SVGGElement, OTNode & d3.SimulationNodeDatum>()
      .on("start", (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
      .on("drag",  (e, d) => { d.fx = e.x; d.fy = e.y; })
      .on("end",   (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; });
    nodeG.call(drag as any);

    // Tick
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
  }, [graph, compromisedNode, cutEdges, step, dimensions]);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        className="w-full h-full"
      />
      
      {/* Legend */}
      <div className="absolute bottom-6 left-6 p-4 border border-white/10 bg-background/80 backdrop-blur-sm rounded-sm flex flex-col gap-3 font-mono text-xs">
        <div className="flex items-center gap-3">
          <div className="w-6 h-0.5 bg-[#22d3ee] shadow-[0_0_8px_rgba(34,211,238,0.8)] border-t-2 border-dashed border-[#22d3ee]" />
          <span className="text-muted-foreground">Safety Loop Edge (Capacity: ∞)</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-6 h-0.5 bg-slate-600" />
          <span className="text-muted-foreground">Standard OT Edge (Capacity: 1)</span>
        </div>
        {step > 0 && (
          <div className="flex items-center gap-3">
            <span className="text-destructive font-bold ml-1 mr-2">✕</span>
            <span className="text-muted-foreground">Severed Link</span>
          </div>
        )}
      </div>
    </div>
  );
}
