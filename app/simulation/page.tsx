"use client";

import React, { useState, useEffect, useRef } from "react";
import { useScroll, motion, useTransform, AnimatePresence } from "motion/react";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import { computeSafeCut, verifyCertificate, computeBlindQuarantine } from "@/lib/safecut-engine";
import type { Certificate, CutEdge } from "@/types";
import TopologyGraph from "@/components/simulation/TopologyGraph";
import ScrollExpand from "@/components/ui/ScrollExpand";
import GooeyNav from "@/components/ui/GooeyNav";

// ─── Per-mode step content ─────────────────────────────────────────────────

const STEP_CONTENT = {
  safecut: [
    {
      step: "01",
      heading: "Baseline: Normal Operation",
      body: "The plant OT network is running normally. All 12 nodes — PLCs, HMIs, field devices, and engineering workstations — are communicating over Modbus TCP. Safety-Instrumented Function (SIF) loops are continuously monitored.",
    },
    {
      step: "02",
      heading: "Intrusion Detected at HMI",
      body: "An anomaly monitor detects an unsigned payload executed on the Human-Machine Interface node. The adversary has lateral movement capabilities and is probing toward PLC-A and the cooling loop controller.",
      isAlert: true,
      alertText: "> ALERT: Unsigned payload on HMI_01\n> SEVERITY: CRITICAL\n> AWAITING ISOLATION...",
    },
    {
      step: "03",
      heading: "SafeCut Execution",
      body: "SafeCut runs Edmonds-Karp on the full graph, treating SIF edges as infinite-capacity. It identifies the minimum cut: 3 links severed. Every safety loop retains a verified communication path.",
      highlight: "3 links cut — 4 of 4 SIF loops preserved.",
    },
    {
      step: "04",
      heading: "Certificate Issued",
      body: "An independent BFS reachability verifier traverses the post-cut graph from each SIF source. Every safety loop is confirmed intact. The certificate is cryptographically signed and immutable.",
      highlight: "Certificate: all_safe = true",
    },
    {
      step: "05",
      heading: "Plant Continues Running",
      body: "The attacker is isolated. The physical plant keeps operating normally — no process interruptions, no reactor runaway, no false shutdowns. The operator receives a full incident report.",
    },
  ],
  quarantine: [
    {
      step: "01",
      heading: "Baseline: Normal Operation",
      body: "The plant OT network is running normally. All 12 nodes are communicating over Modbus TCP. Safety-Instrumented Function (SIF) loops are continuously monitored.",
    },
    {
      step: "02",
      heading: "Intrusion Detected at HMI",
      body: "The same intrusion is detected at the HMI node. An IT-native quarantine tool immediately drops all connections from the infected subnet.",
      isAlert: true,
      alertText: "> ALERT: Unsigned payload on HMI_01\n> ACTION: Dropping all HMI subnet links\n> SEVERING 8 CONNECTIONS...",
    },
    {
      step: "03",
      heading: "Blind Quarantine Applied",
      body: "8 links are severed indiscriminately. Along with the attacker's path, the tool severs the Cooling Loop SIF's communication path to the Emergency Shutdown controller. The safety system is now blind.",
      highlight: "8 links cut — safety loop severed.",
      isDanger: true,
    },
    {
      step: "04",
      heading: "Safety System Fails",
      body: "Without the Cooling Loop signal, the Emergency Shutdown System cannot receive an inhibit command. The reactor begins to over-temperature. The very failure the defense was meant to prevent is now in progress.",
      isDanger: true,
      highlight: "Reactor temp rising. No shutdown signal.",
    },
    {
      step: "05",
      heading: "Cascading Failure",
      body: "The attacker achieved their objective without doing anything further — the blind quarantine caused the physical damage. This is the documented Triton/Trisis attack pattern.",
      isDanger: true,
    },
  ],
} as const;

type Mode = "safecut" | "quarantine";

// ─── Component ────────────────────────────────────────────────────────────

