"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import type { OTGraph } from "@/types";
import NetworkTopology from "@/components/NetworkTopology";

// ── Scenario definitions (predefined simulated attacks, no real exploitation) ──
const SCENARIOS = [
  {
    id: "recon_scan",
    label: "01 — Reconnaissance",
    eventType: "recon" as const,
    targetNode: "HMI",
    threatIp: "192.168.10.50",
    description: "Passive network scan. Discovered HMI on port 502 (Modbus/TCP). OS: VxWorks.",
    terminal: [
      "$ nmap -sV 192.168.10.0/24 --simulation-only",
      "[SCAN] Host: 192.168.10.50 (HMI)     Status: Open",
      "[SCAN] Port: 502/tcp   Service: Modbus/TCP",
      "[SCAN] OS Detection: VxWorks 6.9",
      "[INFO] Reconnaissance complete. Proceeding to exploitation phase.",
    ],
  },
  {
    id: "plc02_exploit",
    label: "02 — PLC Compromise",
    eventType: "exploitation" as const,
    targetNode: "PLC_02",
    threatIp: "192.168.10.102",
    description: "Unauthorized Modbus write to PLC_02 process register. Feed temp set to 430K.",
    terminal: [
      "$ modbus-write --host 192.168.10.102 --register 40001 --value 430 --simulation",
      "[EXPLOIT] Connecting to 192.168.10.102:502...",
      "[EXPLOIT] Function Code: 06 (Write Single Register)",
      "[EXPLOIT] Register 40001 (feed_temperature) → 430",
      "[SUCCESS] Register write acknowledged. PLC_02 compromised.",
    ],
  },
  {
    id: "lateral_scada",
    label: "03 — Lateral Movement",
    eventType: "lateral_movement" as const,
    targetNode: "SCADA",
    threatIp: "192.168.10.200",
    description: "Pivoting from PLC_02 to SCADA server via engineering workstation credentials.",
    terminal: [
      "$ lateral-pivot --from PLC_02 --to SCADA --simulation",
      "[LATERAL] Reusing credential fragment from memory dump...",
      "[LATERAL] Attempting connection to 192.168.10.200 (SCADA)...",
      "[LATERAL] Session established. Engineering workstation privileges obtained.",
      "[INFO] Lateral movement complete. HMI and Safety Controller accessible.",
    ],
  },
  {
    id: "safety_impact",
    label: "04 — Safety System Impact",
    eventType: "impact" as const,
    targetNode: "SAFETY_CTRL",
    threatIp: "192.168.10.210",
    description: "Attempted manipulation of Safety Controller — triggering automated incident response.",
    terminal: [
      "$ safety-manip --target SAFETY_CTRL --command INHIBIT_ESD --simulation",
      "[IMPACT] Targeting Safety Controller (SIS) at 192.168.10.210...",
      "[IMPACT] Attempting to inhibit Emergency Shutdown System...",
      "[ALERT] ⚠ INTRUSION DETECTED — AUTOMATED RESPONSE INITIATED",
      "[IMPACT] SafeCut isolation protocol triggered by defender.",
    ],
  },
];

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const color =
    status === "ACCEPTED" || status === "PROCESSED"
      ? "text-green-400 border-green-400/40 bg-green-400/10"
      : status === "PENDING"
      ? "text-yellow-400 border-yellow-400/40 bg-yellow-400/10"
      : "text-red-400 border-red-400/40 bg-red-400/10";
  return (
    <span className={`px-2 py-0.5 text-[10px] font-mono font-bold border rounded-sm ${color}`}>
      {status}
    </span>
  );
}

