import Link from "next/link";
import { Button } from "@/components/ui/button";
import StaggeredMenu from "@/components/ui/StaggeredMenu";

const mobileMenuItems = [
  { label: "Home", link: "/" },
  { label: "Method", link: "/how-it-works" },
  { label: "Architecture", link: "/architecture" },
  { label: "Simulation", link: "/simulation" },
  { label: "Sign In", link: "/console" },
];

export default function SharedNav() {
  return (
    <nav className="border-b border-white/10 bg-background px-6 py-4 flex items-center justify-between sticky top-0 z-40">
      
      {/* Mobile Nav (StaggeredMenu) */}
      <div className="md:hidden absolute inset-0">
        <StaggeredMenu
          items={mobileMenuItems}
          position="right"
          isFixed={true}
          menuButtonColor="var(--color-paper)"
          openMenuButtonColor="var(--color-ink)"
        />
      </div>

      <div className="hidden md:flex items-center gap-8">
        <Link href="/" className="font-display font-bold text-xl tracking-tight hover:opacity-80 transition-opacity">
          Safe<span className="text-primary">Cut</span>
        </Link>
        
        <div className="hidden md:flex items-center gap-6 text-sm font-medium text-muted-foreground">
          <Link href="/how-it-works" className="hover:text-foreground transition-colors">Method</Link>
          <Link href="/architecture" className="hover:text-foreground transition-colors">Architecture</Link>
          <Link href="/simulation" className="hover:text-foreground transition-colors flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-safety-ok animate-pulse"></span>
            Simulation
          </Link>
          <Link href="/resources" className="hover:text-foreground transition-colors">Resources</Link>
        </div>
      </div>

      <div className="hidden md:flex items-center gap-4">
        <Link href="/console" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mr-4 hidden sm:block">
          Defender Sign In
        </Link>
        <Button asChild>
          <Link href="/contact">Request Session</Link>
        </Button>
      </div>
    </nav>
  );
}
