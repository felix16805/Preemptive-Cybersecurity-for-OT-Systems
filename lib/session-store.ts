import { createHash } from "node:crypto";

// ─── Shared session store ─────────────────────────────────────────────────────
//  Lives on globalThis so every API route (session, attack-event, reset, health)
//  reads and writes the SAME store. Next.js may bundle each route separately,
//  which would otherwise give each route its own private Map.
//
//  Demo mode is ON by default so the live two-laptop demo needs zero setup:
//  /api/session always hands out the fixed shared session SAFECUT-DEMO.
//  Set SAFECUT_DEMO_MODE=0 to use secure random sessions instead.
// ───────────────────────────────────────────────────────────────────────────────

export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export interface SessionRecord {
  sessionId: string;
  tokenHash: string;
  createdAt: number;
  expiresAt: number;
}

const G = globalThis as unknown as {
  __safecutSessions?: Map<string, SessionRecord>;
  __safecutCreateTs?: number[];
};
export const sessions: Map<string, SessionRecord> = (G.__safecutSessions ??= new Map());
export const createTimestamps: number[] = (G.__safecutCreateTs ??= []);

export const DEMO_MODE = process.env.SAFECUT_DEMO_MODE !== "0";
export const DEMO_SESSION_ID = (process.env.SAFECUT_DEMO_SESSION_ID || "SAFECUT-DEMO").toUpperCase();
export const DEMO_TOKEN = process.env.SAFECUT_DEMO_TOKEN || "safecut-demo-token";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function ensureDemoSession() {
  if (!DEMO_MODE) return;
  const existing = sessions.get(DEMO_SESSION_ID);
  const now = Date.now();
  if (!existing || existing.expiresAt < now) {
    sessions.set(DEMO_SESSION_ID, {
      sessionId: DEMO_SESSION_ID,
      tokenHash: hashToken(DEMO_TOKEN),
      createdAt: now,
      expiresAt: now + SESSION_TTL_MS,
    });
  }
}

export function validateSession(sessionId: string, sessionToken: string): boolean {
  ensureDemoSession();
  const rec = sessions.get((sessionId || "").trim().toUpperCase());
  if (!rec || rec.expiresAt < Date.now()) return false;
  return hashToken((sessionToken || "").trim()) === rec.tokenHash;
}
