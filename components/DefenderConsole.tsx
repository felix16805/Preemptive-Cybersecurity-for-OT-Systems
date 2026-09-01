"use client";

import React from "react";
import type { SafeCutResult, AttackPhase } from "@/types";

interface Props {
  onSafeCut:   () => void;
  onQuarantine: () => void;
  onReset:     () => void;
  result:      SafeCutResult | null;
  isLoading:   boolean;
  alertSent:   boolean;
  currentPhase: AttackPhase;
}

export default function DefenderConsole({
  onSafeCut, onQuarantine, onReset,
  result, isLoading, alertSent, currentPhase,
}: Props) {
  const threatDetected = currentPhase === "impact" || currentPhase === "lateral_movement";
  const isContained    = currentPhase === "contained";

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2.5 h-2.5 rounded-full ${isContained ? "bg-accent-green" : threatDetected ? "bg-accent-red animate-pulse" : "bg-accent-cyan"}`} />
          <span className="text-xs font-bold tracking-widest uppercase text-accent-cyan">
            SafeCut Defender
          </span>
        </div>
        {result && (
          <span className="text-xs font-mono text-text-muted">
            Solved in {result.solveTimeMs.toFixed(3)} ms
          </span>
        )}
      </div>

      {/* ── Threat alert banner ── */}
      {threatDetected && !isContained && (
        <div className="glass-red rounded-xl p-4 flex flex-col gap-3 animate-slide-in relative overflow-hidden threat-scan border border-accent-red/30">
          <div className="flex items-center gap-3">
            <div className="text-2xl animate-pulse">⚠️</div>
            <div>
              <p className="text-sm font-bold text-accent-red">INTRUSION DETECTED</p>
              <p className="text-xs text-text-secondary font-mono">
                Unauthorized Modbus write to protected register
              </p>
            </div>
          </div>
          
          <div className="bg-bg-surface/50 border border-accent-red/20 rounded-lg p-2 flex items-center justify-between mt-1">
            <div className="text-[10px] font-mono text-text-muted">Target IP Match:</div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-accent-amber line-through opacity-70">EXTERNAL</span>
              <span className="text-accent-red">→</span>
              <span className="text-[11px] font-mono text-accent-red font-bold">192.168.10.102 (PLC_02)</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Response mode buttons ── */}
      <div className="glass rounded-xl p-3 flex flex-col gap-2">
        <p className="text-xs text-text-muted uppercase tracking-wide font-semibold mb-1">Incident Response</p>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={onSafeCut}
            disabled={isLoading || !threatDetected || isContained}
            className="group relative flex flex-col items-center gap-1 p-3 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 text-accent-cyan font-bold text-xs tracking-wide transition-all hover:bg-accent-cyan/20 hover:border-accent-cyan/50 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="text-lg">⚡</span>
            <span>SafeCut™</span>
            <span className="font-normal text-[10px] text-text-muted text-center">Safety-constrained isolation</span>
          </button>
          <button
            onClick={onQuarantine}
            disabled={isLoading || !threatDetected || isContained}
            className="group flex flex-col items-center gap-1 p-3 rounded-xl bg-accent-amber/10 border border-accent-amber/30 text-accent-amber font-bold text-xs tracking-wide transition-all hover:bg-accent-amber/20 hover:border-accent-amber/50 hover:scale-[1.02] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
          >
            <span className="text-lg">🔒</span>
            <span>Blind Quarantine</span>
            <span className="font-normal text-[10px] text-text-muted text-center">Legacy tool (compare)</span>
          </button>
        </div>
        <button
          onClick={onReset}
          className="w-full py-2 rounded-lg border border-text-muted/20 text-text-muted text-xs font-semibold hover:border-accent-cyan/20 hover:text-accent-cyan transition-all"
        >
          Reset Simulation
        </button>
      </div>

      {/* ── Result metrics ── */}
      {result && (
        <div className="glass rounded-xl p-3 animate-slide-in">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-text-muted uppercase tracking-wide font-semibold">Response Metrics</p>
            <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
              result.mode === "safecut"
                ? "bg-accent-cyan/10 text-accent-cyan"
                : "bg-accent-amber/10 text-accent-amber"
            }`}>
              {result.mode === "safecut" ? "SafeCut™" : "Quarantine"}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-bg-card rounded-lg p-2 text-center">
              <div className="text-lg font-black text-accent-cyan">{result.cutEdges.length}</div>
              <div className="text-[10px] text-text-muted">Links Severed</div>
            </div>
            <div className="bg-bg-card rounded-lg p-2 text-center">
              <div className={`text-lg font-black ${result.safetyLoopsPreserved === result.totalSafetyLoops ? "text-accent-green" : "text-accent-red"}`}>
                {result.safetyLoopsPreserved}/{result.totalSafetyLoops}
              </div>
              <div className="text-[10px] text-text-muted">SIF Loops</div>
            </div>
            <div className="bg-bg-card rounded-lg p-2 text-center">
              <div className={`text-lg font-black ${result.reactorStable ? "text-accent-green" : "text-accent-red"}`}>
                {result.reactorStable ? "✓" : "✗"}
              </div>
              <div className="text-[10px] text-text-muted">Reactor Safe</div>
            </div>
          </div>
          {!result.feasible && (
            <div className="mt-2 p-2 bg-accent-amber/10 border border-accent-amber/20 rounded-lg">
              <p className="text-xs text-accent-amber font-mono">⚠ INFEASIBLE: {result.infeasibilityReason}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Email alert status ── */}
      {alertSent && (
        <div className="glass rounded-xl p-3 flex items-center gap-3 animate-slide-in border border-accent-green/20">
          <div className="text-lg">📧</div>
          <div>
            <p className="text-xs font-bold text-accent-green">Alert Email Sent</p>
            <p className="text-xs text-text-muted font-mono">Nodemailer · SMTP · Incident log dispatched</p>
          </div>
          <div className="ml-auto w-2 h-2 rounded-full bg-accent-green" />
        </div>
      )}

      {/* ── Containment success ── */}
      {isContained && result?.mode === "safecut" && (
        <div className="glass rounded-xl p-4 text-center border border-accent-green/20 animate-slide-in">
          <div className="text-3xl mb-2">🛡️</div>
          <p className="text-sm font-bold text-accent-green">Attacker Contained</p>
          <p className="text-xs text-text-muted mt-1">
            {result.cutEdges.length} link{result.cutEdges.length !== 1 ? "s" : ""} severed · All {result.totalSafetyLoops} safety loops intact
          </p>
        </div>
      )}

      {isContained && result?.mode === "quarantine" && (
        <div className="glass-red rounded-xl p-4 text-center border border-accent-red/20 animate-slide-in">
          <div className="text-3xl mb-2">💥</div>
          <p className="text-sm font-bold text-accent-red">Safety Loop Severed!</p>
          <p className="text-xs text-text-muted mt-1">
            Blind quarantine cut the cooling loop · Reactor entering runaway
          </p>
        </div>
      )}
    </div>
  );
}
