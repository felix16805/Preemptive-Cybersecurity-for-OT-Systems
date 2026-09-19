"use client";

import React, { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ReactorChart from "@/components/ReactorChart";
import Aurora from "@/components/ui/Aurora";
import { fetchIncidents } from "@/lib/supabase";
import type { IncidentLog, ReactorDataPoint } from "@/types";
import { generateComparisonData } from "@/lib/cstr-model";

const { safecutData, quarantineData } = generateComparisonData();

export default function ConsolePage() {
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [sessionId, setSessionId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"logs" | "telemetry">("telemetry");
  const [chartMode, setChartMode] = useState<"safecut" | "quarantine" | "both">("both");

  useEffect(() => {
    // Generate pairing code
    const array = new Uint16Array(1);
    window.crypto.getRandomValues(array);
    const code = `SAFECUT-${array[0].toString(16).toUpperCase().padStart(4, "0")}`;
    setSessionId(code);

    async function loadLogs() {
      // In a real app we would pass `code` to filter incidents by session
      const logs = await fetchIncidents(50);
      setIncidents(logs);
      setIsLoading(false);
    }
    loadLogs();
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
          <p className="text-[10px] text-muted-foreground mt-2 font-mono leading-tight">Run `safecut-cli attack --target HMI --session {sessionId || "..."}`</p>
        </div>

        <div className="p-4 border-b border-white/10 shrink-0">
          <h2 className="text-sm font-mono font-bold text-muted-foreground uppercase tracking-wider mb-4">Command Palette</h2>
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-primary text-sm font-mono">&gt;</span>
            <input 
              type="text" 
              placeholder="Enter command (e.g., run exploit --target=HMI)" 
              className="w-full bg-muted border border-white/10 rounded-sm py-2 pl-8 pr-4 text-sm font-mono text-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="mt-4 flex gap-2">
            <Button variant="outline" className="flex-1 text-xs font-mono" size="sm">Trigger SafeCut</Button>
            <Button variant="outline" className="flex-1 text-xs font-mono border-destructive text-destructive hover:bg-destructive/10" size="sm">Blind Quarantine</Button>
          </div>
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
              <button key={i} className="text-left w-full px-4 py-3 bg-muted border border-white/10 hover:border-white/20 transition-colors text-sm font-sans text-foreground rounded-sm">
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

          {activeTab === 'telemetry' && (
            <div className="h-full flex flex-col p-6 relative z-10">
              <div className="flex items-center gap-4 mb-4 shrink-0">
                <Button variant={chartMode === 'both' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('both')} className="text-xs font-mono">Compare Both</Button>
                <Button variant={chartMode === 'safecut' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('safecut')} className="text-xs font-mono">SafeCut Only</Button>
                <Button variant={chartMode === 'quarantine' ? 'default' : 'outline'} size="sm" onClick={() => setChartMode('quarantine')} className="text-xs font-mono">Quarantine Only</Button>
              </div>
              <div className="flex-1 min-h-0">
                <ReactorChart 
                  safecutData={safecutData} 
                  quarantineData={quarantineData} 
                  mode={chartMode} 
                />
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
