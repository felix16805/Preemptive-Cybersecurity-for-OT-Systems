import Link from "next/link";

export default function SharedFooter() {
  return (
    <footer className="border-t border-white/5 bg-bg-base py-12 px-6 mt-auto">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand & Tagline */}
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="text-accent-cyan font-black text-xl tracking-tight inline-block mb-3">
            SafeCut
          </Link>
          <p className="text-sm text-text-muted max-w-sm">
            Isolate the attacker. Not the safety system. Safety-constrained network isolation for industrial control systems.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent-amber/30 bg-accent-amber/10 text-xs font-semibold text-accent-amber">
            Simulated Environment — No Real Network Access
          </div>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Navigation</h4>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li><Link href="/" className="hover:text-accent-cyan transition-colors">Home</Link></li>
            <li><Link href="/about" className="hover:text-accent-cyan transition-colors">About</Link></li>
            <li><Link href="/architecture" className="hover:text-accent-cyan transition-colors">Architecture</Link></li>
            <li><Link href="/resources" className="hover:text-accent-cyan transition-colors">Resources</Link></li>
          </ul>
        </div>

        {/* Legal / Status */}
        <div>
          <h4 className="text-sm font-bold text-text-primary mb-4 uppercase tracking-wider">Status</h4>
          <ul className="space-y-2 text-sm text-text-secondary">
            <li>Provisional patent pending</li>
            <li>TRL 4 (Lab-Validated)</li>
          </ul>
        </div>

      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs text-text-muted">
        <p>&copy; {new Date().getFullYear()} SafeCut Team. All rights reserved.</p>
        <p className="mt-2 md:mt-0">Team: Dipanjan Das, Austin Minto John, Rishabh Jain</p>
      </div>
    </footer>
  );
}
