"use client";

import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Certificate, CutEdge } from "@/types";

interface Props {
  step: 0 | 1 | 2 | 3 | 4;
  setStep: (val: 0 | 1 | 2 | 3 | 4) => void;
  compromisedNode: string;
  isSimulating: boolean;
  setIsSimulating: (val: boolean) => void;
  certificate: Certificate | null;
  safecutEdges: CutEdge[];
  quarantineEdges: CutEdge[];
}

export default function ComputationSteps({
  step,
  setStep,
  compromisedNode,
  isSimulating,
  setIsSimulating,
  certificate,
  safecutEdges,
  quarantineEdges
}: Props) {
  const [log, setLog] = useState<string[]>([]);

  useEffect(() => {
    if (step === 1 && !isSimulating) {
      setIsSimulating(true);
      setLog(["[SYSTEM] Intrusion detected at node: " + compromisedNode]);
      setTimeout(() => setLog(prev => [...prev, "[SAFECUT] Assigning infinite capacity to safety edges..."]), 1000);
      setTimeout(() => setLog(prev => [...prev, "[SAFECUT] Computing Edmonds-Karp min-cut..."]), 2000);
      setTimeout(() => {
        setLog(prev => [...prev, `[SAFECUT] Optimal cut found. ${safecutEdges.length} edges severed.`]);
        setIsSimulating(false);
      }, 3000);
    }
  }, [step, isSimulating, setIsSimulating, compromisedNode, safecutEdges.length]);

  return (
    <div className="space-y-8">
      {/* Step 0 */}
      {step === 0 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-display font-medium mb-4">Initial State</h2>
          <p className="text-muted-foreground font-sans leading-relaxed mb-6">
            To the left is a standard 12-node OT network topology. Normal network communication is represented by solid gray lines.
          </p>
          <p className="text-muted-foreground font-sans leading-relaxed mb-6">
            The safety-instrumented functions (SIFs)—such as cooling loops and emergency shutdown links—are explicitly marked in <strong>cyan</strong>.
          </p>
          <p className="text-muted-foreground font-sans leading-relaxed">
            Click &quot;Run SafeCut Isolation&quot; below to simulate an adversary compromising the Human-Machine Interface (HMI) and attempting lateral movement toward the physical controllers.
          </p>
        </div>
      )}

      {/* Step 1 */}
      {step === 1 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-display font-medium mb-4">1. Safety-Constrained Min-Cut</h2>
          <p className="text-muted-foreground font-sans leading-relaxed mb-6">
            The system has detected a compromise at the <strong>{compromisedNode}</strong> node. SafeCut formulates the network as a flow graph, assigning <strong>infinite capacity</strong> to all cyan safety edges.
          </p>
          
          <Card className="bg-muted p-4 font-mono text-xs text-muted-foreground mb-6 h-48 overflow-y-auto flex flex-col justify-end">
            {log.map((line, i) => (
              <div key={i} className="mb-2">{line}</div>
            ))}
            {isSimulating && <div className="animate-pulse">_</div>}
          </Card>

          {!isSimulating && (
            <Button onClick={() => setStep(2)} className="w-full">Next: Independent Verification</Button>
          )}
        </div>
      )}

      {/* Step 2 */}
      {step === 2 && certificate && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-display font-medium mb-4">2. Verifiable Safety Certificate</h2>
          <p className="text-muted-foreground font-sans leading-relaxed mb-6">
            SafeCut does not blindly trust the solver. Before enforcement, an independent reachability verifier runs a breadth-first search on the post-cut graph to mathematically prove every safety loop survived.
          </p>
          
          <div className="border border-safety-ok/30 bg-safety-ok/5 p-6 rounded-sm mb-6">
            <h3 className="font-mono text-safety-ok font-bold mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-safety-ok animate-pulse"></span>
              CERTIFICATE OF SAFETY ISSUED
            </h3>
            <ul className="space-y-3 font-mono text-xs">
              {certificate.sifResults.map(res => (
                <li key={res.loopId} className="flex items-center justify-between">
                  <span className="text-muted-foreground">{res.loopName}</span>
                  <span className={res.preserved ? "text-safety-ok" : "text-destructive"}>
                    {res.preserved ? "PRESERVED" : "SEVERED"}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <Button onClick={() => setStep(3)} className="w-full" variant="secondary">Compare to Blind Quarantine</Button>
        </div>
      )}

      {/* Step 3 */}
      {step === 3 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-display font-medium mb-4 text-destructive">3. The Blind Quarantine Failure</h2>
          <p className="text-muted-foreground font-sans leading-relaxed mb-6">
            If a standard IT security playbook (like a SOAR platform) had responded to this intrusion, it would have applied a &quot;Deny All&quot; firewall rule to isolate the {compromisedNode}.
          </p>
          <p className="text-muted-foreground font-sans leading-relaxed mb-6">
            Notice how the standard approach severs the connections blindly, cutting through {quarantineEdges.length} edges and critically destroying the safety-instrumented loops, leading to process instability.
          </p>
          
          <Button onClick={() => setStep(4)} className="w-full" variant="destructive">View Final Results</Button>
        </div>
      )}

      {/* Step 4 */}
      {step === 4 && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <h2 className="text-2xl font-display font-medium mb-4">Summary</h2>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card className="p-6 border-safety-warn/20 bg-safety-warn/5">
              <h3 className="text-sm font-mono font-bold text-destructive mb-4 uppercase tracking-wider">Blind Quarantine</h3>
              <div className="text-3xl font-display font-bold text-foreground mb-1">
                0 / 4
              </div>
              <div className="text-xs text-muted-foreground font-mono mb-4">SIF Loops Preserved</div>
              
              <div className="text-xl font-display font-semibold text-destructive mb-1">Runaway</div>
              <div className="text-xs text-muted-foreground font-mono">Reactor Outcome</div>
            </Card>

            <Card className="p-6 border-safety-ok/20 bg-safety-ok/5">
              <h3 className="text-sm font-mono font-bold text-safety-ok mb-4 uppercase tracking-wider">SafeCut</h3>
              <div className="text-3xl font-display font-bold text-foreground mb-1">
                4 / 4
              </div>
              <div className="text-xs text-muted-foreground font-mono mb-4">SIF Loops Preserved</div>
              
              <div className="text-xl font-display font-semibold text-safety-ok mb-1">Stable</div>
              <div className="text-xs text-muted-foreground font-mono">Reactor Outcome</div>
            </Card>
          </div>
          
          <p className="text-muted-foreground font-sans text-sm leading-relaxed border-t border-white/10 pt-4">
            SafeCut is the first system to successfully bridge automated containment with verifiable safety constraints in Operational Technology environments.
          </p>
        </div>
      )}
    </div>
  );
}
