import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden flex flex-col items-center justify-center px-6">
      {/* ── Ambient background glows ── */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-32 -left-32 w-[600px] h-[600px] rounded-full bg-accent-red/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-32 w-[600px] h-[600px] rounded-full bg-accent-cyan/10 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] rounded-full bg-accent-blue/5 blur-[80px]" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: `
              linear-gradient(rgba(34,211,238,0.08) 1px, transparent 1px),
              linear-gradient(90deg, rgba(34,211,238,0.08) 1px, transparent 1px)
            `,
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* ── Badge ── */}
      <div className="relative z-10 mb-6 animate-fade-in">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase bg-accent-red/10 border border-accent-red/30 text-accent-red">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-red animate-pulse" />
          Live Threat Response System
        </span>
      </div>

      {/* ── Headline ── */}
      <div className="relative z-10 text-center max-w-4xl animate-fade-in">
        <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mb-6">
          <span className="text-gradient-cyan">SafeCut</span>
          <br />
          <span className="text-text-primary">Isolate the attacker.</span>
          <br />
          <span className="text-text-secondary font-light">Not the safety system.</span>
        </h1>

        <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-4 leading-relaxed">
          SafeCut computes the <span className="text-accent-cyan font-semibold">exact network cut</span> that
          traps an industrial network intruder — while{" "}
          <span className="text-accent-green font-semibold">mathematically guaranteeing</span> every
          safety-instrumented function loop stays intact.
        </p>

        <p className="text-sm text-text-muted max-w-xl mx-auto mb-10">
          Conventional tools quarantine blindly — severing cooling loops, disabling pressure valves,
          triggering the disaster they were meant to prevent. SafeCut routes around them.
        </p>

        {/* ── CTA buttons ── */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/dashboard"
            className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-accent-cyan text-bg-base font-bold text-base tracking-wide transition-all duration-300 hover:bg-accent-cyan/90 hover:scale-105 shadow-lg shadow-accent-cyan/20 hover:shadow-accent-cyan/40"
          >
            <span>Launch Dashboard</span>
            <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </Link>

          <a
            href="#architecture"
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-text-muted/30 text-text-secondary font-medium text-base transition-all duration-200 hover:border-accent-cyan/40 hover:text-accent-cyan"
          >
            View Architecture
          </a>
        </div>
      </div>

      {/* ── Metrics strip ── */}
      <div className="relative z-10 mt-20 grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-3xl animate-fade-in">
        {[
          { label: "Network Nodes",        value: "12",     unit: "devices",    color: "text-accent-cyan"  },
          { label: "Safety-Critical",      value: "5",      unit: "nodes",      color: "text-accent-green" },
          { label: "SIF Loops Protected",  value: "4",      unit: "loops",      color: "text-accent-green" },
          { label: "Solver Speed",         value: "<1",     unit: "ms",         color: "text-accent-amber" },
        ].map((m) => (
          <div key={m.label} className="glass rounded-xl p-5 text-center">
            <div className={`text-3xl font-black ${m.color}`}>{m.value}</div>
            <div className="text-xs text-text-muted mt-0.5">{m.unit}</div>
            <div className="text-xs text-text-secondary mt-1 font-medium">{m.label}</div>
          </div>
        ))}
      </div>

      {/* ── Architecture section ── */}
      <section id="architecture" className="relative z-10 mt-24 w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-center mb-8 text-text-primary">
          Seven-Stage Response Pipeline
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {[
            { n: "1", title: "Network Model",       desc: "Graph: nodes=devices, edges=links, tagged SIF paths" },
            { n: "2", title: "Threat Detection",    desc: "Monitor detects unauthorized Modbus register write" },
            { n: "3", title: "Min-Cut Solver",      desc: "Edmonds-Karp with ∞-capacity safety edges" },
            { n: "4", title: "Certificate",         desc: "BFS verifier independently proves SIF loop survival" },
            { n: "5", title: "Enforcement",         desc: "Cut → live nftables firewall rules" },
            { n: "6", title: "Process Validation",  desc: "CSTR reactor responds — stable vs runaway" },
            { n: "7", title: "Dashboard",           desc: "Real-time topology, threat, certificate, reactor" },
          ].map((step, i) => (
            <div key={i} className="relative flex flex-col items-center text-center">
              <div className="w-9 h-9 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan font-bold text-sm mb-2">
                {step.n}
              </div>
              <div className="text-xs font-semibold text-text-primary mb-1">{step.title}</div>
              <div className="text-xs text-text-muted leading-snug">{step.desc}</div>
              {i < 6 && (
                <div className="hidden md:block absolute top-4 left-[calc(50%+18px)] right-[-50%] h-px bg-accent-cyan/20" />
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── SDG / TRL strip ── */}
      <div className="relative z-10 mt-16 mb-12 flex flex-wrap gap-3 justify-center">
        {[
          { tag: "SDG 9",  desc: "Industry, Innovation & Infrastructure" },
          { tag: "SDG 12", desc: "Responsible Consumption & Production"   },
          { tag: "TRL 4",  desc: "Lab-Validated Prototype"                },
        ].map((item) => (
          <span
            key={item.tag}
            className="px-4 py-2 rounded-lg glass text-xs font-semibold text-text-secondary"
          >
            <span className="text-accent-cyan">{item.tag}</span>{" · "}{item.desc}
          </span>
        ))}
      </div>
    </main>
  );
}
