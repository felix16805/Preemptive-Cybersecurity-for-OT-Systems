export default function AboutPage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-black text-text-primary mb-12 tracking-tight">About SafeCut</h1>

        <section className="mb-16">
          <h2 className="text-xl font-bold text-accent-cyan mb-4 uppercase tracking-widest text-sm">The Mission</h2>
          <p className="text-lg text-text-secondary leading-relaxed">
            SafeCut exists to solve a fundamental conflict in industrial cybersecurity: the need to isolate an active threat without triggering a catastrophic physical failure. Our mission is to provide preemptive, mathematically verified network isolation that protects Operational Technology (OT) from adversaries while ensuring Safety Instrumented Systems (SIS) remain fully operational.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-bold text-accent-cyan mb-4 uppercase tracking-widest text-sm">The Gap</h2>
          <div className="glass p-8 rounded-2xl">
            <p className="text-base text-text-secondary leading-relaxed mb-6">
              Current research and industry solutions fall short of providing safe, automated response capabilities for OT networks:
            </p>
            <ul className="space-y-4 text-sm text-text-muted">
              <li className="flex gap-4">
                <span className="text-accent-red font-bold">✗</span>
                <span><strong>Segmentation is static.</strong> Purdue model zones and static firewalls cannot adapt to an active intrusion once the perimeter is breached.</span>
              </li>
              <li className="flex gap-4">
                <span className="text-accent-red font-bold">✗</span>
                <span><strong>Automated response is blind.</strong> IT-focused tools like SOAR platforms quarantine compromised devices without understanding physical process dependencies, often severing critical safety loops.</span>
              </li>
              <li className="flex gap-4">
                <span className="text-accent-red font-bold">✗</span>
                <span><strong>No runtime safety guarantees.</strong> Existing systems lack the ability to mathematically prove that a proposed network cut preserves safety functions before applying it.</span>
              </li>
            </ul>
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-bold text-accent-cyan mb-8 uppercase tracking-widest text-sm">The Team</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Dipanjan Das", role: "Project Lead / Engineer" },
              { name: "Austin Minto John", role: "Security Researcher" },
              { name: "Rishabh Jain", role: "Systems Architect" }
            ].map((member) => (
              <div key={member.name} className="glass p-6 rounded-2xl text-center">
                <h3 className="font-bold text-text-primary text-lg mb-1">{member.name}</h3>
                <p className="text-xs text-text-muted uppercase tracking-wider">{member.role}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="text-sm font-medium text-text-secondary">
              <span className="text-accent-amber mr-2">Status:</span>
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
                  className="px-3 py-1.5 rounded-lg border border-accent-cyan/20 bg-accent-cyan/5 text-xs font-semibold text-text-secondary"
                >
                  <span className="text-accent-cyan">{item.tag}</span>{" · "}{item.desc}
                </span>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
