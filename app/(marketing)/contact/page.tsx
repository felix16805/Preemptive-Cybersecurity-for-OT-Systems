import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Contact — SafeCut",
  description: "Request a live console session or contact the SafeCut engineering team.",
};

export default function ContactPage() {
  return (
    <main className="flex-1 py-24">
      <div className="container mx-auto px-6 max-w-4xl">
        <h1 className="text-4xl md:text-5xl font-display font-semibold mb-12 tracking-tight">Contact Engineering</h1>

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-xl font-display font-medium mb-6 border-b border-white/10 pb-4">Request a Live Session</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-8 font-sans">
              SafeCut is currently in closed preview. If you operate critical infrastructure and are interested in evaluating our safety-constrained min-cut solver, request a live interactive console session.
            </p>
            
            <form action="/api/contact" method="POST" className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">Name</label>
                <input type="text" id="name" name="name" required className="w-full h-10 px-3 bg-background border border-white/10 rounded-sm focus:outline-none focus:border-primary font-sans text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">Work Email</label>
                <input type="email" id="email" name="email" required className="w-full h-10 px-3 bg-background border border-white/10 rounded-sm focus:outline-none focus:border-primary font-sans text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="organization" className="text-sm font-medium text-foreground">Organization</label>
                <input type="text" id="organization" name="organization" required className="w-full h-10 px-3 bg-background border border-white/10 rounded-sm focus:outline-none focus:border-primary font-sans text-sm" />
              </div>
              <div className="space-y-2">
                <label htmlFor="message" className="text-sm font-medium text-foreground">Message</label>
                <textarea id="message" name="message" rows={4} className="w-full px-3 py-2 bg-background border border-white/10 rounded-sm focus:outline-none focus:border-primary font-sans text-sm resize-none"></textarea>
              </div>
              
              {/* Cloudflare Turnstile will be injected here later */}
              
              <Button type="submit" className="w-full">Submit Request</Button>
            </form>
          </div>

          <div>
            <h2 className="text-xl font-display font-medium mb-6 border-b border-white/10 pb-4">Corporate Information</h2>
            <Card className="p-8">
              <ul className="space-y-6 text-sm text-muted-foreground font-sans">
                <li>
                  <strong className="block text-foreground font-mono text-xs mb-1">ENTITY</strong>
                  SafeCut Systems Inc.
                </li>
                <li>
                  <strong className="block text-foreground font-mono text-xs mb-1">REGISTRATION NUMBER</strong>
                  23BCE0131
                </li>
                <li>
                  <strong className="block text-foreground font-mono text-xs mb-1">PHONE NUMBER</strong>
                  +91-8240056418
                </li>
                <li>
                  <strong className="block text-foreground font-mono text-xs mb-1">GENERAL INQUIRIES</strong>
                  <a href="mailto:dipanjandas10.pkt@gmail.com" className="text-primary hover:underline">dipanjandas10.pkt@gmail.com</a>
                </li>
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
