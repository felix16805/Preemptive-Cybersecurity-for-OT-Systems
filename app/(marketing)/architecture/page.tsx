import React from "react";
import { Card } from "@/components/ui/card";
import AccordionGallery from "@/components/ui/AccordionGallery";

const galleryItems = [
  { image: "/layer_adversary_1789300342996.jpg", label: "Adversary Layer" },
  { image: "/layer_ot_1789300382550.jpg", label: "OT Network" },
  { image: "/layer_physical_1789300356802.jpg", label: "Physical Process" },
  { image: "/layer_safecut_1789300396585.jpg", label: "SafeCut Engine" },
  { image: "/layer_presentation_1789300410942.jpg", label: "Presentation" }
];

export default function ArchitecturePage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-5xl">
        <h1 className="text-4xl md:text-5xl font-display font-semibold mb-12 tracking-tight">System Architecture</h1>

        <div className="mb-24 w-full">
          <AccordionGallery 
            items={galleryItems} 
            defaultIndex={0} 
            height={500}
            gap={12}
            expandRatio={0.6}
            accentColor="var(--color-amber)"
          />
        </div>

        {/* ── Pipeline ── */}
        <section className="mb-24">
          <h2 className="text-xl font-display font-medium mb-8 border-b border-white/10 pb-4">Seven-Stage Pipeline</h2>
          
          <div className="grid gap-6">
            {[
              { n: "1", title: "Network Model", desc: "The OT environment is modeled as a directed graph where nodes are devices and edges are communication links. SIF (Safety Instrumented Function) paths are explicitly tagged." },
              { n: "2", title: "Threat Detection", desc: "An intrusion detection monitor identifies unauthorized behavior, such as an anomalous Modbus register write, and flags the compromised node." },
              { n: "3", title: "Min-Cut Solver", desc: "The SafeCut engine formulates the isolation problem as an Edmonds-Karp max-flow/min-cut algorithm. Crucially, all safety edges are assigned infinite capacity." },
              { n: "4", title: "Certificate", desc: "An independent BFS verifier traverses the post-cut graph to prove reachability for every safety loop, generating a verifiable certificate." },
              { n: "5", title: "Enforcement", desc: "The computed network cut is translated into live firewall rules (e.g., nftables) and deployed to the network switches." },
              { n: "6", title: "Process Validation", desc: "The physical process (modeled via a CSTR reactor simulation) responds to the network state, remaining stable rather than experiencing thermal runaway." },
              { n: "7", title: "Dashboard", desc: "The real-time presentation layer visualizes the topology, threat state, certificate validation, and reactor telemetry for the defender." },
            ].map((step) => (
              <Card key={step.n} className="p-6 flex gap-6 items-start">
                <div className="w-10 h-10 shrink-0 border border-white/10 bg-muted flex items-center justify-center font-mono font-bold">
                  {step.n}
                </div>
                <div>
                  <h3 className="font-semibold text-lg mb-2 font-display">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ── The Solver ── */}
        <section className="mb-24">
          <h2 className="text-xl font-display font-medium mb-8 border-b border-white/10 pb-4">The Solver & Certificate</h2>
          
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="p-8">
              <h3 className="font-semibold text-xl mb-4 font-display">Infinite-Capacity Safety Edges</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                The core innovation of SafeCut lies in its solver formulation. By modeling the network as a flow network, we can determine the minimum set of edges to remove to isolate a compromised node from the rest of the network.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To guarantee safety, every edge that is part of a Safety Instrumented Function (SIF) loop is assigned an <strong className="text-foreground">infinite capacity</strong>. Because the min-cut algorithm structurally cannot select an edge with infinite capacity, it is mathematically impossible for the solver to sever a safety loop.
              </p>
            </Card>
            
            <Card className="p-8">
              <h3 className="font-semibold text-xl mb-4 font-display">Independently Verifiable</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mb-4">
                We do not trust the solver&apos;s output blindly. After a cut is proposed, an independent verifier runs a breadth-first search (BFS) on the post-cut graph.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                This verifier checks reachability for every single component in every safety loop. Only if the verifier confirms that all loops are intact does it issue a cryptographic <strong className="text-foreground">Certificate of Safety</strong>. If a compromised node is within a safety loop, the solver returns INFEASIBLE rather than offering a false guarantee.
              </p>
            </Card>
          </div>
        </section>

        {/* ── Limitation ── */}
        <section>
          <div className="border border-safety-warn bg-safety-warn/5 p-8 rounded-sm hard-shadow">
            <h2 className="text-lg font-bold text-safety-warn mb-2 font-mono uppercase tracking-widest text-sm">Stated Limitation</h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              SafeCut preserves loop <em>connectivity</em>, not device <em>integrity</em>. If an adversary compromises a device that is physically part of a safety loop, SafeCut cannot isolate it without breaking the loop. In such cases, the solver will correctly identify the situation as INFEASIBLE and alert the operator, rather than applying a cut that compromises safety or relying on a false guarantee.
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
