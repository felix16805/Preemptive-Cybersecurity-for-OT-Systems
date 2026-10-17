/**
 * lib/session-store.ts
 *
 * Server-side in-memory session store for simulation sessions.
 * In production, replace with Redis/DB-backed sessions.
 * Each session is fully isolated: events from session A never appear in session B.
 */

export interface AttackEvent {
  eventId: string;
  sessionId: string;
  timestamp: string;
  source: string;           // attacker-side label
  targetNode: string;
  threatIp: string;
  eventType: "recon" | "exploitation" | "lateral_movement" | "impact";
  status: "PENDING" | "ACCEPTED" | "PROCESSED" | "FAILED";
  description: string;
}

export interface SimulationSession {
  sessionId: string;
  createdAt: string;
  phase: "idle" | "recon" | "exploitation" | "lateral_movement" | "impact" | "contained";
  activeTarget: string | null;
  events: AttackEvent[];
  /** Populated after SafeCut/Quarantine response */
  lastResponse: {
    mode: "safecut" | "quarantine" | null;
    incidentId: string | null;
    edgesCut: number;
    safetyLoopsPreserved: number;
    totalSafetyLoops: number;
    allPreserved: boolean;
    reactorStable: boolean;
    timestamp: string | null;
  };
}

// Module-level singleton map — lives for the process lifetime
const sessions = new Map<string, SimulationSession>();

/** Create a new isolated session */
export function createSession(sessionId: string): SimulationSession {
  const session: SimulationSession = {
    sessionId,
    createdAt: new Date().toISOString(),
    phase: "idle",
    activeTarget: null,
    events: [],
    lastResponse: {
      mode: null,
      incidentId: null,
      edgesCut: 0,
      safetyLoopsPreserved: 0,
      totalSafetyLoops: 0,
      allPreserved: false,
      reactorStable: true,
      timestamp: null,
    },
  };
  sessions.set(sessionId, session);
  return session;
}

/** Get an existing session or null */
export function getSession(sessionId: string): SimulationSession | null {
  return sessions.get(sessionId) ?? null;
}

/** Get or create a session */
export function getOrCreateSession(sessionId: string): SimulationSession {
  return sessions.get(sessionId) ?? createSession(sessionId);
}

/** Update a session's phase */
export function updateSessionPhase(
  sessionId: string,
  phase: SimulationSession["phase"]
): SimulationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.phase = phase;
  return session;
}

/** Append an attack event to a session (deduplicated by eventId) */
export function appendEvent(sessionId: string, event: AttackEvent): SimulationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;

  // Prevent duplicate events
  if (session.events.some((e) => e.eventId === event.eventId)) {
    return session;
  }

  session.events.push(event);
  session.activeTarget = event.targetNode;
  session.phase = event.eventType === "impact" ? "impact"
    : event.eventType === "lateral_movement" ? "lateral_movement"
    : event.eventType === "exploitation" ? "exploitation"
    : "recon";

  return session;
}

/** Record a response result on the session */
export function recordResponse(
  sessionId: string,
  mode: "safecut" | "quarantine",
  incidentId: string | null,
  edgesCut: number,
  safetyLoopsPreserved: number,
  totalSafetyLoops: number,
  allPreserved: boolean,
  reactorStable: boolean
): SimulationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.phase = "contained";
  session.lastResponse = {
    mode,
    incidentId,
    edgesCut,
    safetyLoopsPreserved,
    totalSafetyLoops,
    allPreserved,
    reactorStable,
    timestamp: new Date().toISOString(),
  };
  return session;
}

/** Reset a session back to idle while preserving its ID */
export function resetSession(sessionId: string): SimulationSession | null {
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.phase = "idle";
  session.activeTarget = null;
  session.events = [];
  session.lastResponse = {
    mode: null,
    incidentId: null,
    edgesCut: 0,
    safetyLoopsPreserved: 0,
    totalSafetyLoops: 0,
    allPreserved: false,
    reactorStable: true,
    timestamp: null,
  };
  return session;
}

/** List all session IDs (for diagnostics only) */
export function listSessionIds(): string[] {
  return Array.from(sessions.keys());
}
