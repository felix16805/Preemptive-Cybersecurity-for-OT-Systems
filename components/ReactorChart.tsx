"use client";

import React from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";
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
    <div className="glass rounded-lg p-3 text-xs font-mono border border-white/10 shadow-xl">
      <p className="text-text-muted mb-1">t = {label}s</p>
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
    <div className="w-full h-full flex flex-col gap-2">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent-amber animate-pulse" />
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">
            CSTR Reactor — Temperature (K)
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono text-text-muted">
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-[#22d3ee]" /> SafeCut
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-3 h-0.5 bg-[#ef4444]" /> Quarantine
          </span>
        </div>
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(71,85,105,0.3)" />
            <XAxis
              dataKey="t"
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              label={{ value: "Time (s)", position: "insideBottomRight", offset: -4, fill: "#475569", fontSize: 10 }}
            />
            <YAxis
              domain={[280, 900]}
              tick={{ fill: "#64748b", fontSize: 10, fontFamily: "JetBrains Mono" }}
              tickLine={false}
              axisLine={{ stroke: "#1e293b" }}
              label={{ value: "Temp (K)", angle: -90, position: "insideLeft", offset: 10, fill: "#475569", fontSize: 10 }}
            />
            <Tooltip content={<CustomTooltip />} />

            {/* Danger threshold */}
            <ReferenceLine
              y={400}
              stroke="#ef4444"
              strokeDasharray="6 3"
              strokeWidth={1.5}
              label={{ value: "DANGER 400K", position: "insideTopRight", fill: "#ef4444", fontSize: 9, fontFamily: "JetBrains Mono" }}
            />
            {/* Nominal operating point */}
            <ReferenceLine
              y={355}
              stroke="#4ade80"
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{ value: "Nominal 355K", position: "insideTopRight", fill: "#4ade80", fontSize: 9, fontFamily: "JetBrains Mono" }}
            />

            {showSafeCut && (
              <Line
                type="monotone"
                dataKey="safecut"
                name="SafeCut"
                stroke="#22d3ee"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "#22d3ee" }}
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
                strokeWidth={2.5}
                strokeDasharray="6 2"
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
      <div className="flex gap-3">
        {showSafeCut && (
          <div className="flex-1 glass rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-green" />
            <span className="text-xs font-mono text-accent-green font-semibold">STABLE ~355 K</span>
          </div>
        )}
        {showQuarantine && (
          <div className="flex-1 glass-red rounded-lg px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-accent-red animate-pulse" />
            <span className="text-xs font-mono text-accent-red font-semibold">RUNAWAY &gt;400 K</span>
          </div>
        )}
      </div>
    </div>
  );
}
