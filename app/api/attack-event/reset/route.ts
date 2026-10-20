import { NextResponse } from "next/server";
import { validateSession } from "@/lib/session-store";
import { clearSession } from "@/lib/event-store";

// ─── Reset API ─────────────────────────────────────────────────────────────────
//  POST /api/attack-event/reset?sessionId=...&sessionToken=...
//  Clears the in-memory events for a session so the demo can be re-run cleanly.
//  Requires a valid session so one viewer cannot wipe another's stream.
// ───────────────────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim().toUpperCase();
  const sessionToken = url.searchParams.get("sessionToken")?.trim();

  if (!sessionId || !sessionToken) {
    return NextResponse.json(
      { ok: false, error: "sessionId and sessionToken are required" },
      { status: 400 }
    );
  }
  if (!validateSession(sessionId, sessionToken)) {
    return NextResponse.json(
      { ok: false, error: "Invalid or expired session" },
      { status: 401 }
    );
  }

  const cleared = clearSession(sessionId);
  return NextResponse.json({ ok: true, cleared });
}
