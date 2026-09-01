import React from "react";
import SharedNav from "@/components/SharedNav";
import SharedFooter from "@/components/SharedFooter";
import { fetchIncidents } from "@/lib/supabase";
import type { IncidentLog } from "@/types";

// Fallback data if Supabase is unconfigured or empty
const getFallbackIncidents = (): IncidentLog[] => {
  const now = Date.now();
  return [
    {
      id: "inc_002",
      created_at: new Date(now - 1000 * 60 * 60).toISOString(),
      detected_at: new Date(now - 1000 * 60 * 60 - 5000).toISOString(),
      responded_at: new Date(now - 1000 * 60 * 60).toISOString(),
      mitre_tactic: "Initial Access",
      source_ip: "EXTERNAL",
      target_ip: "192.168.10.102",
      mode: "safecut",
      compromised_node: "PLC_02",
      cut_edges: [
        { source: "PLC_02", target: "PLC_01" },
        { source: "PLC_02", target: "TEMP_SENSOR" }
      ],
      certificate: {
        issuedAt: new Date(now - 1000 * 60 * 60).toISOString(),
        solverUsed: "Edmonds-Karp",
        sifResults: [
          { loopId: "L1", loopName: "Cooling Loop", preserved: true, path: [] },
          { loopId: "L2", loopName: "Pressure Valve", preserved: true, path: [] },
          { loopId: "L3", loopName: "Emergency Shutdown", preserved: true, path: [] },
          { loopId: "L4", loopName: "Alarm System", preserved: true, path: [] },
        ],
        allPreserved: true,
      },
      solve_time_ms: 0.842,
      safety_loops_preserved: 4,
      reactor_stable: true,
    },
    {
      id: "inc_001",
      created_at: new Date(now - 1000 * 60 * 120).toISOString(),
      detected_at: new Date(now - 1000 * 60 * 120 - 5000).toISOString(),
      responded_at: new Date(now - 1000 * 60 * 120).toISOString(),
      mitre_tactic: "Initial Access",
      source_ip: "EXTERNAL",
      target_ip: "192.168.10.102",
      mode: "quarantine",
      compromised_node: "PLC_02",
      cut_edges: [
        { source: "PLC_02", target: "PLC_01" },
        { source: "PLC_02", target: "TEMP_SENSOR" },
        { source: "PLC_02", target: "SAFETY_CONTROLLER" } // Simulated blunt cut
      ],
      certificate: {
        issuedAt: new Date(now - 1000 * 60 * 120).toISOString(),
        solverUsed: "Edmonds-Karp",
        sifResults: [
          { loopId: "L1", loopName: "Cooling Loop", preserved: false, path: [] },
          { loopId: "L2", loopName: "Pressure Valve", preserved: true, path: [] },
          { loopId: "L3", loopName: "Emergency Shutdown", preserved: true, path: [] },
          { loopId: "L4", loopName: "Alarm System", preserved: true, path: [] },
        ],
        allPreserved: false,
      },
      solve_time_ms: 0.122,
      safety_loops_preserved: 3,
      reactor_stable: false,
    }
  ];
};

export default async function IncidentLogsPage() {
  let incidents = await fetchIncidents(50);
  let usingFallback = false;

  if (!incidents || incidents.length === 0) {
    incidents = getFallbackIncidents();
    usingFallback = true;
  }

  const totalRuns = incidents.length;
  const safecutRuns = incidents.filter(i => i.mode === "safecut").length;
  const quarantineRuns = totalRuns - safecutRuns;
  const safeRuns = incidents.filter(i => i.reactor_stable).length;
  const safePercentage = totalRuns > 0 ? Math.round((safeRuns / totalRuns) * 100) : 0;

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      <SharedNav />
      
      <main className="flex-1 container mx-auto px-6 py-12 max-w-7xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-black text-text-primary tracking-tight">Incident Audit Log</h1>
          {usingFallback && (
            <div className="px-3 py-1 bg-accent-amber/10 border border-accent-amber/20 rounded-md text-accent-amber text-xs font-mono">
              Displaying simulated fallback data
            </div>
          )}
        </div>

        {/* ── Summary Strip ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <div className="glass p-6 rounded-2xl">
            <div className="text-4xl font-black text-text-primary mb-1">{totalRuns}</div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest">Total Simulated Runs</div>
          </div>
          <div className="glass p-6 rounded-2xl">
            <div className="text-4xl font-black text-accent-cyan mb-1">{safecutRuns}</div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest">SafeCut Responses</div>
          </div>
          <div className="glass p-6 rounded-2xl">
            <div className="text-4xl font-black text-accent-amber mb-1">{quarantineRuns}</div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest">Blind Quarantine Responses</div>
          </div>
          <div className="glass p-6 rounded-2xl border-b-4 border-b-accent-green">
            <div className="text-4xl font-black text-accent-green mb-1">{safePercentage}%</div>
            <div className="text-xs font-semibold text-text-muted uppercase tracking-widest">Overall SIF Survival Rate</div>
          </div>
        </div>

        {/* ── Incident Table ── */}
        <div className="glass rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-bg-surface/50 border-b border-white/10">
                  <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Timestamp</th>
                  <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Target IP</th>
                  <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Response Mode</th>
                  <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Outcome</th>
                  <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Loops Preserved</th>
                  <th className="p-4 text-xs font-bold text-text-muted uppercase tracking-wider">Solve Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {incidents.map((incident, i) => (
                  <tr key={incident.id || i} className="hover:bg-white/[0.02] transition-colors group">
                    <td className="p-4 text-xs font-mono text-text-secondary">
                      {new Date(incident.detected_at || incident.created_at || Date.now()).toLocaleString()}
                    </td>
                    <td className="p-4 text-xs font-mono text-text-primary">
                      {incident.target_ip || incident.compromised_node}
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                        incident.mode === "safecut" ? "bg-accent-cyan/10 text-accent-cyan" : "bg-accent-amber/10 text-accent-amber"
                      }`}>
                        {incident.mode === "safecut" ? "SafeCut" : "Quarantine"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`inline-flex items-center gap-1.5 text-xs font-bold ${
                        incident.reactor_stable ? "text-accent-green" : "text-accent-red"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${incident.reactor_stable ? "bg-accent-green" : "bg-accent-red"}`} />
                        {incident.reactor_stable ? "SAFE" : "DISASTER"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-xs font-mono text-text-primary">
                        <span>{incident.safety_loops_preserved} / 4</span>
                        {/* Miniature visual indicator */}
                        <div className="flex gap-0.5">
                          {Array.from({length: 4}).map((_, idx) => (
                            <div key={idx} className={`w-1.5 h-3 rounded-sm ${
                              idx < incident.safety_loops_preserved ? "bg-accent-green" : "bg-accent-red"
                            }`} />
                          ))}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-xs font-mono text-text-secondary">
                      {incident.solve_time_ms.toFixed(3)} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <SharedFooter />
    </div>
  );
}
