import Link from "next/link";

export default function SharedFooter() {
  return (
    <footer className="border-t border-white/10 bg-background py-12 px-6 mt-auto">
      <div className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
        
        {/* Brand & Tagline */}
        <div className="col-span-1 md:col-span-2">
          <Link href="/" className="font-display font-bold text-xl tracking-tight inline-block mb-3">
            Safe<span className="text-primary">Cut</span>
          </Link>
          <p className="text-sm text-muted-foreground max-w-sm">
            Safety-constrained network isolation for industrial control systems.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 px-3 py-1 rounded-sm border border-primary/30 bg-primary/10 text-xs font-semibold text-primary">
            Simulated Environment — No Real Network Access
          </div>
        </div>

        {/* Links */}
        <div>
          <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider font-display">Navigation</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/" className="hover:text-primary transition-colors">Home</Link></li>
            <li><Link href="/how-it-works" className="hover:text-primary transition-colors">Method</Link></li>
            <li><Link href="/architecture" className="hover:text-primary transition-colors">Architecture</Link></li>
            <li><Link href="/resources" className="hover:text-primary transition-colors">Resources</Link></li>
            <li><Link href="/about" className="hover:text-primary transition-colors">About the Team</Link></li>
            <li><Link href="/contact" className="hover:text-primary transition-colors">Contact</Link></li>
          </ul>
        </div>

        {/* Legal / Status */}
        <div>
          <h4 className="text-sm font-bold text-foreground mb-4 uppercase tracking-wider font-display">Legal</h4>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li><Link href="/privacy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
            <li><Link href="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
            <li className="pt-2 text-xs">Provisional patent pending</li>
            <li className="text-xs">TRL 4 (Lab-Validated)</li>
          </ul>
        </div>

      </div>

      <div className="max-w-6xl mx-auto mt-12 pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} SafeCut. All rights reserved.</p>
        <p className="mt-2 md:mt-0 font-mono">Team: Dipanjan Das, Austin Minto John, Rishabh Jain</p>
      </div>
    </footer>
  );
}
