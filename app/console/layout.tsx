export const metadata = {
  title: "Console — SafeCut",
  description: "Live Incident Command Center",
};

export default function ConsoleLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Console Nav - specific to the app console */}
      <nav className="border-b border-white/10 px-6 py-3 flex items-center justify-between bg-muted shrink-0">
        <div className="flex items-center gap-4">
          <div className="font-display font-semibold text-lg">SafeCut Console</div>
          <div className="px-2 py-0.5 border border-primary/30 bg-primary/10 text-primary text-[10px] font-mono tracking-widest uppercase rounded-sm">
            Live Streaming
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-mono text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-safety-ok"></span> System Nominal
          </div>
          <div className="pl-4 border-l border-white/10">
            Defender: admin@safecut.local
          </div>
        </div>
      </nav>
      <div className="flex-1 overflow-hidden">
        {children}
      </div>
    </div>
  );
}
