import { Card } from "@/components/ui/card";

export default function HowItWorksPage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-display font-semibold mb-12 tracking-tight">The SafeCut Method</h1>
        
        <section className="mb-16">
          <p className="text-lg text-muted-foreground leading-relaxed font-sans mb-8">
            SafeCut is built on a simple premise: a network cut should never cause a worse physical outcome than the attacker would have. By modeling the network as a flow graph and heavily weighting safety-critical paths, SafeCut deterministically isolates intruders without risking plant safety.
          </p>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4">1. Graph Formulation</h2>
          <Card className="p-8">
            <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-sans">
              The operational technology network is translated into a directed graph <code className="text-foreground bg-muted px-1.5 py-0.5 rounded-sm">G = (V, E)</code>.
            </p>
            <ul className="space-y-4 text-sm text-muted-foreground font-sans">
              <li><strong className="text-foreground">Vertices (V):</strong> Represent PLCs, HMIs, engineering workstations, and the compromised node.</li>
              <li><strong className="text-foreground">Edges (E):</strong> Represent communication links (e.g., Modbus TCP connections).</li>
              <li><strong className="text-foreground">Safety Edges:</strong> The subset of edges required for Safety Instrumented Functions (SIFs), such as emergency shutdown signals or cooling loop controls.</li>
            </ul>
          </Card>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4">2. Constrained Min-Cut</h2>
          <Card className="p-8">
            <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-sans">
              Once an intrusion is detected at a specific node, SafeCut calculates the minimum number of edges to sever to disconnect the attacker from critical assets.
            </p>
            <p className="text-muted-foreground text-sm leading-relaxed font-sans border-l-2 border-primary pl-4 py-2">
              <strong>The Constraint:</strong> All safety edges are mathematically assigned <em>infinite capacity</em>. Because the Edmonds-Karp min-cut algorithm minimizes flow capacity, it is structurally impossible for the algorithm to select an infinite-capacity edge for removal.
            </p>
          </Card>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4">3. Independent Verification</h2>
          <Card className="p-8">
            <p className="text-muted-foreground text-sm leading-relaxed font-sans">
              Before any enforcement occurs, SafeCut passes the proposed cut to an independent reachability verifier. This module performs a Breadth-First Search (BFS) on the resulting subgraph to mathematically prove that a continuous path still exists for every single SIF loop. If verified, a cryptographic certificate of safety is generated and attached to the incident log.
            </p>
          </Card>
        </section>

        <section className="mb-16">
          <h2 className="text-2xl font-display font-medium mb-6 border-b border-white/10 pb-4">Attacker CLI Reference</h2>
          <p className="text-muted-foreground text-sm leading-relaxed mb-6 font-sans">
            To evaluate SafeCut in the simulation console, defenders can simulate attacks using our provided CLI tool. The tool uses session-scoped API calls to emulate a real-world kill chain without requiring lateral access to a physical Modbus network.
          </p>
          <div className="bg-background border border-white/10 p-6 rounded-sm font-mono text-sm overflow-x-auto">
            <div className="text-muted-foreground mb-4"># 1. Reconnaissance (Scan for active PLCs)</div>
            <div className="text-primary mb-6">$ safecut-cli run recon --session=&lt;ID&gt;</div>
            
            <div className="text-muted-foreground mb-4"># 2. Exploitation (Compromise the Engineering Workstation)</div>
            <div className="text-primary mb-6">$ safecut-cli attack --target EWS_1 --session SAFECUT-7F3A-9B21</div>
            
            <div className="text-muted-foreground mb-4"># 3. Lateral Movement (Pivot to the HMI)</div>
            <div className="text-primary mb-6">$ safecut-cli attack --target HMI --session SAFECUT-7F3A-9B21</div>
            
            <div className="text-muted-foreground mb-4"># 4. Impact (Send rogue Modbus writes to the Reactor PLC)</div>
            <div className="text-primary mb-2">$ safecut-cli run impact --target=PLC_REACTOR --payload=&quot;OVERRIDE_TEMP&quot; --session=&lt;ID&gt;</div>
          </div>
        </section>

      </div>
    </main>
  );
}
