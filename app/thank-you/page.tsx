import Link from "next/link";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Thank You — SafeCut",
  description: "Your submission has been received.",
};

export default function ThankYouPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 text-center">
      <div className="space-y-6 max-w-md">
        <h1 className="text-4xl font-display font-semibold tracking-tight">Request Received</h1>
        <p className="text-muted-foreground">
          We have received your submission. A member of our engineering team will review the details and reach out to you shortly.
        </p>
        <div className="pt-4 border-t border-white/10 mt-6">
          <p className="text-sm font-mono text-muted-foreground mb-6">
            [STATUS: PENDING_REVIEW]
          </p>
          <Button asChild>
            <Link href="/">Return to Home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
