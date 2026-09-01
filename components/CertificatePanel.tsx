"use client";

import React from "react";
import type { Certificate } from "@/types";

interface Props {
  certificate: Certificate | null;
  isLoading?: boolean;
}

export default function CertificatePanel({ certificate, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="glass rounded-xl p-4 animate-pulse">
        <div className="h-4 w-48 bg-bg-card rounded mb-3" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 bg-bg-card rounded mb-2" />
        ))}
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="glass rounded-xl p-4 flex flex-col items-center justify-center gap-3 min-h-[140px]">
        <div className="text-2xl opacity-30">🔒</div>
        <p className="text-xs text-text-muted font-mono text-center">
          Awaiting SafeCut execution…<br />Certificate will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="glass rounded-xl p-4 flex flex-col gap-3 animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm">📜</span>
          <span className="text-xs font-bold text-text-primary uppercase tracking-wider">
            Safety Loop Certificate
          </span>
        </div>
        <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
          certificate.allPreserved
            ? "bg-accent-green/10 border-accent-green/30 text-accent-green"
            : "bg-accent-red/10 border-accent-red/30 text-accent-red"
        }`}>
          {certificate.allPreserved ? "✓ ALL VERIFIED" : "✗ BREACH DETECTED"}
        </div>
      </div>

      {/* SIF rows */}
      <div className="flex flex-col gap-2">
        {certificate.sifResults.map((sif) => (
          <div
            key={sif.loopId}
            className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
              sif.preserved
                ? "bg-accent-green/5 border-accent-green/20"
                : "bg-accent-red/5 border-accent-red/20"
            }`}
          >
            <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${
              sif.preserved
                ? "bg-accent-green/20 text-accent-green"
                : "bg-accent-red/20 text-accent-red"
            }`}>
              {sif.preserved ? "✓" : "✗"}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`text-xs font-semibold ${sif.preserved ? "text-accent-green" : "text-accent-red"}`}>
                {sif.loopName}
              </p>
              {sif.preserved && sif.path.length > 0 && (
                <p className="text-xs font-mono text-text-muted mt-0.5 truncate">
                  {sif.path.join(" → ")}
                </p>
              )}
              {!sif.preserved && (
                <p className="text-xs font-mono text-accent-red mt-0.5">
                  Loop severed — no connected path
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Metadata footer */}
      <div className="flex items-center justify-between pt-1 border-t border-white/5">
        <span className="text-xs font-mono text-text-muted">Solver: {certificate.solverUsed}</span>
        <span className="text-xs font-mono text-text-muted">
          {new Date(certificate.issuedAt).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}
