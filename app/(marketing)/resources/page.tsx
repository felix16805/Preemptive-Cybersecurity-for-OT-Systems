import React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function ResourcesPage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-display font-semibold mb-12 tracking-tight">Resources</h1>

        <section className="mb-16">
          <h2 className="text-xl font-display font-medium mb-6 border-b border-white/10 pb-4">Literature Survey Summary</h2>
          <Card className="p-8 text-muted-foreground text-sm leading-relaxed space-y-4 font-sans">
            <p>Our research analyzed four primary streams in industrial cybersecurity literature:</p>
            <ul className="list-disc pl-5 space-y-2 text-muted-foreground">
              <li><strong className="text-foreground">Network Segmentation:</strong> Traditional models like the Purdue Enterprise Reference Architecture provide strong static boundaries but lack dynamic response capabilities.</li>
              <li><strong className="text-foreground">Intrusion Detection Systems (IDS):</strong> Advanced anomaly detection can identify threats quickly but relies on human operators to formulate a safe response.</li>
              <li><strong className="text-foreground">Automated Response (SOAR):</strong> IT-centric orchestration tools apply immediate containment (quarantine) but are unaware of physical process dependencies, often causing catastrophic shutdowns.</li>
              <li><strong className="text-foreground">Graph-Theoretic Security:</strong> Network topology analysis provides mathematical rigor, but prior work focused primarily on vulnerability scoring rather than real-time containment guarantees.</li>
            </ul>
            <p className="font-semibold text-foreground mt-4 pt-4 border-t border-white/10">
              The identified gap: There is no existing solution that bridges automated containment with real-time, mathematically proven safety guarantees for OT environments.
            </p>
          </Card>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-display font-medium mb-6 border-b border-white/10 pb-4">References</h2>
          <div className="space-y-4">
            {[
              { id: "1", title: "NIST Special Publication 800-82 Revision 3", desc: "Guide to Operational Technology (OT) Security." },
              { id: "2", title: "ISA/IEC 62443", desc: "Security for Industrial Automation and Control Systems." },
              { id: "3", title: "Edmonds, J., & Karp, R. M. (1972)", desc: "Theoretical Improvements in Algorithmic Efficiency for Network Flow Problems. Journal of the ACM." }
            ].map((ref) => (
              <Card key={ref.id} className="p-4 flex gap-4 items-center">
                <div className="text-primary font-mono font-bold">[{ref.id}]</div>
                <div>
                  <div className="font-semibold text-foreground text-sm font-display">{ref.title}</div>
                  <div className="text-xs text-muted-foreground font-sans">{ref.desc}</div>
                </div>
              </Card>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-display font-medium mb-6 border-b border-white/10 pb-4">Glossary</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { term: "SIF", def: "Safety Instrumented Function; a specific control loop designed to prevent or mitigate a hazardous event." },
              { term: "SIS", def: "Safety Instrumented System; composed of sensors, logic solvers, and final control elements that execute SIFs." },
              { term: "Min-Cut", def: "The minimum capacity set of edges that, if removed, would disconnect the source from the sink in a flow network." },
              { term: "Purdue Model", def: "A reference architecture model for ICS segmentation, dividing networks into hierarchical zones." },
              { term: "CSTR", def: "Continuous Stirred-Tank Reactor; a standard chemical engineering model used here to simulate physical process stability." },
            ].map((item) => (
              <Card key={item.term} className="p-5">
                <div className="font-bold font-mono text-sm mb-2">{item.term}</div>
                <div className="text-sm text-muted-foreground leading-relaxed font-sans">{item.def}</div>
              </Card>
            ))}
          </div>
        </section>

        <section className="border-t border-white/10 pt-8">
          <h2 className="text-xl font-display font-medium mb-6 border-b border-white/10 pb-4">Links</h2>
          <div className="flex gap-4">
            <Button variant="outline" asChild>
              <Link href="https://github.com/felix16805/Preemptive-Cybersecurity-for-OT-Systems">
                View GitHub Repository
              </Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}
