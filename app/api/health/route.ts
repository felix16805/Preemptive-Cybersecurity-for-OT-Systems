import { NextResponse } from "next/server";
import { DEMO_MODE, DEMO_SESSION_ID } from "@/lib/session-store";
import { lanAddresses } from "@/lib/lan-ip";

export const dynamic = "force-dynamic";

// GET /api/health
//   Used by the attacker CLI to tell "can't reach the defender" apart from
//   "reached it but the session is wrong", and by the console to show the
//   exact URL the attacker laptop should use.
export async function GET(req: Request) {
  const port = new URL(req.url).port || process.env.PORT || "3000";
  const addrs = lanAddresses();
  return NextResponse.json({
    ok: true,
    service: "safecut-defender",
    demoMode: DEMO_MODE,
    demoSessionId: DEMO_MODE ? DEMO_SESSION_ID : null,
    port,
    lan: addrs.map((a) => ({ ...a, url: `http://${a.address}:${port}` })),
    time: new Date().toISOString(),
  });
}
