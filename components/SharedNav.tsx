import Link from "next/link";

export default function SharedNav() {
  return (
    <nav className="glass border-b border-white/5 px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-accent-cyan font-black text-xl tracking-tight hover:opacity-80 transition-opacity">
          SafeCut
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-text-secondary">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <Link href="/about" className="hover:text-white transition-colors">About</Link>
          <Link href="/architecture" className="hover:text-white transition-colors">Architecture</Link>
          <Link href="/resources" className="hover:text-white transition-colors">Resources</Link>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Link 
          href="/dashboard"
          className="px-5 py-2 rounded-lg bg-accent-cyan text-bg-base font-bold text-sm tracking-wide transition-all hover:bg-accent-cyan/90 hover:scale-105 shadow-lg shadow-accent-cyan/20"
        >
          Launch Dashboard
        </Link>
      </div>
    </nav>
  );
}
