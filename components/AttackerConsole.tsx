"use client";

import React, { useState, useEffect } from "react";
import type { AttackEvent, AttackPhase } from "@/types";

interface Props {
  onAttackStart: (node: string) => void;
  currentPhase: AttackPhase;
  events: AttackEvent[];
  compromisedNode: string;
}

const PHASE_LABELS: Record<AttackPhase, string> = {
  idle:             "IDLE",
  recon:            "RECONNAISSANCE",
  exploitation:     "EXPLOITATION",
  lateral_movement: "LATERAL MOVEMENT",
  impact:           "IMPACT",
  contained:        "CONTAINED",
};

const PHASE_COLORS: Record<AttackPhase, string> = {
  idle:             "text-text-muted",
  recon:            "text-accent-amber",
  exploitation:     "text-accent-red",
  lateral_movement: "text-accent-red",
  impact:           "text-accent-red",
  contained:        "text-accent-green",
};

const TARGET_NODES = ["PLC_01", "PLC_02", "PLC_03", "HMI", "SCADA"];

export default function AttackerConsole({ onAttackStart, currentPhase, events, compromisedNode }: Props) {
  const [selectedTarget, setSelectedTarget] = useState("PLC_02");
  const [typedText, setTypedText] = useState("");
  const terminalLines = [
    "$ nmap -sV --script=modbus-discover 192.168.1.0/24",
    "> Scanning OT subnet...",
    "> [OPEN] 192.168.1.12:502 (Modbus/TCP) — PLC_02",
    "$ python3 modbus_exploit.py --target PLC_02 --reg 40001",
    "> [!] Unauthorized write to process register 40001",
    "> [!] Lateral movement: PLC_02 → PLC_01",
    "> [!] Lateral movement: PLC_02 → TEMP_SENSOR",
  ];

  useEffect(() => {
    if (currentPhase === "idle") { setTypedText(""); return; }
    let i = 0;
    const text = terminalLines.slice(0, {
      recon: 2, exploitation: 4, lateral_movement: 6, impact: 7, contained: 7,
    }[currentPhase] ?? 0).join("\n");
    setTypedText("");
    const interval = setInterval(() => {
      setTypedText(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 18);
    return () => clearInterval(interval);
  }, [currentPhase]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${currentPhase === "idle" ? "bg-text-muted" : "bg-accent-red animate-pulse"}`} />
          <span className="text-xs font-bold tracking-widest uppercase text-accent-red">
            Attacker Console
          </span>
        </div>
        <span className={`text-xs font-mono font-semibold ${PHASE_COLORS[currentPhase]}`}>
          [{PHASE_LABELS[currentPhase]}]
        </span>
      </div>

      {/* ── Kill chain progress ── */}
      <div className="glass-red rounded-xl p-3">
        <p className="text-xs text-text-muted mb-2 uppercase tracking-wide font-semibold">Kill Chain</p>
        <div className="flex items-center gap-1">
          {(["recon", "exploitation", "lateral_movement", "impact"] as AttackPhase[]).map((phase, i) => {
            const phases: AttackPhase[] = ["idle", "recon", "exploitation", "lateral_movement", "impact", "contained"];
            const currentIdx = phases.indexOf(currentPhase);
            const phaseIdx = phases.indexOf(phase);
            const isActive  = phaseIdx === currentIdx;
            const isDone    = phaseIdx < currentIdx && currentPhase !== "contained";
            const labels = ["Recon", "Exploit", "Lateral", "Impact"];
            return (
              <React.Fragment key={phase}>
                <div className={`flex-1 text-center py-1.5 rounded text-xs font-semibold transition-all ${
                  isActive ? "bg-accent-red text-white" :
                  isDone   ? "bg-accent-red/30 text-accent-red" :
                             "bg-bg-card text-text-muted"
                }`}>
                  {labels[i]}
                </div>
                {i < 3 && (
                  <div className={`w-3 h-px ${isDone || isActive ? "bg-accent-red" : "bg-bg-card"}`} />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      {/* ── Target selector ── */}
      <div className="glass rounded-xl p-3 flex items-center gap-3">
        <label className="text-xs text-text-muted whitespace-nowrap font-mono">Target Node:</label>
        <select
          value={selectedTarget}
          onChange={(e) => setSelectedTarget(e.target.value)}
          disabled={currentPhase !== "idle"}
          className="flex-1 bg-bg-card border border-bg-hover rounded-lg px-3 py-1.5 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-red/50 disabled:opacity-50"
        >
          {TARGET_NODES.map((n) => (
            <option key={n} value={n}>{n}</option>
          ))}
        </select>
        <button
          onClick={() => onAttackStart(selectedTarget)}
          disabled={currentPhase !== "idle"}
          className="px-4 py-1.5 rounded-lg bg-accent-red text-white text-xs font-bold tracking-wide transition-all hover:bg-accent-red/80 disabled:opacity-40 disabled:cursor-not-allowed hover:scale-105"
        >
          LAUNCH
        </button>
      </div>

      {/* ── Terminal ── */}
      <div className="relative flex-1 glass rounded-xl p-3 font-mono text-xs text-accent-green overflow-hidden min-h-[100px]">
        <div className="absolute inset-0 scanlines pointer-events-none" />
        <div className="flex items-center gap-1.5 mb-2 pb-2 border-b border-white/5">
          <div className="w-2.5 h-2.5 rounded-full bg-accent-red/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent-amber/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-accent-green/60" />
          <span className="ml-2 text-text-muted text-xs">attack-shell</span>
        </div>
        <pre className="whitespace-pre-wrap text-[11px] leading-relaxed text-accent-green/80">
          {typedText}
          {currentPhase !== "idle" && <span className="cursor-blink text-accent-green">█</span>}
        </pre>
      </div>

      {/* ── Event log ── */}
      <div className="glass rounded-xl p-3 max-h-36 overflow-y-auto">
        <p className="text-xs text-text-muted mb-2 uppercase tracking-wide font-semibold">Event Log</p>
        {events.length === 0 ? (
          <p className="text-xs text-text-muted font-mono">No events yet.</p>
        ) : (
          <div className="flex flex-col gap-1">
            {[...events].reverse().map((ev, i) => (
              <div key={i} className="flex items-start gap-2 text-xs">
                <span className="text-text-muted font-mono text-[10px] whitespace-nowrap mt-0.5">
                  {new Date(ev.timestamp).toLocaleTimeString()}
                </span>
                <span className={`font-mono ${
                  ev.phase === "exploitation" || ev.phase === "impact" ? "text-accent-red" :
                  ev.phase === "lateral_movement" ? "text-accent-amber" :
                  ev.phase === "contained" ? "text-accent-green" : "text-text-secondary"
                }`}>
                  {ev.description}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