export default function AttackerPage() {
  const [sessionId, setSessionId] = useState("");
  const [sessionInput, setSessionInput] = useState("");
  const [topology, setTopology] = useState<OTGraph | null>(null);
  const [topologySource, setTopologySource] = useState<string>("loading");
  const [selectedScenario, setSelectedScenario] = useState(SCENARIOS[0]);
  const [events, setEvents] = useState<
    { eventId: string; eventType: string; targetNode: string; status: string; description: string; timestamp: string }[]
  >([]);
  const [terminalLines, setTerminalLines] = useState<string[]>([
    "SafeCut OT Cyber Range — Attacker Space",
    "⚠ SIMULATION MODE — No real attacks are executed.",
    "─────────────────────────────────────────────",
    "Provide a Session ID to begin.",
  ]);
  const [isRunning, setIsRunning] = useState(false);
  const [backendStatus, setBackendStatus] = useState<"ok" | "error" | "unknown">("unknown");
  const [phase, setPhase] = useState("idle");
  const termRef = useRef<HTMLDivElement>(null);

  const addLine = useCallback((line: string) => {
    setTerminalLines((prev) => [...prev, line]);
    setTimeout(() => termRef.current?.scrollTo({ top: 9999, behavior: "smooth" }), 50);
  }, []);

  // Load topology on mount
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

  // Join session
  const handleJoinSession = async () => {
    const id = sessionInput.trim() || `SAFECUT-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    try {
      const r = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: id }),
      });
      const data = await r.json();
      if (data.session) {
        setSessionId(data.session.sessionId);
        setPhase(data.session.phase);
        setEvents([]);
        addLine(`[SESSION] Joined session: ${data.session.sessionId}`);
        addLine("[READY] Select a scenario and click 'Run Simulation' to begin.");
      }
    } catch {
      addLine("[ERROR] Could not connect to backend session API.");
      setBackendStatus("error");
    }
  };

  // Run a scenario
  const handleRunScenario = async () => {
    if (!sessionId) {
      addLine("[ERROR] No session active. Join a session first.");
      return;
    }
    if (isRunning) return;

    setIsRunning(true);
    const eventId = `EVT-${Date.now().toString(36).toUpperCase()}`;
    const scenario = selectedScenario;

    addLine("");
    addLine(`[ATTACK] ═══ ${scenario.label.toUpperCase()} ═══`);
    addLine(`[ATTACK] Event ID: ${eventId}`);
    addLine(`[ATTACK] Target: ${scenario.targetNode} (${scenario.threatIp})`);
    addLine("");

    // Simulate terminal output with delays
    for (const line of scenario.terminal) {
      await new Promise((res) => setTimeout(res, 400));
      addLine(line);
    }

    // Send event to backend
    addLine("");
    addLine("[BACKEND] Submitting attack event to session...");
    try {
      const r = await fetch("/api/attack-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId,
          sessionId,
          targetNode: scenario.targetNode,
          threatIp: scenario.threatIp,
          eventType: scenario.eventType,
          description: scenario.description,
        }),
      });
      const data = await r.json();
      if (r.ok && data.success) {
        addLine(`[BACKEND] ✓ Event ACCEPTED. Session phase: ${data.session.phase.toUpperCase()}`);
        setPhase(data.session.phase);
        setEvents((prev) => [
          { eventId, eventType: scenario.eventType, targetNode: scenario.targetNode, status: "ACCEPTED", description: scenario.description, timestamp: new Date().toISOString() },
          ...prev,
        ]);
        setBackendStatus("ok");
      } else {
        addLine(`[BACKEND] ✗ Event REJECTED: ${data.error || "Unknown error"}`);
        setBackendStatus("error");
      }
    } catch {
      addLine("[BACKEND] ✗ Network error — backend unreachable.");
      setBackendStatus("error");
    }
    setIsRunning(false);
  };

  // Reset session
  const handleReset = async () => {
    if (!sessionId) return;
    try {
      await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, action: "reset" }),
      });
      setEvents([]);
      setPhase("idle");
      setTerminalLines(["[RESET] Session reset. Ready for new simulation."]);
    } catch {
      addLine("[ERROR] Reset failed.");
    }
  };

  const phaseColor =
    phase === "idle" ? "text-muted-foreground"
    : phase === "recon" ? "text-yellow-400"
    : phase === "exploitation" ? "text-orange-400"
    : phase === "lateral_movement" ? "text-orange-500"
    : phase === "impact" ? "text-red-500"
    : "text-green-400";

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="border-b border-white/10 bg-red-950/20 px-6 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="font-display font-bold text-lg text-red-400">SafeCut OT Cyber Range</div>
          <div className="px-2 py-0.5 bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-mono tracking-widest uppercase rounded-sm">
            ATTACKER SPACE
          </div>
          <div className="px-2 py-0.5 bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-[10px] font-mono uppercase rounded-sm">
            SIMULATION ONLY
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Session:</span>
            <span className="text-red-400 font-bold">{sessionId || "NONE"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">Phase:</span>
            <span className={`font-bold uppercase ${phaseColor}`}>{phase}</span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${backendStatus === "ok" ? "bg-green-400" : backendStatus === "error" ? "bg-red-400 animate-pulse" : "bg-yellow-400"}`}
            />
            <span className="text-muted-foreground">Backend: {backendStatus.toUpperCase()}</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Topology:</span>
            <span className={topologySource === "neo4j-live" ? "text-green-400" : "text-yellow-400"}>
              {topologySource === "neo4j-live" ? "LIVE DB" : topologySource === "in-memory-baseline" ? "SIMULATION" : topologySource}
            </span>
          </div>
        </div>
      </header>

      {/* ── Session join bar ─────────────────────────────────────────────── */}
      {!sessionId && (
        <div className="border-b border-white/10 bg-muted/30 px-6 py-4 flex items-center gap-4">
          <span className="text-sm font-mono text-muted-foreground shrink-0">Enter Session ID (or leave blank to auto-generate):</span>
          <input
            value={sessionInput}
            onChange={(e) => setSessionInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoinSession()}
            placeholder="SAFECUT-XXXX"
            className="flex-1 max-w-xs bg-muted border border-white/10 rounded-sm py-1.5 px-3 text-sm font-mono text-foreground focus:outline-none focus:border-red-500/50"
          />
          <button
            onClick={handleJoinSession}
            className="px-4 py-1.5 bg-red-600/20 border border-red-500/40 text-red-400 text-sm font-mono rounded-sm hover:bg-red-600/30 transition-colors"
          >
            Join Session
          </button>
          <a href="/defender" className="px-4 py-1.5 border border-white/10 text-muted-foreground text-sm font-mono rounded-sm hover:border-white/20 transition-colors">
            → Open Defender
          </a>
        </div>
      )}

      {/* ── Main 3-column layout ─────────────────────────────────────────── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[320px_1fr_280px] overflow-hidden">

        {/* LEFT — Topology ─────────────────────────────────────────────── */}
        <div className="border-r border-white/10 flex flex-col">
          <div className="px-4 py-2 border-b border-white/10 bg-muted/20 shrink-0">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Virtual OT Network</span>
          </div>
          <div className="flex-1 relative overflow-hidden min-h-[280px]">
            {topology ? (
              <NetworkTopology
                graph={topology}
                compromisedNode={events[0]?.targetNode ?? null}
                cutEdges={[]}
                attackPath={events.map((e) => e.targetNode)}
                mode={phase === "impact" || phase === "exploitation" ? "attacking" : "idle"}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm font-mono">
                {backendStatus === "error" ? "⚠ Could not load topology" : "Loading topology..."}
              </div>
            )}
          </div>
          {/* Event timeline */}
          <div className="border-t border-white/10 p-3 max-h-48 overflow-y-auto shrink-0">
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-2">Event Timeline</p>
            {events.length === 0 ? (
              <p className="text-xs text-muted-foreground font-mono opacity-50">No events yet.</p>
            ) : (
              events.map((ev) => (
                <div key={ev.eventId} className="flex items-center gap-2 text-xs font-mono mb-1.5">
                  <StatusBadge status={ev.status} />
                  <span className="text-muted-foreground shrink-0">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                  <span className="text-red-400 font-bold shrink-0">{ev.targetNode}</span>
                  <span className="text-muted-foreground truncate">{ev.eventType}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* CENTER — Terminal ───────────────────────────────────────────── */}
        <div className="flex flex-col border-r border-white/10 bg-[#0a0e14]">
          <div className="px-4 py-2 border-b border-white/10 bg-muted/10 shrink-0 flex items-center gap-3">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
            </div>
            <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">adversary-shell — SIMULATION</span>
          </div>
          <div
            ref={termRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-[11px] leading-relaxed text-green-400/90 space-y-0.5"
          >
            {terminalLines.map((line, i) => (
              <div
                key={i}
                className={
                  line.startsWith("[SUCCESS]") ? "text-green-400" :
                  line.startsWith("[ERROR]") || line.startsWith("[ALERT]") ? "text-red-400" :
                  line.startsWith("[EXPLOIT]") ? "text-orange-400" :
                  line.startsWith("[BACKEND]") ? "text-cyan-400" :
                  line.startsWith("[SESSION]") ? "text-blue-400" :
                  line.startsWith("[RESET]") ? "text-yellow-400" :
                  line.startsWith("⚠") ? "text-yellow-400 font-bold" :
                  line.startsWith("$") ? "text-white" :
                  "text-green-400/80"
                }
              >
                {line}
              </div>
            ))}
            {isRunning && (
              <div className="text-green-400 animate-pulse">▌</div>
            )}
          </div>
        </div>

        {/* RIGHT — Scenarios ───────────────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="px-4 py-2 border-b border-white/10 bg-muted/20 shrink-0">
            <span className="text-xs font-mono text-muted-foreground uppercase tracking-wider">Attack Scenarios</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {SCENARIOS.map((scenario) => (
              <button
                key={scenario.id}
                onClick={() => setSelectedScenario(scenario)}
                className={`w-full text-left p-3 rounded-sm border text-xs font-mono transition-colors ${
                  selectedScenario.id === scenario.id
                    ? "border-red-500/50 bg-red-500/10 text-red-300"
                    : "border-white/10 bg-muted/20 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                <div className="font-bold mb-1">{scenario.label}</div>
                <div className="text-[10px] opacity-70">Target: {scenario.targetNode}</div>
                <div className="text-[10px] opacity-70">Type: {scenario.eventType}</div>
              </button>
            ))}
          </div>

          {/* Run button */}
          <div className="border-t border-white/10 p-3 space-y-2 shrink-0">
            {sessionId ? (
              <>
                <button
                  onClick={handleRunScenario}
                  disabled={isRunning}
                  className="w-full py-3 bg-red-600/20 border border-red-500/40 text-red-400 font-mono font-bold text-sm rounded-sm hover:bg-red-600/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {isRunning ? "RUNNING..." : "▶ RUN SIMULATION"}
                </button>
                <button
                  onClick={handleReset}
                  className="w-full py-2 border border-white/10 text-muted-foreground font-mono text-xs rounded-sm hover:border-white/20 transition-colors"
                >
                  Reset Session
                </button>
                <a
                  href={`/defender?sessionId=${sessionId}`}
                  className="block w-full py-2 text-center border border-white/10 text-muted-foreground font-mono text-xs rounded-sm hover:border-cyan-500/30 hover:text-cyan-400 transition-colors"
                >
                  → Open Defender ({sessionId})
                </a>
              </>
            ) : (
              <div className="text-xs font-mono text-muted-foreground text-center p-2">
                Join a session to run scenarios.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
