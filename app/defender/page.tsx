"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import type { OTGraph, SafeCutResult } from "@/types";
import NetworkTopology from "@/components/NetworkTopology";
import CertificatePanel from "@/components/CertificatePanel";
import ReactorChart from "@/components/ReactorChart";
import { generateComparisonData } from "@/lib/cstr-model";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

const { safecutData, quarantineData } = generateComparisonData();

// ── Backend status indicator ──────────────────────────────────────────────────
function BackendBadge({ status }: { status: "ok" | "error" | "unavailable" | "unknown" }) {
  const cfg = {
    ok: { dot: "bg-green-400", label: "CONNECTED" },
    error: { dot: "bg-red-400 animate-pulse", label: "ERROR" },
    unavailable: { dot: "bg-yellow-400", label: "DB UNAVAILABLE" },
    unknown: { dot: "bg-gray-400", label: "CHECKING..." },
  }[status];
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
      <span className="text-muted-foreground text-xs font-mono">{cfg.label}</span>
    </div>
  );
}

// ── Persistence badge ─────────────────────────────────────────────────────────
function PersistenceBadge({ status }: { status: "ok" | "unavailable" | "failed" | null }) {
  if (!status) return null;
  const cfg = {
    ok: "text-green-400 border-green-400/40 bg-green-400/10",
    unavailable: "text-yellow-400 border-yellow-400/40 bg-yellow-400/10",
    failed: "text-red-400 border-red-400/40 bg-red-400/10",
  }[status];
  const label = { ok: "PERSISTED", unavailable: "PERSISTENCE UNAVAILABLE", failed: "PERSISTENCE FAILED" }[status];
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded-sm ${cfg}`}>{label}</span>
  );
}

function DefenderContent() {
  const searchParams = useSearchParams();
  const initSessionId = searchParams.get("sessionId") || "";

  const [sessionId, setSessionId] = useState(initSessionId);
  const [sessionInput, setSessionInput] = useState(initSessionId);
  const [topology, setTopology] = useState<OTGraph | null>(null);
  const [topologySource, setTopologySource] = useState("loading");
  const [backendStatus, setBackendStatus] = useState<"ok" | "error" | "unavailable" | "unknown">("unknown");
  const [sessionPhase, setSessionPhase] = useState("idle");
  const [events, setEvents] = useState<any[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<any | null>(null);
  const [result, setResult] = useState<SafeCutResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [persistenceStatus, setPersistenceStatus] = useState<"ok" | "unavailable" | "failed" | null>(null);
  const [incidentId, setIncidentId] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"idle" | "safecut" | "quarantine" | "both">("idle");
  const [processingLog, setProcessingLog] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const addLog = useCallback((line: string) => {
    setProcessingLog((prev) => [...prev.slice(-50), `[${new Date().toLocaleTimeString()}] ${line}`]);
  }, []);

  // Load topology
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/topology");
        if (r.ok) {
          const data = await r.json();
          setTopology(data);
          setTopologySource(r.headers.get("x-topology-source") || "unknown");
          setBackendStatus("ok");
        } else {
          setBackendStatus("error");
        }
      } catch {
        setBackendStatus("error");
      }
    })();
  }, []);

  // Poll session for attacker events
  const pollSession = useCallback(async (sid: string) => {
    if (!sid) return;
    try {
      const r = await fetch(`/api/session?sessionId=${encodeURIComponent(sid)}`);
      if (!r.ok) return;
      const data = await r.json();
      if (data.session) {
        setSessionPhase(data.session.phase);
        setEvents(data.session.events || []);
        if (data.session.events?.length > 0 && !selectedEvent) {
          setSelectedEvent(data.session.events[data.session.events.length - 1]);
        }
        // Reflect response if already done
        if (data.session.lastResponse?.mode && data.session.phase === "contained") {
          setChartMode(data.session.lastResponse.mode);
        }
      }
    } catch {
      // Polling silently ignores transient errors
    }
  }, [selectedEvent]);

  // Join session
  const handleJoinSession = async () => {
    const sid = sessionInput.trim();
    if (!sid) return;
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: sid }),
      });
      const data = await r.json();
      if (data.session) {
        setSessionId(data.session.sessionId);
        setSessionPhase(data.session.phase);
        addLog(`Joined session ${data.session.sessionId}`);
        setBackendStatus("ok");
      }
    } catch {
      addLog("Could not connect to session API.");
      setBackendStatus("error");
    }
  };

  // Start polling when session is active
  useEffect(() => {
    if (!sessionId) return;
    pollSession(sessionId);
    pollRef.current = setInterval(() => pollSession(sessionId), 2000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [sessionId, pollSession]);

  // SafeCut response
  const handleSafeCut = async () => {
    const target = selectedEvent?.targetNode;
    if (!target || !sessionId) return;
    setIsLoading(true);
    setProcessingLog([]);
    addLog("Initiating SafeCut isolation algorithm...");
    addLog(`Target node: ${target}`);
    addLog("Running Edmonds-Karp min-cut solver...");

    try {
      const r = await fetch("/api/safecut", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          compromisedNode: target,
          threatIp: selectedEvent?.threatIp || "0.0.0.0",
        }),
      });
      const data = await r.json();
      if (r.ok && data.mode) {
        addLog(`SafeCut complete in ${data.solveTimeMs?.toFixed(3)} ms`);
        addLog(`Edges severed: ${data.cutEdges?.length ?? 0}`);
        addLog(`SIF loops preserved: ${data.safetyLoopsPreserved}/${data.totalSafetyLoops}`);
        addLog(data.certificate?.allPreserved ? "✓ Certificate: ALL SAFETY LOOPS VERIFIED" : "✗ Certificate: SAFETY BREACH");
        addLog(`Persistence: ${data.persistenceStatus?.toUpperCase() ?? "UNKNOWN"}`);
        setResult(data as SafeCutResult);
        setPersistenceStatus(data.persistenceStatus ?? null);
        setIncidentId(data.incidentId ?? null);
        setChartMode("safecut");
        // Refresh topology after isolation
        const tr = await fetch("/api/topology");
        if (tr.ok) setTopology(await tr.json());
      } else {
        addLog(`Error: ${data.error || "Unknown error from /api/safecut"}`);
        setBackendStatus("error");
      }
    } catch (err) {
      addLog("Network error — cannot reach backend.");
      setBackendStatus("error");
    }
    setIsLoading(false);
  };

  // Blind Quarantine response
  const handleQuarantine = async () => {
    const target = selectedEvent?.targetNode;
    if (!target || !sessionId) return;
    setIsLoading(true);
    setProcessingLog([]);
    addLog("Initiating Blind Quarantine (legacy IT tool)...");
    addLog(`Target node: ${target}`);
    addLog("Severing ALL connections indiscriminately...");

    try {
      const r = await fetch("/api/quarantine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          compromisedNode: target,
          threatIp: selectedEvent?.threatIp || "0.0.0.0",
        }),
      });
      const data = await r.json();
      if (r.ok && data.mode) {
        addLog(`Quarantine complete in ${data.solveTimeMs?.toFixed(3)} ms`);
        addLog(`Edges severed: ${data.cutEdges?.length ?? 0}`);
        addLog(`SIF loops preserved: ${data.safetyLoopsPreserved}/${data.totalSafetyLoops}`);
        addLog("⚠ Cooling loop severed — REACTOR THERMAL RUNAWAY!");
        addLog(`Persistence: ${data.persistenceStatus?.toUpperCase() ?? "UNKNOWN"}`);
        setResult(data as SafeCutResult);
        setPersistenceStatus(data.persistenceStatus ?? null);
        setIncidentId(data.incidentId ?? null);
        setChartMode("quarantine");
        const tr = await fetch("/api/topology");
        if (tr.ok) setTopology(await tr.json());
      } else {
        addLog(`Error: ${data.error || "Unknown error from /api/quarantine"}`);
        setBackendStatus("error");
      }
    } catch {
      addLog("Network error — cannot reach backend.");
      setBackendStatus("error");
    }
    setIsLoading(false);
  };

  // Reset
  const handleReset = async () => {
    if (!sessionId) return;
    await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, action: "reset" }),
    });
    setResult(null);
    setEvents([]);
    setSelectedEvent(null);
    setPersistenceStatus(null);
    setIncidentId(null);
    setChartMode("idle");
    setProcessingLog([]);
    addLog("Session reset. Awaiting new attack events...");
  };

  const threatDetected = events.length > 0 && (sessionPhase === "impact" || sessionPhase === "exploitation" || sessionPhase === "lateral_movement");
  const isContained = sessionPhase === "contained";

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-cyan-950/20 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="font-display font-bold text-lg text-cyan-400">SafeCut OT Cyber Range</div>
          <div className="px-2 py-0.5 bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 text-[10px] font-mono tracking-widest uppercase rounded-sm">
            DEFENDER SPACE
          </div>
          <div className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-mono uppercase rounded-sm">
            SIMULATION MODE
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Session:</span>
            <span className="text-cyan-400 font-bold">{sessionId || "NONE"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Phase:</span>
            <span className={`font-bold uppercase ${isContained ? "text-green-400" : threatDetected ? "text-red-400" : "text-muted-foreground"}`}>
              {sessionPhase}
            </span>
          </div>
          <BackendBadge status={backendStatus} />
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Topology:</span>
            <span className={topologySource === "neo4j-live" ? "text-green-400" : "text-yellow-400"}>
              {topologySource === "neo4j-live" ? "LIVE DB" : "SIMULATION"}
            </span>
          </div>
        </div>
      </header>

      {/* ── Session join ─────────────────────────────────────────────────── */}
      {!sessionId && (
        <div className="border-b border-white/10 bg-muted/30 px-6 py-4 flex items-center gap-4">
          <span className="text-sm font-mono text-muted-foreground shrink-0">Enter Session ID to monitor:</span>
          <input
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
            placeholder="SAFECUT-XXXX"
            className="flex-1 max-w-xs bg-muted border border-white/10 rounded-sm py-1.5 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-cyan-500/50"
          />
          <button
            onClick={handleJoinSession}
            className="px-4 py-1.5 bg-cyan-600/20 border border-cyan-500/40 text-cyan-400 text-sm font-mono rounded-sm hover:bg-cyan-600/30 transition-colors"
          >
            Join Session
          </button>
          <a href="/attacker" className="px-4 py-1.5 border border-white/10 text-muted-foreground text-sm font-mono rounded-sm hover:border-white/20 transition-colors">
            → Open Attacker
          </a>
        </div>
      )}

      {/* ── Main grid ────────────────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_340px] overflow-hidden">

        {/* LEFT — topology + alerts ───────────────────────────────────── */}
        <div className="flex flex-col border-r border-white/10 overflow-hidden">

          {/* Threat alert */}
          {threatDetected && !isContained && (
            <div className="mx-4 mt-4 p-4 bg-red-950/30 border border-red-500/40 rounded-sm shrink-0">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl animate-pulse">⚠️</span>
                <div>
                  <p className="text-sm font-bold text-red-400">INTRUSION DETECTED</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    Target: <span className="text-red-400">{selectedEvent?.targetNode}</span>
                    {" "}· IP: <span className="text-red-400">{selectedEvent?.threatIp}</span>
                    {" "}· Type: <span className="text-orange-400">{selectedEvent?.eventType?.toUpperCase()}</span>
                  </p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-mono mt-1">{selectedEvent?.description}</p>
            </div>
          )}

          {isContained && result && (
            <div className={`mx-4 mt-4 p-4 border rounded-sm shrink-0 ${result.mode === "safecut" ? "bg-green-950/20 border-green-500/30" : "bg-red-950/30 border-red-500/40"}`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">{result.mode === "safecut" ? "🛡️" : "💥"}</span>
                <div>
                  <p className={`text-sm font-bold ${result.mode === "safecut" ? "text-green-400" : "text-red-400"}`}>
                    {result.mode === "safecut" ? "CONTAINMENT SUCCESSFUL — SafeCut™" : "SAFETY BREACH — Blind Quarantine"}
                  </p>
                  <div className="flex items-center gap-3 mt-1">
                    <p className="text-xs font-mono text-muted-foreground">
                      Edges: {result.cutEdges.length} · Loops: {result.safetyLoopsPreserved}/{result.totalSafetyLoops} · {result.solveTimeMs.toFixed(3)} ms
                    </p>
                    <PersistenceBadge status={persistenceStatus} />
                    {incidentId && <span className="text-[10px] font-mono text-muted-foreground">ID: {incidentId.split("-")[0]}</span>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Topology */}
          <div className="flex-1 relative overflow-hidden min-h-[280px]">
            {topology ? (
              <NetworkTopology
                graph={topology}
                compromisedNode={selectedEvent?.targetNode ?? null}
                cutEdges={result?.cutEdges ?? []}
                attackPath={events.map((e) => e.targetNode)}
                mode={
                  isContained
                    ? (result?.mode === "safecut" ? "safecut" : "quarantine")
                    : threatDetected ? "attacking"
                    : "idle"
                }
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-mono">
                {backendStatus === "error" ? "⚠ Topology load failed" : "Loading OT topology..."}
              </div>
            )}
          </div>

          {/* Reactor chart */}
          <div className="border-t border-white/10 h-52 shrink-0 p-3">
            <ReactorChart
              safecutData={safecutData}
              quarantineData={quarantineData}
              mode={chartMode}
            />
          </div>
        </div>

        {/* RIGHT — Controls + Certificate + Log ───────────────────────── */}
        <div className="flex flex-col overflow-hidden">

          {/* Incident Alerts */}
          <div className="border-b border-white/10 p-3 shrink-0">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Live Incident Alerts</p>
            {events.length === 0 ? (
              <div className="text-xs font-mono text-muted-foreground opacity-50">
                {sessionId ? "Waiting for attack events..." : "Join a session to monitor alerts."}
              </div>
            ) : (
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {[...events].reverse().map((ev) => (
                  <button
                    key={ev.eventId}
                    onClick={() => setSelectedEvent(ev)}
                    className={`w-full text-left p-2 rounded-sm border text-xs font-mono transition-colors ${
                      selectedEvent?.eventId === ev.eventId
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-white/10 bg-muted/20 hover:border-white/20"
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-red-400 font-bold">{ev.targetNode}</span>
                      <span className="text-orange-400">{ev.eventType}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-muted-foreground truncate text-[10px]">{ev.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Response Actions */}
          <div className="border-b border-white/10 p-3 shrink-0">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Incident Response</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleSafeCut}
                disabled={isLoading || !threatDetected || isContained || !sessionId}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-sm border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 font-mono text-xs font-bold hover:bg-cyan-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-lg">⚡</span>
                <span>SafeCut™</span>
                <span className="text-[10px] font-normal text-muted-foreground text-center">Safety-constrained</span>
              </button>
              <button
                onClick={handleQuarantine}
                disabled={isLoading || !threatDetected || isContained || !sessionId}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-sm border border-yellow-500/30 bg-yellow-500/10 text-yellow-400 font-mono text-xs font-bold hover:bg-yellow-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <span className="text-lg">🔒</span>
                <span>Blind Quarantine</span>
                <span className="text-[10px] font-normal text-muted-foreground text-center">Legacy (compare)</span>
              </button>
            </div>
            <button
              onClick={handleReset}
              className="w-full mt-2 py-1.5 border border-white/10 text-muted-foreground text-xs font-mono rounded-sm hover:border-white/20 transition-colors"
            >
              Reset Simulation
            </button>
          </div>

          {/* Safety Certificate */}
          <div className="border-b border-white/10 p-3 shrink-0">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Safety Certificate</p>
            <CertificatePanel certificate={result?.certificate ?? null} isLoading={isLoading} />
          </div>

          {/* Processing Log */}
          <div className="flex-1 overflow-y-auto p-3">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Response Log</p>
            {processingLog.length === 0 ? (
              <p className="text-xs font-mono text-muted-foreground opacity-50">No actions taken yet.</p>
            ) : (
              <div className="space-y-0.5">
                {processingLog.map((line, i) => (
                  <div key={i} className={`text-[10px] font-mono ${
                    line.includes("✓") ? "text-green-400" :
                    line.includes("✗") || line.includes("⚠") || line.includes("Error") ? "text-red-400" :
                    line.includes("UNAVAILABLE") ? "text-yellow-400" :
                    "text-muted-foreground"
                  }`}>
                    {line}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Navigation footer */}
          <div className="border-t border-white/10 p-3 flex gap-2 shrink-0">
            <a href="/attacker" className="flex-1 text-center py-1.5 border border-white/10 text-muted-foreground text-xs font-mono rounded-sm hover:border-red-500/30 hover:text-red-400 transition-colors">
              → Attacker
            </a>
            <a href="/console" className="flex-1 text-center py-1.5 border border-white/10 text-muted-foreground text-xs font-mono rounded-sm hover:border-primary/30 hover:text-primary transition-colors">
              → Console
            </a>
            <a href="/simulation" className="flex-1 text-center py-1.5 border border-white/10 text-muted-foreground text-xs font-mono rounded-sm hover:border-cyan-500/30 hover:text-cyan-400 transition-colors">
              → Simulation
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DefenderPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-muted-foreground font-mono">Loading Defender Space...</div>}>
      <DefenderContent />
    </Suspense>
  );
}
