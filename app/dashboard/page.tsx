"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import type { SafeCutResult, AttackEvent, AttackPhase, CutEdge } from "@/types";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import { generateComparisonData } from "@/lib/cstr-model";
import AttackerConsole from "@/components/AttackerConsole";
import DefenderConsole from "@/components/DefenderConsole";
import CertificatePanel from "@/components/CertificatePanel";
import SharedNav from "@/components/SharedNav";
import SharedFooter from "@/components/SharedFooter";

// D3 must be client-side only
const NetworkTopology = dynamic(() => import("@/components/NetworkTopology"), { ssr: false });
const ReactorChart    = dynamic(() => import("@/components/ReactorChart"),    { ssr: false });

// Pre-generate CSTR data once
const { safecutData, quarantineData } = generateComparisonData();

export default function DashboardPage() {
  const [phase,           setPhase]           = useState<AttackPhase>("idle");
  const [compromisedNode, setCompromisedNode] = useState<string | null>(null);
  const [attackPath,      setAttackPath]      = useState<string[]>([]);
  const [events,          setEvents]          = useState<AttackEvent[]>([]);
  const [result,          setResult]          = useState<SafeCutResult | null>(null);
  const [isLoading,       setIsLoading]       = useState(false);
  const [alertSent,       setAlertSent]       = useState(false);
  const [cutEdges,        setCutEdges]        = useState<CutEdge[]>([]);
  const [chartMode,       setChartMode]       = useState<"idle" | "safecut" | "quarantine" | "both">("idle");

  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  const addEvent = useCallback((phase: AttackPhase, description: string, targetNode?: string) => {
    setEvents((prev) => [...prev, {
      timestamp: new Date().toISOString(),
      phase,
      description,
      targetNode,
    }]);
  }, []);

  // ── Launch attack sequence ────────────────────────────────────────────────
  const handleAttackStart = useCallback((targetNode: string) => {
    // This will be invoked by the new Command Console when it executes 'exploit'
    clearTimers();
    setResult(null);
    setAlertSent(false);
    setCutEdges([]);
    setEvents([]);
    setChartMode("idle");
    setAttackPath([]);

    // The sequence is now driven by the console commands, but if we need a scripted auto-sequence:
    // (We will move this logic partly to the console or keep it here and let the console trigger phases)
    // For now, let's just trigger detection.
    setPhase("exploitation");
    setCompromisedNode(targetNode);
    addEvent("exploitation", `[CRITICAL] Unauthorized access detected on ${targetNode}`);
    
    // Trigger the initial detection email alert
    fetch("/api/alert", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nodeId: targetNode, ip: "192.168.10.102" })
    }).catch(console.error);
    
    // Simulate lateral movement automatically after exploit (as before)
    const t1 = setTimeout(() => {
      setPhase("lateral_movement");
      setAttackPath([targetNode, "PLC_01"]);
      addEvent("lateral_movement", `[!] Lateral movement: ${targetNode} → PLC_01`);
    }, 2000);
    
    const t2 = setTimeout(() => {
      setAttackPath([targetNode, "PLC_01", "TEMP_SENSOR"]);
      addEvent("lateral_movement", `[!] Lateral movement: ${targetNode} → TEMP_SENSOR`);
    }, 4000);

    const t3 = setTimeout(() => {
      setPhase("impact");
      addEvent("impact", `[CRITICAL] Unauthorized write to process register`);
    }, 6000);

    timers.current.push(t1, t2, t3);
  }, [addEvent]);

  // ── SafeCut response ──────────────────────────────────────────────────────
  const handleSafeCut = useCallback(async () => {
    if (!compromisedNode) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/safecut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compromisedNode }),
      });
      const data: SafeCutResult = await res.json();
      setResult(data);
      setCutEdges(data.cutEdges);
      setPhase("contained");
      setChartMode("safecut");
      setAlertSent(true);
      addEvent("contained", `SafeCut applied — ${data.cutEdges.length} links severed, ${data.safetyLoopsPreserved}/${data.totalSafetyLoops} SIF loops preserved`);
    } catch (err) {
      console.error("SafeCut API error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [compromisedNode, addEvent]);

  // ── Blind quarantine response ─────────────────────────────────────────────
  const handleQuarantine = useCallback(async () => {
    if (!compromisedNode) return;
    setIsLoading(true);
    try {
      const res = await fetch("/api/quarantine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compromisedNode }),
      });
      const data: SafeCutResult = await res.json();
      setResult(data);
      setCutEdges(data.cutEdges);
      setPhase("contained");
      setChartMode("quarantine");
      setAlertSent(true);
      addEvent("contained", `Blind quarantine applied — ${data.safetyLoopsPreserved}/${data.totalSafetyLoops} SIF loops preserved. ⚠ Reactor runaway!`);
    } catch (err) {
      console.error("Quarantine API error:", err);
    } finally {
      setIsLoading(false);
    }
  }, [compromisedNode, addEvent]);

  // ── Reset ─────────────────────────────────────────────────────────────────
  const handleReset = useCallback(() => {
    clearTimers();
    setPhase("idle");
    setCompromisedNode(null);
    setAttackPath([]);
    setEvents([]);
    setResult(null);
    setIsLoading(false);
    setAlertSent(false);
    setCutEdges([]);
    setChartMode("idle");
  }, []);

  const handleShowBoth = () => setChartMode("both");

  useEffect(() => () => clearTimers(), []);

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <SharedNav />
      
      {/* ── Sub-header ── */}
      <div className="border-b border-white/5 px-6 py-2 flex items-center justify-between bg-bg-surface/50">
        <div className="text-xs text-text-muted font-mono flex items-center gap-4">
          <span>Live Simulation Environment</span>
          <span className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-accent-amber/30 bg-accent-amber/10 text-[10px] font-semibold text-accent-amber uppercase tracking-wider">
            No Real Network Access
          </span>
        </div>
        <div className="flex items-center gap-3">
          {chartMode !== "idle" && (
            <button
              onClick={handleShowBoth}
              className="text-xs px-3 py-1 rounded-lg border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 transition-all font-semibold"
            >
              Compare Both
            </button>
          )}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border ${
            phase === "idle"      ? "border-text-muted/20 text-text-muted"       :
            phase === "contained" ? "border-accent-green/30 text-accent-green"   :
                                   "border-accent-red/30 text-accent-red"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              phase === "idle"      ? "bg-text-muted"    :
              phase === "contained" ? "bg-accent-green"  :
                                     "bg-accent-red animate-pulse"
            }`} />
            {phase === "idle" ? "System Nominal" : phase === "contained" ? "Contained" : "Threat Active"}
          </div>
        </div>
      </div>

      {/* ── Main split (60/40 Defender First) ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-5 gap-0 min-h-0">

        {/* ═══ LEFT (60%) — BLUE TEAM ═══ */}
        <div className="lg:col-span-3 border-r border-white/5 flex flex-col min-h-0 order-1">
          {/* Panel header */}
          <div className="bg-bg-surface/80 border-b border-white/5 px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-cyan" />
            <span className="text-[11px] font-bold tracking-widest uppercase text-text-primary">Defender Console</span>
          </div>

          <div className="flex-1 flex flex-col gap-0 overflow-hidden">
            {/* Reactor chart */}
            <div style={{ height: "260px" }} className="border-b border-white/5 p-4 bg-bg-base relative">
              <ReactorChart
                safecutData={safecutData}
                quarantineData={quarantineData}
                mode={chartMode}
              />
            </div>

            {/* Defender + Certificate */}
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-0 overflow-hidden bg-bg-surface/30">
              <div className="p-4 border-b xl:border-b-0 xl:border-r border-white/5 overflow-y-auto">
                <DefenderConsole
                  onSafeCut={handleSafeCut}
                  onQuarantine={handleQuarantine}
                  onReset={handleReset}
                  result={result}
                  isLoading={isLoading}
                  alertSent={alertSent}
                  currentPhase={phase}
                />
              </div>
              <div className="p-4 overflow-y-auto">
                <CertificatePanel
                  certificate={result?.certificate ?? null}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ═══ RIGHT (40%) — RED TEAM ═══ */}
        <div className="lg:col-span-2 flex flex-col min-h-0 order-2 bg-bg-base">
          {/* Panel header */}
          <div className="bg-bg-surface/80 border-b border-white/5 px-4 py-2 flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${phase !== "idle" && phase !== "contained" ? "bg-accent-red animate-pulse" : "bg-text-muted"}`} />
            <span className="text-[11px] font-bold tracking-widest uppercase text-text-primary">Attacker Console</span>
            <span className="ml-auto text-[10px] font-mono text-text-muted px-2 py-0.5 rounded border border-white/10">SIMULATED</span>
          </div>

          <div className="flex-1 flex flex-col gap-0 overflow-hidden">
            {/* Network topology */}
            <div style={{ height: "350px" }} className="border-b border-white/5 p-2 bg-bg-base/50">
              <NetworkTopology
                graph={OT_TOPOLOGY}
                compromisedNode={compromisedNode}
                cutEdges={cutEdges}
                attackPath={attackPath}
                mode={phase === "idle" ? "idle" : phase === "contained" ? (result?.mode === "safecut" ? "safecut" : "quarantine") : "attacking"}
              />
            </div>

            {/* Attacker console */}
            <div className="flex-1 p-4 overflow-y-auto">
              <AttackerConsole
                onAttackStart={handleAttackStart}
                currentPhase={phase}
                events={events}
                compromisedNode={compromisedNode ?? ""}
                addEvent={addEvent}
                setPhase={setPhase}
              />
            </div>
          </div>
        </div>

      </div>

      <SharedFooter />
    </div>
  );
}
