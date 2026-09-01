import React from "react";
import TechStackSlide from "@/components/TechStackSlide";

export default function ArchitecturePage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-black text-text-primary mb-12 tracking-tight">System Architecture</h1>

        {/* ── Pipeline ── */}
        <section className="mb-24">
          <h2 className="text-xl font-bold text-accent-cyan mb-8 uppercase tracking-widest text-sm">Seven-Stage Pipeline</h2>
          
          <div className="space-y-4">
            {[
              { n: "1", title: "Network Model", desc: "The OT environment is modeled as a directed graph where nodes are devices and edges are communication links. SIF (Safety Instrumented Function) paths are explicitly tagged." },
              { n: "2", title: "Threat Detection", desc: "An intrusion detection monitor identifies unauthorized behavior, such as an anomalous Modbus register write, and flags the compromised node." },
              { n: "3", title: "Min-Cut Solver", desc: "The SafeCut engine formulates the isolation problem as an Edmonds-Karp max-flow/min-cut algorithm. Crucially, all safety edges are assigned infinite capacity." },
              { n: "4", title: "Certificate", desc: "An independent BFS verifier traverses the post-cut graph to prove reachability for every safety loop, generating a verifiable certificate." },
              { n: "5", title: "Enforcement", desc: "The computed network cut is translated into live firewall rules (e.g., nftables) and deployed to the network switches." },
              { n: "6", title: "Process Validation", desc: "The physical process (modeled via a CSTR reactor simulation) responds to the network state, remaining stable rather than experiencing thermal runaway." },
              { n: "7", title: "Dashboard", desc: "The real-time presentation layer visualizes the topology, threat state, certificate validation, and reactor telemetry for the defender." },
            ].map((step) => (
              <div key={step.n} className="glass p-6 rounded-2xl flex gap-6 items-start">
                <div className="w-10 h-10 shrink-0 rounded-xl bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan font-black">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-bold text-text-primary text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── The Solver ── */}
        <section className="mb-24">
          <h2 className="text-xl font-bold text-accent-cyan mb-8 uppercase tracking-widest text-sm">The Solver & Certificate</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <div className="glass p-8 rounded-2xl">
              <h3 className="font-bold text-text-primary text-xl mb-4">Infinite-Capacity Safety Edges</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                The core innovation of SafeCut lies in its solver formulation. By modeling the network as a flow network, we can determine the minimum set of edges to remove to isolate a compromised node from the rest of the network.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                To guarantee safety, every edge that is part of a Safety Instrumented Function (SIF) loop is assigned an <strong>infinite capacity</strong>. Because the min-cut algorithm structurally cannot select an edge with infinite capacity, it is mathematically impossible for the solver to sever a safety loop.
              </p>
            </div>
            
            <div className="glass p-8 rounded-2xl">
              <h3 className="font-bold text-text-primary text-xl mb-4">Independently Verifiable</h3>
              <p className="text-sm text-text-secondary leading-relaxed mb-4">
                We do not trust the solver&apos;s output blindly. After a cut is proposed, an independent verifier runs a breadth-first search (BFS) on the post-cut graph.
              </p>
              <p className="text-sm text-text-secondary leading-relaxed">
                This verifier checks reachability for every single component in every safety loop. Only if the verifier confirms that all loops are intact does it issue a cryptographic <strong>Certificate of Safety</strong>. If a compromised node is within a safety loop, the solver returns INFEASIBLE rather than offering a false guarantee.
              </p>
            </div>
          </div>
        </section>

        {/* ── Limitation ── */}
        <section className="mb-24">
          <div className="border-l-4 border-l-accent-amber bg-accent-amber/5 p-8 rounded-r-2xl">
            <h2 className="text-lg font-bold text-accent-amber mb-2 uppercase tracking-widest text-sm">Stated Limitation</h2>
            <p className="text-sm text-text-secondary leading-relaxed">
              SafeCut preserves loop <em>connectivity</em>, not device <em>integrity</em>. If an adversary compromises a device that is physically part of a safety loop, SafeCut cannot isolate it without breaking the loop. In such cases, the solver will correctly identify the situation as INFEASIBLE and alert the operator, rather than applying a cut that compromises safety or relying on a false guarantee.
            </p>
          </div>
        </section>

        {/* ── Tech Stack ── */}
        <section>
          <h2 className="text-xl font-bold text-accent-cyan mb-8 uppercase tracking-widest text-sm">Technology Stack</h2>
          <TechStackSlide />
        </section>

      </div>
    </main>
  );
}
