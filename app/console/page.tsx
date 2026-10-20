"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactorChart from "@/components/ReactorChart";
import NetworkTopology from "@/components/NetworkTopology";
import Aurora from "@/components/ui/Aurora";
import { fetchIncidents } from "@/lib/supabase";
import type { IncidentLog, ReactorDataPoint, CutEdge } from "@/types";
import { simulateCSTR } from "@/lib/cstr-model";
import { OT_TOPOLOGY } from "@/lib/ot-topology";

// Live reactor trace: 120 s of simulated process time, sampled every 2 s,
// played back at 4x speed so a full run takes 30 s on screen.
const TRACE_SECONDS = 120;
const TRACE_STEP = 2;
const PLAYBACK_SPEED = 4;
type Run = { start: number; stable: boolean };
function liveTrace(run: Run | undefined, now: number, mode: "safecut" | "quarantine"): ReactorDataPoint[] {
  const full = simulateCSTR(TRACE_SECONDS, TRACE_STEP, run ? run.stable : true, 355, 1.0, mode);
  if (!run) return full.map((p) => ({ ...p, temp: undefined as unknown as number }));
  const shown = Math.max(1, Math.floor(((now - run.start) / 1000) * PLAYBACK_SPEED / TRACE_STEP) + 1);
  return full.map((p, i) => (i < shown ? p : { ...p, temp: undefined as unknown as number }));
}
function currentTemp(trace: ReactorDataPoint[]): number | null {
  const pts = trace.filter((p) => typeof p.temp === "number");
  return pts.length ? pts[pts.length - 1].temp : null;
}

