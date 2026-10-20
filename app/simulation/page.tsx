"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import NetworkTopology from "@/components/NetworkTopology";
import ReactorChart from "@/components/ReactorChart";
import CertificatePanel from "@/components/CertificatePanel";
import Aurora from "@/components/ui/Aurora";
import { OT_TOPOLOGY, SAFETY_LOOPS, zoneOf } from "@/lib/ot-topology";
import { computeSafeCut, computeBlindQuarantine, verifyCertificate } from "@/lib/safecut-engine";
import { simulateCSTR } from "@/lib/cstr-model";
import type { CutEdge, Certificate, ReactorDataPoint } from "@/types";
import { 
  Play, 
  RotateCcw, 
  ShieldCheck, 
  AlertTriangle, 
  ChevronRight, 
  ChevronLeft, 
  Activity, 
  Network, 
  FileText, 
  Terminal,
  CheckCircle2,
  XCircle,
  Pause
} from "lucide-react";

// Pre-defined demo scenarios
interface Scenario {
  id: string;
  targetNode: string;
  name: string;
  subtitle: string;
  adversaryRole: string;
  vector: string;
  safecutSummary: string;
  quarantineSummary: string;
}

const SCENARIOS: Scenario[] = [
  {
    id: "triton",
    targetNode: "PLC_02",
    name: "PLC_02 — Reactor Cooling Controller",
    subtitle: "Safety System Targeted (TRITON / TRISIS Pattern)",
    adversaryRole: "Nation-state actor with OT firmware implants",
    vector: "Unauthorized Modbus 0x06 write to Register 40003 (Feed Temperature Overwrite)",
    safecutSummary: "Surgically severs 3 lateral control links. Critical Sensor-to-SIS-to-Valve cooling loop remains connected. Reactor temp stable at 355 K.",
    quarantineSummary: "Traditional IT isolation drops all connections to Control Zone 2. Cooling telemetry severed. Reactor runs away past 880 K in under 45 seconds.",
  },
  {
    id: "hmi",
    targetNode: "HMI",
    name: "HMI_01 — Operator Station",
    subtitle: "Supervisory Layer Pivot (Control Room Intrusion)",
    adversaryRole: "Compromised operator terminal via phishing payload",
    vector: "Remote command injection executing unauthorized valve override script",
    safecutSummary: "Isolates the compromised workstation from the internal fieldbus while keeping automated safety controllers talking to field actuators.",
    quarantineSummary: "Blindly cuts all supervisory switch ports, severing emergency trip indicators and leaving field controllers autonomous without interlocks.",
  },
  {
    id: "ews",
    targetNode: "EWS",
    name: "EWS_01 — Engineering Workstation",
    subtitle: "Purdue Level 3 Lateral Movement Attempt",
    adversaryRole: "Malicious contractor VPN foothold",
    vector: "Project file poisoning attempting to deploy rogue PLC logic",
    safecutSummary: "Disconnects the engineering subnet link while leaving plant SCADA, historians, and field safety networks in full synchronized operation.",
    quarantineSummary: "Legacy NAC severs the backbone switch, fragmenting the network into uncoordinated islands.",
  },
];

type DemoStep = 0 | 1 | 2 | 3;
// Step 0: Baseline Nominal
// Step 1: Intrusion Injected
// Step 2: Response Executed (SafeCut vs Quarantine)
// Step 3: Certificate & Physical Dynamics Verified

interface DemoReactorTelemetryProps {
  safecutData: ReactorDataPoint[];
  quarantineData: ReactorDataPoint[];
  mode: "idle" | "safecut" | "quarantine";
  currentStep: number;
}

