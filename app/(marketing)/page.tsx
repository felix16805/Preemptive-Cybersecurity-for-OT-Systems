"use client";

import Link from "next/link";
import FoldText from "@/components/ui/FoldText";
import ModelViewer from "@/components/ui/ModelViewer";

export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col items-center">

      {/* ── Hero ── */}
      <section
        className="relative w-full flex items-center border-b border-black/10 dark:border-white/10 overflow-clip min-h-screen"
      >

        {/* 3D Model Viewer */}
        <div className="absolute inset-0 z-0 flex justify-center items-center pointer-events-none translate-x-[20vw] -translate-y-[4vh]" style={{ maskImage: "radial-gradient(circle at center, black 40%, transparent 80%)", opacity: 0.8 }}>
          <ModelViewer
            url="/safecut_ot_pipeline_graph_v4.glb"
            width="175%"
            height="175%"
            enableMouseParallax={false}
            enableHoverRotation={false}
            enableManualZoom={false}
            enableManualRotation={false}
            showScreenshotButton={false}
            ambientIntensity={0.85}
            keyLightIntensity={2.2}
            rimLightIntensity={1.2}
            environmentPreset="city"
            defaultZoom={3.8}
            modelXOffset={0}
            defaultRotationX={-65}
            defaultRotationY={55}
            defaultRotationZ={0}
            autoRotate={true}
            autoRotateSpeed={-0.01}
            pulseZoom={false}
            autoFrame={false}
          />
        </div>



        {/* Content */}
        <div className="relative z-10 w-full max-w-6xl mx-auto px-6 py-24 md:py-32 flex flex-col items-start">

          {/* Status pill */}
          <div className="flex items-center gap-2 mb-8">
            <span
              className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
              style={{ backgroundColor: "#1F9D55" }}
            />
            <span
              className="font-mono text-xs tracking-widest uppercase"
              style={{ color: "#1F9D55" }}
            >
              Safety Systems — All Loops Verified Intact
            </span>
          </div>

          <div style={{ maxWidth: "min(672px, 90vw)", marginBottom: "2rem" }}>
            <FoldText
              text={"Isolate the attacker."}
              className="font-display font-semibold tracking-tight leading-[1.05] text-[#111318] dark:text-[#F5F3EE] drop-shadow-none dark:drop-shadow-[0_2px_32px_rgba(0,0,0,0.85)]"
              style={{
                fontSize: "clamp(2.25rem, 5vw, 4.25rem)",
                display: "block",
              }}
              splitBy="word"
              hinge="top"
              duration={0.65}
              stagger={0.045}
            />
            <FoldText
              text={"Preserve the safety system."}
              className="font-display font-semibold tracking-tight leading-[1.05] text-[#C8862B] drop-shadow-none dark:drop-shadow-[0_2px_32px_rgba(0,0,0,0.85)]"
              style={{
                fontSize: "clamp(2.25rem, 5vw, 4.25rem)",
                display: "block",
                marginTop: "0.2em",
              }}
              splitBy="word"
              hinge="top"
              duration={0.65}
              stagger={0.045}
            />
          </div>

          <p
            className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed font-sans text-gray-800 dark:text-gray-400"
          >
            SafeCut computes the minimum set of network links to sever
            that isolates an industrial intruder — while mathematically
            certifying that every safety-instrumented function loop remains
            connected.
          </p>

          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 font-semibold text-sm tracking-tight transition-colors"
              style={{
                backgroundColor: "#C8862B",
                color: "#111318",
                borderRadius: 2,
                boxShadow: "2px 2px 0 0 rgba(0,0,0,0.6)",
              }}
            >
              Request a live console session
            </Link>
            <Link
              href="/simulation"
              className="inline-flex items-center justify-center px-6 py-3 font-semibold text-sm tracking-tight transition-colors border border-black/30 dark:border-white/30 text-foreground bg-black/5 dark:bg-white/10"
              style={{
                borderRadius: 2,
              }}
            >
              View Interactive Simulation
            </Link>
          </div>

          {/* Proof numbers */}
          <div
            className="flex flex-col sm:flex-row gap-8 mt-16 pt-8 w-full max-w-lg transition-colors duration-500 border-t border-black/15 dark:border-white/15"
          >
            {[
              { n: "3", label: "Network links cut", sub: "minimum, never more" },
              { n: "4/4", label: "SIF loops preserved", sub: "mathematically certified" },
              { n: "<50ms", label: "Solver latency", sub: "on a 12-node OT graph" },
            ].map((s) => (
              <div key={s.n} className="flex flex-col drop-shadow-none dark:drop-shadow-[0_1px_6px_rgba(0,0,0,0.7)]">
                <span className="font-mono text-2xl font-bold text-[#C8862B]">{s.n}</span>
                <span className="text-sm font-medium mt-1 text-gray-900 dark:text-white">{s.label}</span>
                <span className="text-xs text-black/55 dark:text-white/55">{s.sub}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="w-full max-w-6xl mx-auto px-6 py-24 border-b border-black/10 dark:border-white/10">
        <div className="grid md:grid-cols-2 gap-16">
          <div>
            <h2 className="text-3xl font-display font-medium mb-6">
              The Failure of Blind Quarantine
            </h2>
            <p className="text-muted-foreground text-lg leading-relaxed mb-6">
              When conventional IT security tools detect a threat, their default action is a blind
              quarantine of the infected zone. In an Operational Technology (OT) environment, this
              approach is disastrous.
            </p>
            <p className="text-muted-foreground text-lg leading-relaxed">
              By indiscriminately severing network links, blind quarantine breaks the communication
              paths of Safety Instrumented Systems — cutting cooling loops or pressure-release
              signals — causing the exact catastrophic failure the defense was meant to prevent.
            </p>
          </div>
          <div className="space-y-6">
            <div
              className="p-6 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
              style={{
                boxShadow: "2px 2px 0 0 rgba(0,0,0,0.35)",
              }}
            >
              <h3 className="font-mono text-xs font-bold mb-3 tracking-widest uppercase" style={{ color: "#C8862B" }}>
                Incident: Triton / Trisis
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                Adversaries specifically targeted Triconex Safety Instrumented Systems, proving that
                safety controllers are primary targets. Generic IT segmentation tools fail to account
                for the physical consequences of disconnecting these controllers.
              </p>
            </div>
            <div
              className="p-6 border border-black/10 dark:border-white/10 bg-black/5 dark:bg-white/5"
              style={{
                boxShadow: "2px 2px 0 0 rgba(0,0,0,0.35)",
              }}
            >
              <h3 className="font-mono text-xs font-bold mb-3 tracking-widest uppercase" style={{ color: "#C43D3D" }}>
                Incident: Colonial Pipeline
              </h3>
              <p className="text-muted-foreground text-sm leading-relaxed">
                The pipeline was shut down not because the OT network was compromised, but out of
                caution due to a lack of provable segmentation between IT and OT systems.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Solution ── */}
      <section className="w-full max-w-6xl mx-auto px-6 py-24">
        <div className="flex items-baseline gap-4 mb-12">
          <span className="font-mono text-xs tracking-widest uppercase" style={{ color: "#C8862B" }}>Method</span>
          <h2 className="text-3xl font-display font-medium">The SafeCut Methodology</h2>
        </div>
        <div className="grid md:grid-cols-3 gap-0">
          {[
            {
              n: "01",
              title: "Continuous Monitoring",
              desc: "Monitors intercept unauthorized commands and anomalous register writes at the Modbus process level.",
            },
            {
              n: "02",
              title: "Safety-Constrained Min-Cut",
              desc: "SafeCut runs Edmonds-Karp treating all critical safety edges as infinite capacity, so they can never be selected as cut candidates.",
            },
            {
              n: "03",
              title: "Mathematical Certificate",
              desc: "An independent BFS reachability verifier confirms the cut isolates the attacker while proving every SIF loop survived.",
            },
          ].map((step, i) => (
            <div
              key={step.n}
              className={`flex flex-col pt-6 pb-8 border-t border-black/10 dark:border-white/10 ${i < 2 ? 'border-r border-black/10 dark:border-white/10' : ''}`}
              style={{
                paddingLeft: i > 0 ? "2.5rem" : 0,
                paddingRight: i < 2 ? "2.5rem" : 0,
              }}
            >
              <span className="font-mono text-xs mb-4 tracking-widest" style={{ color: "#C8862B" }}>{step.n}.</span>
              <h3 className="text-xl font-display font-medium mb-3">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA strip ── */}
      <section className="w-full border-t border-black/10 dark:border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-20 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
          <div>
            <h2 className="text-2xl font-display font-semibold mb-2">
              Ready to see the cut in action?
            </h2>
            <p className="text-muted-foreground text-base">
              Run the simulation yourself — or request a live console session with the real solver.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 shrink-0">
            <Link
              href="/simulation"
              className="inline-flex items-center justify-center px-6 py-3 font-semibold text-sm tracking-tight transition-colors"
              style={{
                backgroundColor: "#C8862B",
                color: "#111318",
                borderRadius: 2,
                boxShadow: "2px 2px 0 0 rgba(0,0,0,0.4)",
              }}
            >
              Open Simulation
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center px-6 py-3 font-semibold text-sm tracking-tight border border-black/20 hover:border-black/40 dark:border-white/20 dark:hover:border-white/40 transition-colors"
              style={{ borderRadius: 2 }}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}