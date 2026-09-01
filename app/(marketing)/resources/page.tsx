import React from "react";
import Link from "next/link";

export default function ResourcesPage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-black text-text-primary mb-12 tracking-tight">Resources</h1>

        <section className="mb-16">
          <h2 className="text-xl font-bold text-accent-cyan mb-6 uppercase tracking-widest text-sm">Literature Survey Summary</h2>
          <div className="glass p-8 rounded-2xl text-text-secondary text-sm leading-relaxed space-y-4">
            <p>Our research analyzed four primary streams in industrial cybersecurity literature:</p>
            <ul className="list-disc pl-5 space-y-2 text-text-muted">
              <li><strong>Network Segmentation:</strong> Traditional models like the Purdue Enterprise Reference Architecture provide strong static boundaries but lack dynamic response capabilities.</li>
              <li><strong>Intrusion Detection Systems (IDS):</strong> Advanced anomaly detection can identify threats quickly but relies on human operators to formulate a safe response.</li>
              <li><strong>Automated Response (SOAR):</strong> IT-centric orchestration tools apply immediate containment (quarantine) but are unaware of physical process dependencies, often causing catastrophic shutdowns.</li>
              <li><strong>Graph-Theoretic Security:</strong> Network topology analysis provides mathematical rigor, but prior work focused primarily on vulnerability scoring rather than real-time containment guarantees.</li>
            </ul>
            <p className="font-semibold text-text-primary mt-4 pt-4 border-t border-white/10">
              The identified gap: There is no existing solution that bridges automated containment with real-time, mathematically proven safety guarantees for OT environments.
            </p>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-bold text-accent-cyan mb-6 uppercase tracking-widest text-sm">References</h2>
          <div className="space-y-4">
            {[
              { id: "1", title: "NIST Special Publication 800-82 Revision 3", desc: "Guide to Operational Technology (OT) Security." },
              { id: "2", title: "ISA/IEC 62443", desc: "Security for Industrial Automation and Control Systems." },
              { id: "3", title: "Edmonds, J., & Karp, R. M. (1972)", desc: "Theoretical Improvements in Algorithmic Efficiency for Network Flow Problems. Journal of the ACM." }
            ].map((ref) => (
              <div key={ref.id} className="glass p-4 rounded-xl flex gap-4 items-center">
                <div className="text-accent-cyan font-mono font-bold">[{ref.id}]</div>
                <div>
                  <div className="font-bold text-text-primary text-sm">{ref.title}</div>
                  <div className="text-xs text-text-muted">{ref.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-bold text-accent-cyan mb-6 uppercase tracking-widest text-sm">Glossary</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { term: "SIF", def: "Safety Instrumented Function; a specific control loop designed to prevent or mitigate a hazardous event." },
              { term: "SIS", def: "Safety Instrumented System; composed of sensors, logic solvers, and final control elements that execute SIFs." },
              { term: "Min-Cut", def: "The minimum capacity set of edges that, if removed, would disconnect the source from the sink in a flow network." },
              { term: "Purdue Model", def: "A reference architecture model for ICS segmentation, dividing networks into hierarchical zones." },
              { term: "CSTR", def: "Continuous Stirred-Tank Reactor; a standard chemical engineering model used here to simulate physical process stability." },
            ].map((item) => (
              <div key={item.term} className="glass p-5 rounded-xl">
                <div className="font-bold text-accent-cyan mb-1">{item.term}</div>
                <div className="text-sm text-text-muted leading-relaxed">{item.def}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-bold text-accent-cyan mb-6 uppercase tracking-widest text-sm">Links</h2>
          <div className="flex gap-4">
            <Link href="https://github.com/felix16805/Preemptive-Cybersecurity-for-OT-Systems" className="px-6 py-3 rounded-lg bg-bg-surface border border-white/10 hover:border-accent-cyan/50 text-sm font-semibold transition-colors flex items-center gap-2">
              GitHub Repository
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
