import { Card } from "@/components/ui/card";

export default function AboutPage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-display font-semibold mb-12 tracking-tight">About SafeCut</h1>

        <section className="mb-16">
          <h2 className="text-xl font-display font-medium mb-4 border-b border-white/10 pb-4">The Mission</h2>
          <p className="text-lg text-muted-foreground leading-relaxed font-sans">
            SafeCut exists to solve a fundamental conflict in industrial cybersecurity: the need to isolate an active threat without triggering a catastrophic physical failure. Our mission is to provide preemptive, mathematically verified network isolation that protects Operational Technology (OT) from adversaries while ensuring Safety Instrumented Systems (SIS) remain fully operational.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-display font-medium mb-4 border-b border-white/10 pb-4">The Gap</h2>
          <Card className="p-8">
            <p className="text-base text-muted-foreground leading-relaxed mb-6 font-sans">
              Current research and industry solutions fall short of providing safe, automated response capabilities for OT networks:
            </p>
            <ul className="space-y-6 text-sm text-muted-foreground font-sans">
              <li className="flex gap-4">
                <span className="text-destructive font-mono font-bold mt-0.5">✗</span>
                <div>
                  <strong className="text-foreground">Segmentation is static.</strong> Purdue model zones and static firewalls cannot adapt to an active intrusion once the perimeter is breached.
                </div>
              </li>
              <li className="flex gap-4">
                <span className="text-destructive font-mono font-bold mt-0.5">✗</span>
                <div>
                  <strong className="text-foreground">Automated response is blind.</strong> IT-focused tools like SOAR platforms quarantine compromised devices without understanding physical process dependencies, often severing critical safety loops.
                </div>
              </li>
              <li className="flex gap-4">
                <span className="text-destructive font-mono font-bold mt-0.5">✗</span>
                <div>
                  <strong className="text-foreground">No runtime safety guarantees.</strong> Existing systems lack the ability to mathematically prove that a proposed network cut preserves safety functions before applying it.
                </div>
              </li>
            </ul>
          </Card>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-display font-medium mb-8 border-b border-white/10 pb-4">The Team</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Dipanjan Das", role: "23BCE0131" },
              { name: "Austin Minto John", role: "23BCE0186" },
              { name: "Rishabh Jain", role: "23BDS0254" }
            ].map((member) => (
              <Card key={member.name} className="p-6">
                <h3 className="font-semibold text-foreground text-lg mb-1 font-display">{member.name}</h3>
                <p className="text-xs text-muted-foreground font-mono">{member.role}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="pt-8 border-t border-white/10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm font-medium text-muted-foreground font-mono">
              <span className="text-primary mr-2">Status:</span>
              Provisional patent filing in progress.
            </div>
            
            <div className="flex flex-wrap gap-3">
              {[
                { tag: "SDG 9",  desc: "Innovation & Infrastructure" },
                { tag: "SDG 12", desc: "Responsible Production"   },
                { tag: "TRL 4",  desc: "Lab-Validated Prototype"  },
              ].map((item) => (
                <span
                  key={item.tag}
                  className="px-3 py-1.5 border border-white/10 bg-muted text-xs font-mono text-muted-foreground"
                >
                  <strong className="text-foreground font-normal">{item.tag}</strong>{" · "}{item.desc}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
