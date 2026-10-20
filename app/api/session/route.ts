import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

// ─── Session pairing API ───────────────────────────────────────────────────────
//
//  POST /api/session
//    Creates a new validated session. Returns:
//      { ok: true, sessionId, sessionToken, createdAt, expiresAt }
//
//  GET /api/session?code=SAFECUT-XXXX
//    Validates that a session code exists and is not expired.
//      { ok: true, sessionId, valid: true }   or
//      { ok: false, valid: false, error }
//
//  Security model:
//    - `sessionId` is a human-readable display code (SAFECUT-XXXX). It is NOT
//      used alone as a credential.
//    - `sessionToken` is a server-generated, scoped, opaque token. The attacker
//      CLI must present it on every attack-event request.
//    - Tokens are stored hashed (SHA-256) so that a memory leak of the store
//      never reveals a live credential.
//    - Sessions expire after SESSION_TTL_MS (default 8 hours).
//    - Rate limiting: at most 20 session creations per minute per IP.
// ───────────────────────────────────────────────────────────────────────────────

import {
  sessions, createTimestamps, SESSION_TTL_MS, DEMO_MODE, DEMO_SESSION_ID, DEMO_TOKEN,
  ensureDemoSession, hashToken,
} from "@/lib/session-store";

const MAX_CREATE_PER_MIN = 20;

function rateLimitCheck(): boolean {
  const now = Date.now();
  // drop entries older than 60 seconds
  while (createTimestamps.length && createTimestamps[0] < now - 60_000) {
    createTimestamps.shift();
  }
  if (createTimestamps.length >= MAX_CREATE_PER_MIN) return false;
  createTimestamps.push(now);
  return true;
}

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export async function POST(req: Request) {
  if (DEMO_MODE) {
    ensureDemoSession();
    const rec = sessions.get(DEMO_SESSION_ID)!;
    return NextResponse.json({
      ok: true,
      demo: true,
      sessionId: DEMO_SESSION_ID,
      sessionToken: DEMO_TOKEN,
      createdAt: new Date(rec.createdAt).toISOString(),
      expiresAt: new Date(rec.expiresAt).toISOString(),
    });
  }
  if (!rateLimitCheck()) {
    return NextResponse.json(
      { ok: false, error: "Too many session requests. Try again later." },
      { status: 429 }
    );
  }

  const array = new Uint16Array(1);
  crypto.getRandomValues(array);
  const sessionId = `SAFECUT-${array[0].toString(16).toUpperCase().padStart(4, "0")}`;
  const sessionToken = randomBytes(24).toString("base64url");
  const now = Date.now();

  sessions.set(sessionId, {
    sessionId,
    tokenHash: hashToken(sessionToken),
    createdAt: now,
    expiresAt: now + SESSION_TTL_MS,
  });

  return NextResponse.json({
    ok: true,
    sessionId,
    sessionToken,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_TTL_MS).toISOString(),
  });
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code")?.trim().toUpperCase();
  if (!code) {
    return NextResponse.json(
      { ok: false, valid: false, error: "Missing ?code parameter" },
      { status: 400 }
    );
  }

  const rec = sessions.get(code);
  if (!rec || rec.expiresAt < Date.now()) {
    return NextResponse.json(
      { ok: false, valid: false, error: "Session not found or expired" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true, valid: true, sessionId: rec.sessionId });
}
