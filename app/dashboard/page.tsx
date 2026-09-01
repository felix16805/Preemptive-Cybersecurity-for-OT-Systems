"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { SafeCutResult, AttackEvent, AttackPhase, CutEdge } from "@/types";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import { generateComparisonData } from "@/lib/cstr-model";
import AttackerConsole from "@/components/AttackerConsole";
import DefenderConsole from "@/components/DefenderConsole";
import CertificatePanel from "@/components/CertificatePanel";
import TechStackSlide from "@/components/TechStackSlide";

// D3 must be client-side only
const NetworkTopology = dynamic(() => import("@/components/NetworkTopology"), { ssr: false });
const ReactorChart    = dynamic(() => import("@/components/ReactorChart"),    { ssr: false });

// Pre-generate CSTR data once
const { safecutData, quarantineData } = generateComparisonData();

// Attack sequence timing (ms)
const ATTACK_SEQUENCE: Array<{ delay: number; phase: AttackPhase; desc: string; node?: string }> = [
  { delay: 800,  phase: "recon",            desc: "Scanning OT subnet (nmap -sV --script=modbus-discover)" },
  { delay: 2200, phase: "exploitation",     desc: "[!] Vulnerability found on PLC_02 port 502 (Modbus/TCP)" },
  { delay: 3600, phase: "lateral_movement", desc: "[!] Lateral movement: PLC_02 → PLC_01" },
  { delay: 4800, phase: "lateral_movement", desc: "[!] Lateral movement: PLC_02 → TEMP_SENSOR" },
  { delay: 5800, phase: "impact",           desc: "[CRITICAL] Unauthorized write to process register 40001" },
];

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
    clearTimers();
    setResult(null);
    setAlertSent(false);
    setCutEdges([]);
    setEvents([]);
    setChartMode("idle");
    setAttackPath([]);

    ATTACK_SEQUENCE.forEach(({ delay, phase, desc }) => {
      const t = setTimeout(() => {
        setPhase(phase);
        addEvent(phase, desc);
        if (phase === "lateral_movement") {
          setAttackPath((prev) => {
            if (prev.length === 0) return [targetNode, "PLC_01"];
            return [...prev, "TEMP_SENSOR"];
          });
        }
        if (phase === "exploitation") {
          setCompromisedNode(targetNode);
        }
      }, delay);
      timers.current.push(t);
    });
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

  // Show comparison chart when both are available
  const handleShowBoth = () => setChartMode("both");

  useEffect(() => () => clearTimers(), []);

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* ── Top nav ── */}
      <nav className="glass border-b border-white/5 px-6 py-3 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-accent-cyan font-black text-lg tracking-tight hover:opacity-80 transition-opacity">
            SafeCut
          </Link>
          <span className="text-text-muted text-xs">·</span>
          <span className="text-xs text-text-muted font-mono">OT Security Dashboard</span>
        </div>
        <div className="flex items-center gap-3">
          {chartMode !== "idle" && (
            <button
              onClick={handleShowBoth}
              className="text-xs px-3 py-1.5 rounded-lg border border-accent-cyan/30 text-accent-cyan hover:bg-accent-cyan/10 transition-all font-semibold"
            >
              Compare Both
            </button>
          )}
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border ${
            phase === "idle"      ? "border-text-muted/20 text-text-muted"       :
            phase === "contained" ? "border-accent-green/30 text-accent-green"   :
                                   "border-accent-red/30 text-accent-red"
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${
              phase === "idle"      ? "bg-text-muted"    :
              phase === "contained" ? "bg-accent-green"  :
                                     "bg-accent-red animate-pulse"
            }`} />
            {phase === "idle" ? "SYSTEM NOMINAL" : phase === "contained" ? "CONTAINED" : "THREAT ACTIVE"}
          </div>
        </div>
      </nav>

      {/* ── Main split ── */}
      <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 gap-0 min-h-0">

        {/* ═══ LEFT — RED TEAM ═══ */}
        <div className="border-r border-white/5 flex flex-col min-h-0">
          {/* Panel header */}
          <div className="glass-red border-b border-accent-red/10 px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
            <span className="text-xs font-bold tracking-widest uppercase text-accent-red/80">Red Team — Adversary</span>
          </div>

          <div className="flex-1 flex flex-col gap-0 overflow-hidden">
            {/* Network topology */}
            <div style={{ height: "320px" }} className="border-b border-white/5 p-2">
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
              />
            </div>
          </div>
        </div>

        {/* ═══ RIGHT — BLUE TEAM ═══ */}
        <div className="flex flex-col min-h-0">
          {/* Panel header */}
          <div className="glass-blue border-b border-accent-cyan/10 px-4 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-cyan" />
            <span className="text-xs font-bold tracking-widest uppercase text-accent-cyan/80">Blue Team — SafeCut Defender</span>
          </div>

          <div className="flex-1 flex flex-col gap-0 overflow-hidden">
            {/* Reactor chart */}
            <div style={{ height: "260px" }} className="border-b border-white/5 p-4">
              <ReactorChart
                safecutData={safecutData}
                quarantineData={quarantineData}
                mode={chartMode}
              />
            </div>

            {/* Defender + Certificate */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 overflow-hidden">
              <div className="p-4 border-r border-white/5 overflow-y-auto">
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
      </div>

      {/* ── Tech Stack Slide (bottom) ── */}
      <div className="border-t border-white/5 p-6">
        <TechStackSlide />
      </div>
    </div>
  );
}