export default function ConsolePage() {
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionToken, setSessionToken] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"graph" | "logs" | "telemetry">("graph");
  const [chartMode, setChartMode] = useState<"safecut" | "quarantine" | "both">("both");
  const [sessionCreated, setSessionCreated] = useState(false);
  const [respMsg, setRespMsg] = useState<string>("");
  const [respKind, setRespKind] = useState<"safe" | "bad" | "">("");

  // Live graph state — driven by the latest attack incident OR the on-page buttons.
  const [graphView, setGraphView] = useState<{
    node: string | null;
    cutEdges: CutEdge[];
    mode: "idle" | "attacking" | "safecut" | "quarantine";
    loopsPreserved: number;
    totalLoops: number;
    reactorStable: boolean;
  }>({ node: null, cutEdges: [], mode: "idle", loopsPreserved: 4, totalLoops: 4, reactorStable: true });

  // One live reactor run per response type, started when that response happens.
  const [runs, setRuns] = useState<{ safecut?: Run; quarantine?: Run }>({});
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const safecutTrace = liveTrace(runs.safecut, now, "safecut");
  const quarantineTrace = liveTrace(runs.quarantine, now, "quarantine");
  const safecutTemp = runs.safecut ? currentTemp(safecutTrace) : null;
  const quarantineTemp = runs.quarantine ? currentTemp(quarantineTrace) : null;
  const shownTemp = graphView.mode === "quarantine" ? quarantineTemp : safecutTemp;
  // Stable reference so the graph does not re-layout on every timer tick.
  const attackPath = useMemo(() => (graphView.node ? [graphView.node] : []), [graphView.node]);
  const lastGraphIncidentId = useRef<string | null>(null);

  // Defender reachability info (shown so the attacker knows which address to use)
  const [lan, setLan] = useState<{ name: string; address: string; likely: boolean; url: string }[]>([]);
  const [demoMode, setDemoMode] = useState<boolean | null>(null);
  const [attackerSeen, setAttackerSeen] = useState(false);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then((h) => {
      setLan(Array.isArray(h.lan) ? h.lan : []);
      setDemoMode(!!h.demoMode);
    }).catch(() => {});
  }, []);

  async function runResponse(mode: "safecut" | "quarantine") {
    setRespMsg(`Running ${mode === "safecut" ? "SafeCut" : "Blind Quarantine"}...`);
    setRespKind("");
    try {
      const res = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ compromisedNode: graphView.node ?? "PLC_02" }),
      });
      const r = await res.json();
      const preserved = r.safetyLoopsPreserved ?? 0;
      const total = r.totalSafetyLoops ?? 4;
      // Drive the live graph from the response
      // Show this response on the graph. The incident poller only redraws the
      // graph when a NEW attack arrives, so this view stays on screen.
      setGraphView({
        node: r.compromisedNode ?? "PLC_02",
        cutEdges: Array.isArray(r.cutEdges) ? r.cutEdges : [],
        mode,
        loopsPreserved: preserved,
        totalLoops: total,
        reactorStable: !!r.reactorStable,
      });
      setRuns((prev) => ({ ...prev, [mode]: { start: Date.now(), stable: !!r.reactorStable } }));
      if (mode === "safecut") {
        setRespKind(r.reactorStable ? "safe" : "bad");
        setRespMsg(`SafeCut: cut ${r.cutEdges?.length ?? 0} link(s) in ${(r.solveTimeMs ?? 0).toFixed(2)} ms  |  safety loops ${preserved}/${total}  |  reactor ${r.reactorStable ? "STABLE" : "AT RISK"}`);
      } else {
        setRespKind(r.reactorStable ? "safe" : "bad");
        setRespMsg(`Blind Quarantine: cut ${r.cutEdges?.length ?? 0} link(s)  |  safety loops ${preserved}/${total}  |  reactor ${r.reactorStable ? "STABLE" : "RUNAWAY"}`);
      }
    } catch (e) {
      setRespKind("bad");
      setRespMsg("Response failed: " + (e instanceof Error ? e.message : String(e)));
    }
  }

  async function resetConsole() {
    try { await fetch(`/api/attack-event/reset?sessionId=${encodeURIComponent(sessionId)}&sessionToken=${encodeURIComponent(sessionToken)}`, { method: "POST" }); } catch {}
    setIncidents([]);
    setRespMsg("");
    setRespKind("");
    setGraphView({ node: null, cutEdges: [], mode: "idle", loopsPreserved: 4, totalLoops: 4, reactorStable: true });
    setRuns({});
    lastGraphIncidentId.current = null;
    setAttackerSeen(false);
  }
  const pollingRef = useRef<number | null>(null);

  // Create a validated session on mount
  useEffect(() => {
    async function createSession() {
      try {
        const res = await fetch("/api/session", { method: "POST" });
        const data = await res.json();
        if (data.ok) {
          setSessionId(data.sessionId);
          setSessionToken(data.sessionToken);
          setSessionCreated(true);
        }
      } catch (err) {
        console.error("[Console] Failed to create session:", err);
        // Fallback to client-side generation
        const array = new Uint16Array(1);
        window.crypto.getRandomValues(array);
        const code = `SAFECUT-${array[0].toString(16).toUpperCase().padStart(4, "0")}`;
        setSessionId(code);
      }
    }
    createSession();
  }, []);

  // Poll for incidents filtered by this session
  useEffect(() => {
    if (!sessionId || !sessionToken) return;

    let mounted = true;

    async function loadLogs() {
      try {
        // Try the new attack-event API first (includes in-memory events)
        const res = await fetch(
          `/api/attack-event?sessionId=${encodeURIComponent(sessionId)}&sessionToken=${encodeURIComponent(sessionToken)}&limit=50`
        );
        const data = await res.json();
        if (data.ok && mounted) {
          setIncidents(data.events);
          if ((data.events as IncidentLog[]).length > 0) setAttackerSeen(true);
          // Drive the live graph from the newest attack incident (zero copy-paste
          // reaction to the remote attacker). Only update when a NEW incident
          // arrives, so the force layout does not restart on every poll.
          const latest = (data.events as IncidentLog[]).find((e) => e.safecut_triggered);
          if (latest && latest.id && latest.id !== lastGraphIncidentId.current) {
            lastGraphIncidentId.current = latest.id;
            const stable = latest.safety_loops_preserved === latest.total_safety_loops;
            setGraphView({
              node: latest.threat_node,
              cutEdges: latest.cut_edges ?? [],
              mode: latest.response_mode === "quarantine" ? "quarantine" : "safecut",
              loopsPreserved: latest.safety_loops_preserved,
              totalLoops: latest.total_safety_loops,
              reactorStable: stable,
            });
            // A new attack restarts the comparison: SafeCut trace starts now.
            setRuns({ safecut: { start: Date.now(), stable } });
          }
        } else {
          // Fallback to Supabase if API fails
          const logs = await fetchIncidents(50);
          const filtered = logs.filter((l) => l.session_id === sessionId);
          if (mounted) setIncidents(filtered);
        }
      } catch (err) {
        console.error("[Console] Failed to load logs:", err);
        // Fallback
        try {
          const logs = await fetchIncidents(50);
          const filtered = logs.filter((l) => l.session_id === sessionId);
          if (mounted) setIncidents(filtered);
        } catch {}
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    loadLogs();

    // Poll ~1.5 s for a responsive live demo
    pollingRef.current = window.setInterval(loadLogs, 1500);

    return () => {
      mounted = false;
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [sessionId, sessionToken]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, []);

  return (
    <main className="h-full grid grid-cols-1 lg:grid-cols-3">
      
      {/* ── LEFT: Command Palette & Operations ── */}
      <div className="border-r border-white/10 bg-background flex flex-col">
        <div className="p-4 border-b border-white/10 shrink-0 bg-muted/20">
          <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">Session Pairing</h2>
          <div className="flex items-center justify-between bg-black/50 p-3 border border-white/10 rounded-sm">
             <span className="text-xs font-sans text-muted-foreground">Target Session:</span>
             <span className="font-mono text-primary font-bold tracking-wider">{sessionId || "GENERATING..."}</span>
          </div>
          {sessionCreated && sessionToken ? (
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[10px] text-muted-foreground font-mono">Attacker token (full):</span>
                <button
                  onClick={() => navigator.clipboard?.writeText(sessionToken)}
                  className="text-[10px] font-mono text-primary hover:underline"
                >copy</button>
              </div>
              <div className="bg-black/50 border border-white/10 rounded-sm p-2 font-mono text-[10px] text-primary break-all select-all">
                {sessionToken}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(`${sessionId}  ${sessionToken}`)}
                className="text-[10px] font-mono text-muted-foreground hover:text-primary"
              >copy session id + token</button>
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-2 font-mono leading-tight">
              Generating session…
            </p>
          )}
        </div>

        <div className="p-4 border-b border-white/10 shrink-0">
          <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2">Attacker Connection</h2>
          {demoMode === false && (
            <div className="mb-2 text-[11px] font-mono text-destructive border border-destructive/40 bg-destructive/5 p-2 rounded-sm">
              Demo mode is OFF (SAFECUT_DEMO_MODE=0). The attacker must use the session ID and token shown above.
            </div>
          )}
          {lan.filter((a) => a.likely).length > 0 ? (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground font-mono">On the attacker laptop, enter this address:</span>
              {lan.filter((a) => a.likely).map((a) => (
                <div key={a.address} className="flex items-center justify-between gap-2 bg-primary/10 border border-primary/50 rounded-sm px-3 py-2">
                  <span className="font-mono text-lg font-bold text-foreground select-all tracking-wide">{a.address}</span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate" title={a.name}>{a.name}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground font-mono">No network adapter found. Connect this laptop to the hotspot, then reload.</p>
          )}
          <div className={`mt-2 text-[11px] font-mono ${attackerSeen ? "text-accent-green" : "text-muted-foreground"}`}>
            {attackerSeen ? "● Attacker events received" : "○ Waiting for attacker..."}
          </div>
        </div>

        <div className="p-4 border-b border-white/10 shrink-0">
          <div className="mb-4 flex items-center justify-between gap-2"><h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider">Command Palette</h2><Link href="/ml-lab" className="text-[10px] font-mono uppercase tracking-wider text-cyan-300 hover:text-cyan-200 hover:underline">ML results ↗</Link></div>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-primary text-sm font-mono">{'>'}</span>
            <input 
              type="text" 
              placeholder="Enter command (e.g., run exploit --target=HMI)" 
              className="w-full bg-muted border border-white/10 rounded-sm py-2 pl-8 pr-4 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              onClick={() => runResponse("safecut")}
              className={`rounded-sm px-3 py-2 text-left font-mono border-2 transition-colors ${graphView.mode === 'safecut' && graphView.node ? 'bg-green-600 border-green-400 text-white' : 'bg-green-600/15 border-green-600 text-green-500 hover:bg-green-600/30'}`}
            >
              <div className="text-sm font-bold">✓ Trigger SafeCut</div>
              <div className="text-[10px] opacity-80">cut only attacker links</div>
            </button>
            <button
              onClick={() => runResponse("quarantine")}
              className={`rounded-sm px-3 py-2 text-left font-mono border-2 transition-colors ${graphView.mode === 'quarantine' ? 'bg-red-600 border-red-400 text-white' : 'bg-red-600/15 border-red-600 text-red-500 hover:bg-red-600/30'}`}
            >
              <div className="text-sm font-bold">⚠ Blind Quarantine</div>
              <div className="text-[10px] opacity-80">legacy: isolate whole zone</div>
            </button>
          </div>
          {respMsg && (
            <div className={`mt-3 text-[11px] font-mono leading-snug p-2 rounded-sm border ${respKind === "safe" ? "text-accent-green border-accent-green/40 bg-accent-green/5" : respKind === "bad" ? "text-destructive border-destructive/40 bg-destructive/5" : "text-muted-foreground border-white/10 bg-white/5"}`}>
              {respMsg}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4">Quick Actions</h2>
          <div className="grid gap-2">
            {[
              "View latest certificate",
              "Export incident logs",
              "Reset simulation state",
              "Acknowledge alarms"
            ].map((action, i) => (
              <button key={i} onClick={action === "Reset simulation state" ? resetConsole : undefined} className="text-left w-full px-4 py-3 bg-muted border border-white/10 hover:border-white/20 transition-colors text-sm font-sans text-foreground rounded-sm">
                {action}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── RIGHT: Telemetry & Logs ── */}
      <div className="lg:col-span-2 flex flex-col">
        
        {/* Tabs */}
        <div className="flex items-center border-b border-white/10 bg-muted shrink-0">
          <button
            className={`px-6 py-3 text-sm font-mono uppercase tracking-wider border-r border-white/10 ${activeTab === 'graph' ? 'bg-background text-primary border-b-2 border-b-primary font-bold' : 'text-muted-foreground hover:bg-white/5'}`}
            onClick={() => setActiveTab('graph')}
          >
            Network Graph
          </button>
          <button
            className={`px-6 py-3 text-sm font-mono uppercase tracking-wider border-r border-white/10 ${activeTab === 'telemetry' ? 'bg-background text-primary border-b-2 border-b-primary font-bold' : 'text-muted-foreground hover:bg-white/5'}`}
            onClick={() => setActiveTab('telemetry')}
          >
            Real-time Telemetry
          </button>
          <button 
            className={`px-6 py-3 text-sm font-mono uppercase tracking-wider border-r border-white/10 ${activeTab === 'logs' ? 'bg-background text-primary border-b-2 border-b-primary font-bold' : 'text-muted-foreground hover:bg-white/5'}`}
            onClick={() => setActiveTab('logs')}
          >
            Incident Stream
          </button>
        </div>

        <div className="flex-1 overflow-hidden bg-background relative">
          
          {/* Subtle Aurora Background */}
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <Aurora colorStops={["#111318", "#C8862B", "#111318"]} speed={0.5} amplitude={1.2} />
          </div>

          {activeTab === 'graph' && (
            <div className="h-full flex flex-col relative z-10">
              <div className="flex items-center justify-between gap-4 px-6 py-3 border-b border-white/10 shrink-0 bg-black/20">
                <div className="text-xs font-mono">
                  {graphView.node ? (
                    <span className={`text-sm font-bold ${graphView.reactorStable ? 'text-accent-green' : 'text-destructive'}`}>
                      {graphView.mode === 'quarantine' ? 'BLIND QUARANTINE' : 'SAFECUT'}
                      {` · ${graphView.node} compromised · ${graphView.cutEdges.length} links cut · safety loops ${graphView.loopsPreserved}/${graphView.totalLoops} `}
                      {graphView.loopsPreserved === graphView.totalLoops ? 'PRESERVED' : 'SEVERED'}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">Network nominal · awaiting incident · fire an exploit from the attacker, or use the response buttons</span>
                  )}
                </div>
                {graphView.node && (
                  <span className={`text-sm font-mono font-bold px-3 py-1 rounded-sm border ${graphView.reactorStable ? 'text-accent-green border-accent-green/50 bg-accent-green/10' : 'text-destructive border-destructive/60 bg-destructive/10'}`}>
                    REACTOR {shownTemp !== null ? `${shownTemp.toFixed(0)} K · ` : ''}{graphView.reactorStable ? 'STABLE' : 'RUNAWAY'}
                  </span>
                )}
              </div>
              <div className="flex-1 min-h-0">
                <NetworkTopology
                  graph={OT_TOPOLOGY}
                  compromisedNode={graphView.node}
                  cutEdges={graphView.cutEdges}
                  attackPath={attackPath}
                  mode={graphView.mode}
                />
              </div>
            </div>
          )}

          {activeTab === 'telemetry' && (
            <div className="h-full flex flex-col p-6 relative z-10">
              <div className="flex items-center gap-4 mb-4 shrink-0">
                <Button variant={chartMode === 'both' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('both')} className="text-xs font-mono">Compare Both</Button>
                <Button variant={chartMode === 'safecut' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('safecut')} className="text-xs font-mono">SafeCut Only</Button>
                <Button variant={chartMode === 'quarantine' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('quarantine')} className="text-xs font-mono">Quarantine Only</Button>
              </div>
              <div className="grid grid-cols-2 gap-3 mb-4 shrink-0">
                <div className={`rounded-sm border-2 p-3 ${runs.safecut ? 'border-green-600 bg-green-600/10' : 'border-white/10'}`}>
                  <div className="text-[11px] font-mono text-muted-foreground uppercase">SafeCut response</div>
                  <div className={`text-2xl font-mono font-bold ${runs.safecut ? (runs.safecut.stable ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                    {safecutTemp !== null ? `${safecutTemp.toFixed(0)} K` : '--'}
                  </div>
                  <div className="text-[11px] font-mono">{runs.safecut ? (runs.safecut.stable ? 'Cooling loop intact · reactor STABLE' : 'Cooling loop lost · RUNAWAY') : 'Not run yet'}</div>
                </div>
                <div className={`rounded-sm border-2 p-3 ${runs.quarantine ? 'border-red-600 bg-red-600/10' : 'border-white/10'}`}>
                  <div className="text-[11px] font-mono text-muted-foreground uppercase">Blind quarantine response</div>
                  <div className={`text-2xl font-mono font-bold ${runs.quarantine ? (runs.quarantine.stable ? 'text-green-500' : 'text-red-500') : 'text-muted-foreground'}`}>
                    {quarantineTemp !== null ? `${quarantineTemp.toFixed(0)} K` : '--'}
                  </div>
                  <div className="text-[11px] font-mono">{runs.quarantine ? (runs.quarantine.stable ? 'Cooling loop intact · reactor STABLE' : 'Cooling loop severed · RUNAWAY') : 'Click Blind Quarantine to compare'}</div>
                </div>
              </div>
              <div className="flex-1 min-h-0 relative">
                <ReactorChart
                  safecutData={safecutTrace}
                  quarantineData={quarantineTrace}
                  mode={chartMode}
                />
                {!runs.safecut && !runs.quarantine && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="bg-background/90 border border-white/10 rounded-sm px-4 py-3 text-sm font-mono text-muted-foreground text-center">
                      Waiting for a response.<br />Launch an attack, or click Trigger SafeCut / Blind Quarantine.
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'logs' && (
            <div className="h-full overflow-y-auto p-6 font-mono text-sm space-y-4 relative z-10">
              {isLoading ? (
                <div className="text-muted-foreground animate-pulse">Loading incident stream...</div>
              ) : incidents.length === 0 ? (
                <div className="text-muted-foreground">No incidents logged yet. Start a simulation to generate logs.</div>
              ) : (
                incidents.map((inc) => (
                  <div key={inc.id} className="border border-white/10 bg-muted/30 p-4 rounded-sm">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-primary font-bold">{inc.created_at ? new Date(inc.created_at).toLocaleString() : "Unknown Time"}</span>
                      <span className="text-xs text-muted-foreground">ID: {inc.id ? inc.id.split('-')[0] : 'N/A'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
                      <div><span className="text-muted-foreground block mb-1">Threat Node:</span> {inc.threat_node}</div>
                      <div><span className="text-muted-foreground block mb-1">Response:</span> {inc.safecut_triggered ? "SafeCut" : "None"}</div>
                      <div><span className="text-muted-foreground block mb-1">Edges Cut:</span> {inc.edges_cut}</div>
                      <div><span className="text-muted-foreground block mb-1">SIF Loops:</span> {inc.safety_loops_preserved} / {inc.total_safety_loops}</div>
                    </div>
                    <div className="border-t border-white/10 pt-2 text-xs text-muted-foreground space-y-1">
                      {inc.log_messages.map((msg, i) => (
                        <div key={i}>&gt; {msg}</div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

      </div>

    </main>
  );
}