function DemoReactorTelemetry({
  safecutData,
  quarantineData,
  mode,
  currentStep,
}: DemoReactorTelemetryProps) {
  const [visiblePoints, setVisiblePoints] = useState(25);

  useEffect(() => {
    if (currentStep === 0) {
      setVisiblePoints(25);
      return;
    }
    const maxPoints = Math.max(safecutData.length, quarantineData.length);
    const interval = setInterval(() => {
      setVisiblePoints((prev) => {
        if (prev >= maxPoints) return prev;
        return prev + 1;
      });
    }, 120);
    return () => clearInterval(interval);
  }, [currentStep, safecutData.length, quarantineData.length]);

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex-1 min-h-[420px] rounded-md border border-white/10 bg-black/40 p-4">
        <ReactorChart
          safecutData={safecutData}
          quarantineData={quarantineData}
          mode={mode === "idle" ? "idle" : mode}
          visiblePoints={visiblePoints}
        />
      </div>
      <div className="text-xs font-mono text-muted-foreground flex items-center justify-between px-1">
        <span>Continuous Stirred Tank Reactor (CSTR) Arrhenius Kinetics ODE Integration</span>
        <span className={mode === "quarantine" ? "text-destructive font-bold" : "text-green-400"}>
          {mode === "quarantine"
            ? "CRITICAL THERMAL RUNAWAY EXCEEDED"
            : "ISOTHERMAL REGULATION MAINTAINED (355 K)"}
        </span>
      </div>
    </div>
  );
}