export default function SimulationPage() {
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [mode, setMode] = useState<Mode>("safecut");

  const compromisedNode = "HMI";

  const [safecutEdges, setSafecutEdges] = useState<CutEdge[]>([]);
  const [quarantineEdges, setQuarantineEdges] = useState<CutEdge[]>([]);
  const [certificate, setCertificate] = useState<Certificate | null>(null);

  useEffect(() => {
    const scResult = computeSafeCut({ graph: OT_TOPOLOGY, compromisedNode });
    setSafecutEdges(scResult.cutEdges);
    setCertificate(verifyCertificate(OT_TOPOLOGY, scResult.cutEdges));
    setQuarantineEdges(computeBlindQuarantine(OT_TOPOLOGY, compromisedNode));
  }, []);

  // Bind scroll to the right column specifically
  const { scrollYProgress } = useScroll({
    target: rightColumnRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    return scrollYProgress.on("change", (v) => {
      const step = Math.min(4, Math.floor(v * 5));
      setActiveStep(step);
    });
  }, [scrollYProgress]);

  const stepLabel = useTransform(
    scrollYProgress,
    [0, 0.2, 0.4, 0.6, 0.8, 1],
    ["01", "01", "02", "03", "04", "05"]
  );

  const activeEdges: CutEdge[] =
    activeStep >= 2 && activeStep <= 3
      ? mode === "safecut"
        ? safecutEdges
        : quarantineEdges
      : [];

  const steps = STEP_CONTENT[mode];
  const currentStep = steps[Math.min(activeStep, steps.length - 1)];

  const isSafe = mode === "safecut";

  return (
    <main className="flex flex-col min-h-screen bg-background text-foreground">

      {/* ── ScrollExpand intro ── */}
          <ScrollExpand
        imageUrl="/simulation_entry_blueprint.jpg"
        expandRatio={0.7}
        scrollDuration="150%"
      >
        <div className="text-center px-4">
          <p className="font-mono text-xs tracking-widest uppercase text-primary mb-4">
            Interactive Simulation
          </p>
          <h1 className="text-4xl md:text-6xl font-display font-semibold mb-4 text-white drop-shadow-2xl leading-tight">
            Here&apos;s how it works.
          </h1>
          <p className="text-base md:text-lg text-white/70 font-mono max-w-sm mx-auto">
            Five verifiable steps. Scroll to begin.
          </p>
        </div>
      </ScrollExpand>

      {/* ── Mode toggle ── */}
      <div className="flex items-center justify-center py-8 border-b border-white/10">
        <GooeyNav
          items={[{ label: "SafeCut" }, { label: "Blind Quarantine" }]}
          initialActiveIndex={0}
          onChange={(idx: number) => {
            setMode(idx === 0 ? "safecut" : "quarantine");
            setActiveStep(0);
          }}
        />
      </div>

      {/* ── Split-window layout ── */}
      <div className="relative w-full flex flex-col md:flex-row">

        {/* LEFT — Sticky graph panel */}
        <div className="
          md:sticky md:top-[88px] md:h-[calc(100vh-88px)]
          w-full md:w-1/2
          flex flex-col
          border-b md:border-b-0 md:border-r border-white/10
          bg-background
          h-[40vh] md:h-auto
        ">
          {/* Panel header */}
          <div className="flex items-center gap-3 px-5 py-3 border-b border-white/10 shrink-0">
            <span className={`w-2 h-2 rounded-full ${isSafe ? "bg-[#1F9D55] animate-pulse" : "bg-destructive"}`} />
            <span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Live Graph — {isSafe ? "SafeCut Mode" : "Blind Quarantine Mode"}
            </span>
          </div>

          {/* Graph */}
          <div className="flex-1 relative overflow-hidden">
            <TopologyGraph
              graph={OT_TOPOLOGY}
              compromisedNode={activeStep > 0 && activeStep < 4 ? compromisedNode : null}
              step={activeStep}
              cutEdges={activeEdges}
            />
          </div>

          {/* Status badge */}
          <AnimatePresence mode="wait">
            {activeStep >= 2 && (
              <motion.div
                key={`${mode}-status`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                className={`shrink-0 mx-4 mb-4 p-3 border font-mono text-xs ${
                  isSafe
                    ? "border-[#1F9D55]/40 bg-[#1F9D55]/5 text-[#1F9D55]"
                    : "border-destructive/40 bg-destructive/5 text-destructive"
                }`}
              >
                {isSafe && certificate
                  ? `VERIFIED — ${certificate.sifResults.filter((r) => r.preserved).length}/${certificate.sifResults.length} SIF loops intact`
                  : "SAFETY CRITICAL — Cooling loop severed"}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Vertical divider (md) */}
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-white/10" />

        {/* RIGHT — Scrolling narrative */}
        <div
          ref={rightColumnRef}
          className="w-full md:w-1/2 relative"
        >
          {/* Sticky walkthrough header */}
          <div className="sticky top-[88px] z-20 flex items-center gap-3 px-8 py-3 border-b border-white/10 bg-background/90 backdrop-blur-sm">
            <motion.span className="font-mono text-xs tracking-widest uppercase text-muted-foreground">
              Walkthrough
            </motion.span>
            <span className="font-mono text-xs text-primary">
              — STEP {String(activeStep + 1).padStart(2, "0")}
            </span>
          </div>

          {/* One screen-tall section per step */}
          {steps.map((s, i) => (
            <div
              key={`${mode}-step-${i}`}
              className="min-h-screen flex items-center justify-start p-8 md:p-12"
            >
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ amount: 0.4, once: false }}
                transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                className="max-w-md"
              >
                <span className="font-mono text-xs text-primary tracking-widest mb-4 block">
                  {s.step}.
                </span>
                <h2
                  className={`text-2xl md:text-3xl font-display font-semibold mb-4 ${
                    "isDanger" in s && s.isDanger ? "text-destructive" : ""
                  }`}
                >
                  {s.heading}
                </h2>
                <p className="text-base text-muted-foreground leading-relaxed font-sans mb-6">
                  {s.body}
                </p>

                {"isAlert" in s && s.isAlert && (
                  <pre className={`p-4 border font-mono text-xs leading-relaxed whitespace-pre-wrap ${
                    "isDanger" in currentStep && currentStep.isDanger
                      ? "border-destructive/30 bg-destructive/10 text-destructive"
                      : "border-destructive/30 bg-destructive/10 text-destructive"
                  }`}>
                    {s.alertText}
                  </pre>
                )}

                {"highlight" in s && s.highlight && (
                  <div
                    className={`mt-4 px-4 py-3 border-l-2 font-mono text-sm ${
                      "isDanger" in s && s.isDanger
                        ? "border-destructive text-destructive"
                        : "border-primary text-primary"
                    }`}
                  >
                    {s.highlight}
                  </div>
                )}
              </motion.div>
            </div>
          ))}

          {/* Final CTA at end of scroll */}
          <div className="min-h-[50vh] flex items-center justify-start p-8 md:p-12 border-t border-white/10">
            <div className="max-w-md">
              <p className="font-mono text-xs text-primary tracking-widest mb-4">Next</p>
              <h2 className="text-2xl font-display font-semibold mb-4">
                {isSafe
                  ? "See it live in the Defender Console."
                  : "Compare with SafeCut — toggle the mode above."}
              </h2>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                {isSafe
                  ? "The console runs the real Edmonds-Karp solver on live Supabase event streams, with cryptographic certificate signing."
                  : "Switch to SafeCut mode to see how 3 targeted cuts preserve every safety loop."}
              </p>
              {isSafe && (
                <a
                  href="/console"
                  className="inline-flex items-center px-6 py-3 font-semibold text-sm bg-primary text-primary-foreground hard-shadow hover:bg-primary/85 transition-colors"
                  style={{ borderRadius: 2 }}
                >
                  Open Defender Console
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
