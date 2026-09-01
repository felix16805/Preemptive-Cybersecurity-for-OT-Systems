import Link from "next/link";
import NetworkTopology from "@/components/NetworkTopology";
import { OT_TOPOLOGY } from "@/lib/ot-topology";

export default function HomePage() {
  return (
    <main className="flex-1">
      {/* ── Hero Section ── */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden">
        {/* Ambient background with static topology render */}
        <div className="absolute inset-0 pointer-events-none opacity-30">
          <div className="absolute inset-0 bg-gradient-to-b from-bg-base via-bg-base/50 to-bg-base z-10" />
          <NetworkTopology 
            graph={OT_TOPOLOGY} 
            mode="idle" 
            compromisedNode={null} 
            cutEdges={[]} 
            attackPath={[]} 
          />
        </div>

        <div className="container mx-auto px-6 relative z-20 mt-16">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-7xl font-black tracking-tight leading-tight mb-6">
              <span className="text-gradient-cyan">SafeCut</span>
              <br />
              <span className="text-text-primary">Isolate the attacker.</span>
              <br />
              <span className="text-text-secondary font-light">Not the safety system.</span>
            </h1>

            <p className="text-lg md:text-xl text-text-secondary max-w-2xl mx-auto mb-12 leading-relaxed">
              SafeCut computes the exact network cut that traps an industrial network intruder — while mathematically guaranteeing every safety-instrumented function loop stays intact.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link
                href="/dashboard"
                className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-accent-cyan text-bg-base font-bold text-base tracking-wide transition-all duration-300 hover:bg-accent-cyan/90 hover:scale-105 shadow-lg shadow-accent-cyan/20"
              >
                <span>Launch Dashboard</span>
                <svg className="w-5 h-5 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>

              <Link
                href="/architecture"
                className="inline-flex items-center gap-2 px-8 py-4 rounded-xl border border-text-muted/30 text-text-secondary font-medium text-base transition-all duration-200 hover:border-accent-cyan/40 hover:text-accent-cyan"
              >
                View Architecture
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Problem ── */}
      <section className="py-24 bg-bg-surface/50 border-y border-white/5">
        <div className="container mx-auto px-6 max-w-5xl">
          <h2 className="text-2xl font-bold text-text-primary mb-12 text-center">The Problem with Blind Quarantine</h2>
          
          <p className="text-text-secondary text-lg leading-relaxed mb-12 max-w-3xl mx-auto text-center">
            Conventional OT security tools quarantine networks blindly upon detecting a threat. By severing critical communication paths—like cooling loops or pressure release valves—the automated defense often triggers the exact disaster it was meant to prevent.
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="glass p-8 rounded-2xl border-l-4 border-l-accent-amber">
              <h3 className="font-bold text-accent-amber mb-2">TRITON / TRISIS</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                Adversaries specifically targeted Triconex Safety Instrumented Systems (SIS), proving that safety controllers are now primary targets, not just bystanders.
              </p>
            </div>
            <div className="glass p-8 rounded-2xl border-l-4 border-l-accent-red">
              <h3 className="font-bold text-accent-red mb-2">Colonial Pipeline</h3>
              <p className="text-sm text-text-muted leading-relaxed">
                The pipeline was shut down not because the OT network was compromised, but out of an abundance of caution due to a lack of provable segmentation between IT and OT.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── The Insight ── */}
      <section className="py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-accent-cyan/5" />
        <div className="container mx-auto px-6 text-center relative z-10">
          <p className="text-3xl md:text-5xl font-black text-text-primary max-w-4xl mx-auto leading-tight tracking-tight">
            Containment and safety are <span className="text-gradient-cyan">not the same problem</span>.
          </p>
        </div>
      </section>

      {/* ── How It Works (3 Steps) ── */}
      <section className="py-24 bg-bg-surface/30">
        <div className="container mx-auto px-6 max-w-6xl">
          <h2 className="text-2xl font-bold text-text-primary mb-16 text-center">How SafeCut Works</h2>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            {/* Connecting line */}
            <div className="hidden md:block absolute top-8 left-[10%] right-[10%] h-px bg-white/10" />
            
            {[
              { n: "01", title: "Detect", desc: "Monitors detect unauthorized behavior or anomalous register writes on the OT network." },
              { n: "02", title: "Constrained Cut", desc: "SafeCut computes an Edmonds-Karp min-cut, treating all safety loop edges as infinite capacity." },
              { n: "03", title: "Verified Certificate", desc: "An independent verifier checks reachability to mathematically prove every SIF loop survived." }
            ].map((step, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-bg-card border border-accent-cyan/30 shadow-lg shadow-accent-cyan/10 flex items-center justify-center text-accent-cyan font-black text-xl mb-6">
                  {step.n}
                </div>
                <h3 className="text-lg font-bold text-text-primary mb-3">{step.title}</h3>
                <p className="text-sm text-text-muted leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Results Strip ── */}
      <section className="py-24">
        <div className="container mx-auto px-6 max-w-5xl">
          <div className="glass rounded-3xl overflow-hidden">
            <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
              
              <div className="p-12 text-center bg-accent-red/5">
                <h3 className="text-sm font-bold tracking-widest uppercase text-accent-red mb-8">Blind Quarantine</h3>
                <div className="space-y-6">
                  <div>
                    <div className="text-4xl font-black text-white mb-1">0 / 4</div>
                    <div className="text-xs text-text-muted">Safety Loops Preserved</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-accent-red mb-1">Runaway</div>
                    <div className="text-xs text-text-muted">Reactor Outcome</div>
                  </div>
                </div>
              </div>

              <div className="p-12 text-center bg-accent-cyan/5">
                <h3 className="text-sm font-bold tracking-widest uppercase text-accent-cyan mb-8">SafeCut</h3>
                <div className="space-y-6">
                  <div>
                    <div className="text-4xl font-black text-accent-cyan mb-1">4 / 4</div>
                    <div className="text-xs text-text-muted">Safety Loops Preserved</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold text-accent-green mb-1">Stable</div>
                    <div className="text-xs text-text-muted">Reactor Outcome</div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </div>
      </section>

      {/* ── Closing CTA ── */}
      <section className="py-24 text-center">
        <h2 className="text-3xl font-bold text-text-primary mb-8">See SafeCut in Action</h2>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-3 px-8 py-4 rounded-xl bg-accent-cyan text-bg-base font-bold text-base tracking-wide transition-all duration-300 hover:bg-accent-cyan/90 hover:scale-105 shadow-lg shadow-accent-cyan/20"
        >
          Launch Dashboard
        </Link>
      </section>
    </main>
  );
}