export default function SimulationDemoPage() {
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState(0);
  const scenario = SCENARIOS[selectedScenarioIndex];

  // Active step in the guided demo run
  const [currentStep, setCurrentStep] = useState<DemoStep>(0);
  const [responseMode, setResponseMode] = useState<"safecut" | "quarantine">("safecut");
  const [activeTab, setActiveTab] = useState<"graph" | "telemetry" | "certificate" | "logs">("graph");
  const [isAutoPlaying, setIsAutoPlaying] = useState(false);

  // Compute solver outputs based on current scenario and response mode
  const { safecutResult, quarantineEdges, safecutCert, quarantineCert } = useMemo(() => {
    const sc = computeSafeCut({ graph: OT_TOPOLOGY, compromisedNode: scenario.targetNode });
    const qEdges = computeBlindQuarantine(OT_TOPOLOGY, scenario.targetNode);
    const sCert = verifyCertificate(OT_TOPOLOGY, sc.cutEdges);
    const qCert = verifyCertificate(OT_TOPOLOGY, qEdges);
    return {
      safecutResult: sc,
      quarantineEdges: qEdges,
      safecutCert: sCert,
      quarantineCert: qCert,
    };
  }, [scenario.targetNode]);

  // Determine current visual graph state
  const graphState = useMemo(() => {
    if (currentStep === 0) {
      return {
        node: null,
        cutEdges: [] as CutEdge[],
        mode: "idle" as const,
        loopsPreserved: 4,
        totalLoops: 4,
        reactorStable: true,
      };
    }
    if (currentStep === 1) {
      return {
        node: scenario.targetNode,
        cutEdges: [] as CutEdge[],
        mode: "attacking" as const,
        loopsPreserved: 4,
        totalLoops: 4,
        reactorStable: true,
      };
    }
    // Step 2 or 3: response evaluated
    if (responseMode === "safecut") {
      return {
        node: scenario.targetNode,
        cutEdges: safecutResult.cutEdges,
        mode: "safecut" as const,
        loopsPreserved: safecutCert.sifResults.filter((r) => r.preserved).length,
        totalLoops: safecutCert.sifResults.length,
        reactorStable: safecutCert.allPreserved,
      };
    } else {
      return {
        node: scenario.targetNode,
        cutEdges: quarantineEdges,
        mode: "quarantine" as const,
        loopsPreserved: quarantineCert.sifResults.filter((r) => r.preserved).length,
        totalLoops: quarantineCert.sifResults.length,
        reactorStable: quarantineCert.allPreserved,
      };
    }
  }, [currentStep, responseMode, scenario.targetNode, safecutResult, quarantineEdges, safecutCert, quarantineCert]);

  // CSTR Reactor Telemetry Traces
  const safecutTelemetry = useMemo(() => {
    return simulateCSTR(120, 2, true, 355, 1.0, "safecut");
  }, []);

  const quarantineTelemetry = useMemo(() => {
    return simulateCSTR(120, 2, false, 355, 1.0, "quarantine");
  }, []);

  // Auto-play timer
  const autoPlayTimer = useRef<NodeJS.Timeout | null>(null);
  useEffect(() => {
    if (!isAutoPlaying) {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
      return;
    }

    autoPlayTimer.current = setTimeout(() => {
      if (currentStep === 0) {
        setCurrentStep(1);
      } else if (currentStep === 1) {
        setCurrentStep(2);
      } else if (currentStep === 2) {
        setCurrentStep(3);
      } else if (currentStep === 3) {
        // Toggle comparison response mode or restart
        if (responseMode === "safecut") {
          setResponseMode("quarantine");
          setCurrentStep(2);
        } else {
          setResponseMode("safecut");
          setCurrentStep(0);
        }
      }
    }, 4500);

    return () => {
      if (autoPlayTimer.current) clearTimeout(autoPlayTimer.current);
    };
  }, [isAutoPlaying, currentStep, responseMode]);

  function resetDemo() {
    setIsAutoPlaying(false);
    setCurrentStep(0);
    setResponseMode("safecut");
  }

  // Active certificate
  const activeCert = responseMode === "safecut" ? safecutCert : quarantineCert;

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col pt-20 md:pt-24">
      {/* ── Demo Run Control Bar ── */}
      <header className="border-b border-white/10 bg-muted/60 px-6 py-3 flex flex-wrap items-center justify-between gap-4 shrink-0 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
            <h1 className="font-display font-semibold text-lg tracking-tight">SafeCut Simulation Lab</h1>
          </div>
          <span className="px-2.5 py-0.5 border border-primary/40 bg-primary/10 text-primary text-[10px] font-mono tracking-widest uppercase rounded-sm">
            Self-Guided Demo Run
          </span>
        </div>

        {/* Scenario Pills */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground mr-1 hidden sm:inline">Scenario:</span>
          {SCENARIOS.map((sc, idx) => (
            <button
              key={sc.id}
              onClick={() => {
                setSelectedScenarioIndex(idx);
                setCurrentStep(0);
              }}
              className={`px-3 py-1 text-xs font-mono rounded-sm transition-all border ${
                selectedScenarioIndex === idx
                  ? "bg-primary text-primary-foreground border-primary font-bold shadow-sm"
                  : "bg-black/30 border-white/10 text-muted-foreground hover:bg-white/10"
              }`}
            >
              {sc.targetNode}
            </button>
          ))}
        </div>

        {/* Stepper Controls & Autoplay */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-mono transition-colors border ${
              isAutoPlaying
                ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                : "bg-white/5 hover:bg-white/10 text-foreground border-white/10"
            }`}
          >
            {isAutoPlaying ? <Pause size={13} /> : <Play size={13} />}
            {isAutoPlaying ? "Pause Auto-Run" : "Auto-Play Demo"}
          </button>

          <button
            onClick={resetDemo}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-mono text-muted-foreground hover:text-foreground bg-white/5 border border-white/10 rounded-sm"
            title="Reset to baseline nominal"
          >
            <RotateCcw size={12} />
            <span className="hidden sm:inline">Reset</span>
          </button>

          <Link
            href="/console"
            className="px-3 py-1 text-xs font-mono bg-primary/20 text-primary border border-primary/40 rounded-sm hover:bg-primary/30 transition-colors ml-2"
          >
            Live Console ↗
          </Link>
        </div>
      </header>

      {/* ── Main Interactive Split View ── */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        
        {/* ── LEFT PANE (4 Cols): Demo Stepper, Scenarios & Commands ── */}
        <aside className="lg:col-span-4 border-r border-white/10 bg-background flex flex-col p-5 overflow-y-auto space-y-6">
          
          {/* Target Scenario Card */}
          <div className="p-4 rounded-sm border border-white/10 bg-muted/20 relative overflow-hidden">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider">
                Active Industrial Target
              </span>
              <span className="font-mono text-xs font-bold text-destructive px-2 py-0.5 rounded-sm bg-destructive/10 border border-destructive/20">
                {scenario.targetNode}
              </span>
            </div>
            <h2 className="font-display font-semibold text-base mb-1">{scenario.name}</h2>
            <p className="text-xs text-muted-foreground mb-3">{scenario.subtitle}</p>

            <div className="space-y-1.5 text-[11px] font-mono bg-black/40 p-2.5 rounded-sm border border-white/5">
              <div>
                <span className="text-muted-foreground">Threat Actor: </span>
                <span className="text-gray-300">{scenario.adversaryRole}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Attack Vector: </span>
                <span className="text-amber-400/90">{scenario.vector}</span>
              </div>
            </div>
          </div>

          {/* Step Sequence Guide */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider">
                Demo Progression
              </h3>
              <span className="text-xs font-mono text-primary">
                Step {currentStep + 1} of 4
              </span>
            </div>

            <div className="space-y-2">
              {[
                {
                  step: 0,
                  title: "1. Baseline Nominal",
                  desc: "All 12 nodes communicating normally over Modbus TCP. Reactor temperature stable at 355 K.",
                },
                {
                  step: 1,
                  title: `2. Exploit Injected on ${scenario.targetNode}`,
                  desc: "Adversary gains foothold and transmits unauthorized register writes targeting plant loops.",
                },
                {
                  step: 2,
                  title: "3. Containment Execution",
                  desc: "Compare SafeCut (surgical minimum cut) versus Blind Quarantine (zone-wide shutdown).",
                },
                {
                  step: 3,
                  title: "4. Physical Dynamics & Safety Certificate",
                  desc: "Observe reactor ODE response and mathematical proof verifying SIF loop reachability.",
                },
              ].map((s) => (
                <button
                  key={s.step}
                  onClick={() => setCurrentStep(s.step as DemoStep)}
                  className={`w-full text-left p-3 rounded-sm border transition-all text-xs ${
                    currentStep === s.step
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-muted/10 border-white/5 hover:bg-white/5 text-muted-foreground"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-mono font-semibold ${currentStep === s.step ? "text-primary" : "text-foreground"}`}>
                      {s.title}
                    </span>
                    {currentStep > s.step ? (
                      <CheckCircle2 size={14} className="text-green-500" />
                    ) : currentStep === s.step ? (
                      <span className="w-2 h-2 rounded-full bg-primary animate-ping" />
                    ) : null}
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                    {s.desc}
                  </p>
                </button>
              ))}
            </div>

            {/* Stepper Navigation Buttons */}
            <div className="flex gap-2 mt-3">
              <button
                disabled={currentStep === 0}
                onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1) as DemoStep)}
                className="flex-1 py-1.5 px-3 rounded-sm border border-white/10 text-xs font-mono disabled:opacity-30 disabled:pointer-events-none hover:bg-white/5 flex items-center justify-center gap-1"
              >
                <ChevronLeft size={14} /> Back
              </button>
              <button
                disabled={currentStep === 3}
                onClick={() => setCurrentStep((prev) => Math.min(3, prev + 1) as DemoStep)}
                className="flex-1 py-1.5 px-3 rounded-sm bg-primary text-primary-foreground text-xs font-mono font-bold disabled:opacity-30 disabled:pointer-events-none hover:brightness-110 flex items-center justify-center gap-1"
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Response Toggle (SafeCut vs Quarantine) */}
          <div className="p-4 rounded-sm border border-white/10 bg-muted/20">
            <h3 className="text-xs font-mono font-bold text-muted-foreground uppercase tracking-wider mb-3">
              Evaluate Defense Strategy
            </h3>

            <div className="grid grid-cols-2 gap-2 mb-3">
              <button
                onClick={() => {
                  setResponseMode("safecut");
                  if (currentStep < 2) setCurrentStep(2);
                }}
                className={`p-3 rounded-sm border text-left font-mono transition-all ${
                  responseMode === "safecut" && currentStep >= 2
                    ? "bg-green-600/20 border-green-500 text-green-400 ring-1 ring-green-500"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-green-400">
                  <ShieldCheck size={14} />
                  SafeCut
                </div>
                <div className="text-[10px] mt-1 text-muted-foreground">
                  3 links cut · Loops preserved
                </div>
              </button>

              <button
                onClick={() => {
                  setResponseMode("quarantine");
                  if (currentStep < 2) setCurrentStep(2);
                }}
                className={`p-3 rounded-sm border text-left font-mono transition-all ${
                  responseMode === "quarantine" && currentStep >= 2
                    ? "bg-red-600/20 border-red-500 text-red-400 ring-1 ring-red-500"
                    : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                }`}
              >
                <div className="flex items-center gap-1.5 font-bold text-xs text-red-400">
                  <AlertTriangle size={14} />
                  Blind Quarantine
                </div>
                <div className="text-[10px] mt-1 text-muted-foreground">
                  8 links cut · Safety loop lost
                </div>
              </button>
            </div>

            {/* Strategy comparison callout */}
            <div className={`p-3 rounded-sm text-xs leading-relaxed font-sans border ${
              responseMode === "safecut"
                ? "bg-green-500/10 border-green-500/30 text-green-300"
                : "bg-red-500/10 border-red-500/30 text-red-300"
            }`}>
              <span className="font-bold uppercase font-mono block mb-1">
                {responseMode === "safecut" ? "SafeCut Result:" : "Quarantine Result:"}
              </span>
              {responseMode === "safecut" ? scenario.safecutSummary : scenario.quarantineSummary}
            </div>
          </div>

          {/* Real-time Status Card */}
          <div className="p-3 bg-black/40 border border-white/10 rounded-sm font-mono text-[11px] space-y-1">
            <div className="text-muted-foreground uppercase text-[10px] font-bold">Solver Metrics</div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Compute Latency:</span>
              <span className="text-green-400 font-bold">{safecutResult.solveTimeMs.toFixed(2)} ms</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Edges Severed:</span>
              <span className={responseMode === "safecut" ? "text-green-400" : "text-red-400"}>
                {currentStep >= 2 ? (responseMode === "safecut" ? safecutResult.cutEdges.length : quarantineEdges.length) : 0} links
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">SIF Loops Surviving:</span>
              <span className={graphState.reactorStable ? "text-green-400" : "text-red-400"}>
                {graphState.loopsPreserved} / {graphState.totalLoops} verified
              </span>
            </div>
          </div>

        </aside>

        {/* ── RIGHT PANE (8 Cols): Command Screen with Tabs ── */}
        <section className="lg:col-span-8 flex flex-col bg-background relative overflow-hidden">
          
          {/* Subtle Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none opacity-25">
            <Aurora colorStops={["#111318", "#C8862B", "#111318"]} speed={0.4} amplitude={1.0} />
          </div>

          {/* Screen Tabs */}
          <div className="flex items-center border-b border-white/10 bg-muted/40 shrink-0 z-10">
            <button
              onClick={() => setActiveTab("graph")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-wider border-r border-white/10 transition-colors ${
                activeTab === "graph"
                  ? "bg-background text-primary border-b-2 border-b-primary font-bold"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <Network size={14} />
              Network Graph
            </button>

            <button
              onClick={() => setActiveTab("telemetry")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-wider border-r border-white/10 transition-colors ${
                activeTab === "telemetry"
                  ? "bg-background text-primary border-b-2 border-b-primary font-bold"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <Activity size={14} />
              Process Telemetry (CSTR)
            </button>

            <button
              onClick={() => setActiveTab("certificate")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-wider border-r border-white/10 transition-colors ${
                activeTab === "certificate"
                  ? "bg-background text-primary border-b-2 border-b-primary font-bold"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <FileText size={14} />
              Safety Certificate
            </button>

            <button
              onClick={() => setActiveTab("logs")}
              className={`flex items-center gap-2 px-5 py-3 text-xs font-mono uppercase tracking-wider border-r border-white/10 transition-colors ${
                activeTab === "logs"
                  ? "bg-background text-primary border-b-2 border-b-primary font-bold"
                  : "text-muted-foreground hover:bg-white/5"
              }`}
            >
              <Terminal size={14} />
              Incident Audit Trail
            </button>
          </div>

          {/* Status Sub-Banner */}
          <div className="px-6 py-2.5 border-b border-white/10 bg-black/30 flex items-center justify-between text-xs font-mono shrink-0 z-10">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">State:</span>
              {currentStep === 0 && (
                <span className="text-green-400 font-bold">● Nominal Operation — All loops intact</span>
              )}
              {currentStep === 1 && (
                <span className="text-red-400 font-bold animate-pulse">
                  ⚠ Intrusion Detected on {scenario.targetNode} — Lateral Probe Active
                </span>
              )}
              {currentStep >= 2 && responseMode === "safecut" && (
                <span className="text-green-400 font-bold">
                  ✓ SafeCut Isolated {scenario.targetNode} · 3 links cut · Loops preserved · Plant Stable
                </span>
              )}
              {currentStep >= 2 && responseMode === "quarantine" && (
                <span className="text-red-400 font-bold">
                  ✗ Blind Zone Quarantine · 8 links severed · Cooling Loop Cut · Thermal Runaway
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-2.5 py-0.5 rounded-sm text-[11px] font-bold border ${
                graphState.reactorStable
                  ? "bg-green-500/10 text-green-400 border-green-500/30"
                  : "bg-red-500/10 text-red-400 border-red-500/30 animate-pulse"
              }`}>
                {graphState.reactorStable ? "REACTOR STABLE (~355 K)" : "RUNAWAY CRITICAL (>880 K)"}
              </span>
            </div>
          </div>

          {/* ── Tab Content Container ── */}
          <div className="flex-1 relative overflow-auto p-6 z-10">
            
            {/* TAB 1: Network Graph */}
            {activeTab === "graph" && (
              <div className="h-full flex flex-col gap-4">
                <div className="flex-1 min-h-[420px] rounded-md border border-white/10 bg-black/40 overflow-hidden relative">
                  <NetworkTopology
                    graph={OT_TOPOLOGY}
                    compromisedNode={graphState.node}
                    cutEdges={graphState.cutEdges}
                    attackPath={graphState.node ? [graphState.node] : []}
                    mode={graphState.mode}
                  />

                  {/* Legend Overlay */}
                  <div className="absolute bottom-3 left-3 bg-black/80 border border-white/10 p-2.5 rounded text-[10px] font-mono space-y-1 backdrop-blur-sm pointer-events-none">
                    <div className="font-bold text-muted-foreground uppercase text-[9px] mb-1">Topology Legend</div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> PLC Controller
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block ml-2" /> SIS Controller
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> HMI / SCADA
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-400 inline-block ml-2" /> Sensor / Actuator
                    </div>
                    <div className="flex items-center gap-2 pt-1 border-t border-white/10">
                      <span className="inline-block w-3 h-0.5 bg-green-400" /> Preserved SIF Loop
                      <span className="inline-block w-3 h-0.5 bg-red-500 border-dashed ml-2" /> Cut Edge
                    </div>
                  </div>
                </div>

                <div className="text-xs font-mono text-muted-foreground flex flex-wrap items-center justify-between gap-2 px-1">
                  <span>Purdue Model OT Topology (12 Nodes, 24 Industrial Ethernet & Fieldbus Links)</span>
                  <span className="text-primary">Click steps on the left or switch scenarios to view live graph changes</span>
                </div>
              </div>
            )}

            {/* TAB 2: Real-time Telemetry (CSTR) */}
            {activeTab === "telemetry" && (
              <DemoReactorTelemetry
                safecutData={safecutTelemetry}
                quarantineData={quarantineTelemetry}
                mode={currentStep < 2 ? "idle" : responseMode === "safecut" ? "safecut" : "quarantine"}
                currentStep={currentStep}
              />
            )}

            {/* TAB 3: Safety Loop Certificate */}
            {activeTab === "certificate" && (
              <div className="h-full flex flex-col gap-4">
                <CertificatePanel
                  certificate={currentStep >= 2 ? activeCert : null}
                />

                <div className="p-4 rounded-sm border border-white/10 bg-muted/20 text-xs font-mono space-y-2">
                  <div className="font-bold text-foreground text-sm flex items-center gap-2">
                    <ShieldCheck size={16} className="text-primary" />
                    How Mathematical Certification Works
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    Unlike heuristic IT quarantine tools, SafeCut enforces graph invariants during the Edmonds-Karp min-cut computation by assigning infinite edge capacity to all registered Safety-Instrumented Function (SIF) loops.
                  </p>
                  <p className="text-muted-foreground leading-relaxed">
                    Following cut calculation, an independent BFS reachability engine traverses the remaining graph from every safety sensor to its designated controller and safety valve. Only when 100% of safety loops are proven connected is the certificate issued and signed.
                  </p>
                </div>
              </div>
            )}

            {/* TAB 4: Incident Audit Trail */}
            {activeTab === "logs" && (
              <div className="h-full flex flex-col font-mono text-xs">
                <div className="flex-1 rounded-md border border-white/10 bg-black/60 p-4 overflow-y-auto space-y-2.5 text-gray-300">
                  <div className="text-muted-foreground text-[11px] border-b border-white/10 pb-2">
                    --- SafeCut Simulation Audit Trail [Log Stream Active] ---
                  </div>

                  <div className="flex items-start gap-2">
                    <span className="text-muted-foreground">[00:00.000]</span>
                    <span className="text-green-400">[SYSTEM]</span>
                    <span>Modbus plant operational. 12 Purdue nodes online. All 4 SIF loops verified intact.</span>
                  </div>

                  {currentStep >= 1 && (
                    <>
                      <div className="flex items-start gap-2 text-amber-300">
                        <span className="text-muted-foreground">[00:04.215]</span>
                        <span>[MONITOR]</span>
                        <span>Anomaly detected: Unauthorized Modbus function write on {scenario.targetNode}.</span>
                      </div>
                      <div className="flex items-start gap-2 text-red-400">
                        <span className="text-muted-foreground">[00:04.380]</span>
                        <span>[ALERT]</span>
                        <span>{scenario.vector}</span>
                      </div>
                    </>
                  )}

                  {currentStep >= 2 && responseMode === "safecut" && (
                    <>
                      <div className="flex items-start gap-2 text-cyan-300">
                        <span className="text-muted-foreground">[00:04.420]</span>
                        <span>[SAFECUT]</span>
                        <span>Executing Edmonds-Karp with safety-loop infinite capacities on OT graph...</span>
                      </div>
                      <div className="flex items-start gap-2 text-green-400">
                        <span className="text-muted-foreground">[00:04.421]</span>
                        <span>[SOLVER]</span>
                        <span>Solution found in {safecutResult.solveTimeMs.toFixed(2)} ms. Cut set: {safecutResult.cutEdges.map((e) => `${e.source}↔${e.target}`).join(", ")}.</span>
                      </div>
                      <div className="flex items-start gap-2 text-green-300">
                        <span className="text-muted-foreground">[00:04.425]</span>
                        <span>[CERTIFICATE]</span>
                        <span>Independent BFS reachability verified: 4 of 4 safety loops preserved. Reactor stable at 355 K.</span>
                      </div>
                    </>
                  )}

                  {currentStep >= 2 && responseMode === "quarantine" && (
                    <>
                      <div className="flex items-start gap-2 text-red-300">
                        <span className="text-muted-foreground">[00:04.420]</span>
                        <span>[LEGACY-IT]</span>
                        <span>Applying blind zone quarantine to {zoneOf(scenario.targetNode)?.name ?? "Target Zone"}...</span>
                      </div>
                      <div className="flex items-start gap-2 text-red-400">
                        <span className="text-muted-foreground">[00:04.430]</span>
                        <span>[NETWORK]</span>
                        <span>Severed {quarantineEdges.length} connections indiscriminately.</span>
                      </div>
                      <div className="flex items-start gap-2 text-destructive font-bold animate-pulse">
                        <span className="text-muted-foreground">[00:04.510]</span>
                        <span>[CRITICAL]</span>
                        <span>SIF_01 (Cooling Loop) broken. Reactor temperature rising rapidly: 355 K → 880 K. CATASTROPHIC FAILURE.</span>
                      </div>
                    </>
                  )}

                  <div className="text-muted-foreground text-[10px] pt-3">
                    Awaiting further operator commands...
                  </div>
                </div>
              </div>
            )}

          </div>

        </section>

      </div>
    </main>
  );
}
