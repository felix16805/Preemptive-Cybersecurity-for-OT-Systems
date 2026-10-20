// ─── Shared in-memory event store (fallback when Supabase is unavailable) ──────
//
//  Deployment architecture note:
//  The canonical event store is the Supabase `incidents` table, which is
//  shared across server instances. This in-memory store is a safe fallback for
//  local development where Supabase is not configured. It lives in the single
//  Next.js process that serves both the Defender Console and the attack-event
//  API, so events recorded by the attacker CLI are immediately visible to the
//  Defender Console's polling loop without requiring a page refresh.
//
//  Every event is written with a single generated UUID that is passed to BOTH
//  Supabase (when configured) and this store, so the merge in GET /api/events
//  can deduplicate on `id` exactly.
// ───────────────────────────────────────────────────────────────────────────────

import type { IncidentLog } from "@/types";

// globalThis so every API route shares one store (see app/api/session/route.ts).
const G = globalThis as unknown as { __safecutEvents?: Map<string, IncidentLog>; __safecutSeen?: Map<string, number> };
const byId: Map<string, IncidentLog> = (G.__safecutEvents ??= new Map<string, IncidentLog>());

// Duplicate suppression with a REAL sliding time window.
// Previously this was a Set that never expired, so the same
// (sessionId, targetNode, eventType) could be sent only ONCE ever — which
// silently blocked re-running the demo. We now store the timestamp of the last
// time a key was seen and expire it after DEDUP_WINDOW_MS.
// Short window: blocks accidental double-submits but lets the presenter re-run
// the attack a few seconds later.
const DEDUP_WINDOW_MS = 5_000;
const seenAt: Map<string, number> = (G.__safecutSeen ??= new Map<string, number>());

/** Returns true when an identical event key was seen within the dedup window. */
export function isDuplicate(key: string): boolean {
  const ts = seenAt.get(key);
  if (ts === undefined) return false;
  if (Date.now() - ts > DEDUP_WINDOW_MS) {
    seenAt.delete(key);
    return false;
  }
  return true;
}

/** Marks a logical event key as processed (records the time for windowed dedup). */
export function markSeen(key: string): void {
  const now = Date.now();
  seenAt.set(key, now);
  // opportunistic cleanup so the map cannot grow without bound
  if (seenAt.size > 512) {
    for (const [k, t] of seenAt) {
      if (now - t > DEDUP_WINDOW_MS) seenAt.delete(k);
    }
  }
}

/** Records an event in the in-memory store. Idempotent on `id`. */
export function recordEvent(log: IncidentLog): IncidentLog {
  const rec: IncidentLog = {
    ...log,
    id: log.id ?? crypto.randomUUID(),
    created_at: log.created_at ?? new Date().toISOString(),
  };
  if (rec.id) byId.set(rec.id, rec);
  return rec;
}

/** Returns recent events, optionally filtered by session_id. */
export function getEvents(sessionId?: string | null, limit = 50): IncidentLog[] {
  let rows = [...byId.values()];
  if (sessionId) rows = rows.filter((e) => e.session_id === sessionId);
  return rows
    .sort((a, b) => (a.created_at! < b.created_at! ? 1 : -1))
    .slice(0, limit);
}

/** Clears all events for a session (used by the demo "reset" control). */
export function clearSession(sessionId: string): number {
  let n = 0;
  for (const [id, ev] of byId) {
    if (ev.session_id === sessionId) {
      byId.delete(id);
      n++;
    }
  }
  for (const k of [...seenAt.keys()]) {
    if (k.startsWith(sessionId + ":")) seenAt.delete(k);
  }
  return n;
}
