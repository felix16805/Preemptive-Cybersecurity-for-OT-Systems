"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import type { ReactorDataPoint } from "@/types";

interface Props {
  safecutData:    ReactorDataPoint[];
  quarantineData: ReactorDataPoint[];
  mode: "idle" | "safecut" | "quarantine" | "both";
  /** How many data points to show (for live animation effect) */
  visiblePoints?: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-background border border-white/10 p-3 text-xs font-mono rounded-sm shadow-xl">
      <p className="text-muted-foreground mb-1">t = {label}s</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} style={{ color: p.color }}>
          {p.name}: <span className="font-bold">{Number(p.value).toFixed(1)} K</span>
        </p>
      ))}
    </div>
  );
};

export default function ReactorChart({ safecutData, quarantineData, mode, visiblePoints }: Props) {
  // Merge datasets on time axis
  const maxLen = Math.max(safecutData.length, quarantineData.length);
  const limit = visiblePoints ?? maxLen;

  const merged = Array.from({ length: Math.min(limit, maxLen) }, (_, i) => ({
    t: safecutData[i]?.t ?? quarantineData[i]?.t ?? i * 2,
    safecut:    safecutData[i]?.temp,
    quarantine: quarantineData[i]?.temp,
  }));

  const showSafeCut    = mode === "safecut"    || mode === "both" || mode === "idle";
  const showQuarantine = mode === "quarantine" || mode === "both";

  return (
    <div className="w-full h-full flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          <span className="text-xs font-semibold text-foreground font-mono uppercase tracking-wider">
            CSTR Reactor Telemetry (K)
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground">
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-[#4ade80]" /> SafeCut
          </span>
          <span className="flex items-center gap-2">
            <span className="inline-block w-4 h-0.5 bg-[#ef4444]" /> Quarantine
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0 border border-white/10 bg-muted/30 p-2">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 10, right: 10, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="t"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={{ stroke: "rgba(255,255,255,0.1)" }}
            />
            <YAxis
              domain={[280, 900]}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "monospace" }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Danger threshold */}
            <ReferenceLine
              y={400}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1}
              label={{ value: "DANGER 400K", position: "insideTopRight", fill: "#ef4444", fontSize: 9, fontFamily: "monospace" }}
            />
            {/* Nominal operating point */}
            <ReferenceLine
              y={355}
              stroke="#4ade80"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "Nominal 355K", position: "insideTopRight", fill: "#4ade80", fontSize: 9, fontFamily: "monospace" }}
            />

            {showSafeCut && (
              <Line
                type="monotone"
                dataKey="safecut"
                name="SafeCut"
                stroke="#4ade80"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "#4ade80" }}
                isAnimationActive
                animationDuration={1200}
              />
            )}
            {showQuarantine && (
              <Line
                type="monotone"
                dataKey="quarantine"
                name="Quarantine"
                stroke="#ef4444"
                strokeWidth={2}
                strokeDasharray="6 4"
                dot={false}
                activeDot={{ r: 4, fill: "#ef4444" }}
                isAnimationActive
                animationDuration={1200}
              />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Status footer */}
      <div className="flex gap-4">
        {showSafeCut && (
          <div className="flex-1 border border-safety-ok/30 bg-safety-ok/5 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-mono text-safety-ok font-semibold">SAFECUT STATUS</span>
            <span className="text-xs font-mono text-safety-ok">STABLE ~355 K</span>
          </div>
        )}
        {showQuarantine && (
          <div className="flex-1 border border-destructive/30 bg-destructive/5 px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-mono text-destructive font-semibold">QUARANTINE STATUS</span>
            <span className="text-xs font-mono text-destructive animate-pulse">RUNAWAY &gt;400 K</span>
          </div>
        )}
      </div>
    </div>
  );
}
