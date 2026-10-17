import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateSession,
  getSession,
  resetSession,
} from "@/lib/session-store";

export const dynamic = "force-dynamic";

/** GET /api/session?sessionId=XYZ — fetch or create session state */
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId || sessionId.trim().length === 0) {
    return NextResponse.json(
      { error: "Query parameter 'sessionId' is required." },
      { status: 400 }
    );
  }

  const session = getOrCreateSession(sessionId.trim());
  return NextResponse.json({ session });
}

/** POST /api/session — create a new session */
export async function POST(req: NextRequest) {
  try {
    let body: { sessionId?: string; action?: string } = {};
    try {
      body = await req.json();
    } catch {
      // empty body OK for session creation
    }

    const { sessionId, action } = body;

    // Reset action
    if (action === "reset" && sessionId) {
      const session = resetSession(sessionId.trim());
      if (!session) {
        return NextResponse.json(
          { error: `Session '${sessionId}' not found.` },
          { status: 404 }
        );
      }
      return NextResponse.json({ session, reset: true });
    }

    // Create / retrieve session
    const id =
      sessionId?.trim() ||
      `SAFECUT-${Math.random().toString(16).slice(2, 6).toUpperCase()}`;
    const session = getOrCreateSession(id);
    return NextResponse.json({ session });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
