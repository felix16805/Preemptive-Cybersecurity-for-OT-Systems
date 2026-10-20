import { NextResponse } from "next/server";
import { createHash, randomUUID } from "node:crypto";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import { SAFETY_LOOPS } from "@/lib/ot-topology";
import { computeSafeCut, verifyCertificate, coolingPreserved } from "@/lib/safecut-engine";
import { logIncident } from "@/lib/supabase";
import { writeIsolationEvent } from "@/lib/neo4j";
import { validateSession } from "@/lib/session-store";
import { isDuplicate, markSeen, recordEvent, getEvents } from "@/lib/event-store";
import type { IncidentLog, SafeCutResult } from "@/types";

// ─── Attack-event API ──────────────────────────────────────────────────────────
//
//  POST /api/attack-event
//    Body (JSON):
//      {
//        sessionId: "SAFECUT-XXXX",   // required — display code from /api/session
//        sessionToken: "base64url...", // required — secret token from /api/session
//        eventType: "recon" | "scan" | "exploit" | "lateral" | "impact",
//        targetNode: "PLC_02",         // required — must be a node in OT_TOPOLOGY
//        description: "string"         // optional — short free-text
//      }
//
//    Responses:
//      200 OK  — { ok: true, eventId, ... }
//      201 Created (when exploit triggers SafeCut) — { ok: true, eventId, safecutResult }
//      400 Bad Request — invalid payload, unknown targetNode, unknown eventType
//      401 Unauthorized — invalid/expired session
//      429 Too Many Requests — rate limit exceeded
//      409 Conflict — duplicate event (same session + target + eventType within 5s)
//      500 Internal Server Error — unexpected failure
//
//  GET /api/attack-event?sessionId=SAFECUT-XXXX&sessionToken=...&limit=50
//    Returns recent events for the session:
//      { ok: true, events: IncidentLog[] }
//
//  Security & integrity:
//    - Only allows eventType in a fixed allowlist.
//    - targetNode must exist in OT_TOPOLOGY.nodes.
//    - sessionToken validated via validateSession() (server-side hashed).
//    - Rate limited to 30 events/minute per session.
//    - Duplicate suppression keyed by (sessionId, targetNode, eventType) within 5s.
//    - Never executes commands from the client.
//    - Never allows arbitrary IP addresses or URLs.
// ───────────────────────────────────────────────────────────────────────────────

const ALLOWED_EVENT_TYPES = [
  "recon",
  "scan",
  "exploit",
  "lateral",
  "impact",
] as const;

const VALID_TARGET_NODES = OT_TOPOLOGY.nodes.map((n) => n.id);
const MAX_EVENTS_PER_MIN = 30;
const DUP_WINDOW_MS = 5_000;

interface AttackEventBody {
  sessionId: string;
  sessionToken: string;
  eventType: (typeof ALLOWED_EVENT_TYPES)[number];
  targetNode: string;
  description?: string;
}

const eventTimestamps: Map<string, number[]> =
  ((globalThis as any).__safecutRate ??= new Map<string, number[]>());

function rateLimitCheck(sessionId: string): boolean {
  const now = Date.now();
  const arr = eventTimestamps.get(sessionId) ?? [];
  while (arr.length && arr[0] < now - 60_000) arr.shift();
  if (arr.length >= MAX_EVENTS_PER_MIN) return false;
  arr.push(now);
  eventTimestamps.set(sessionId, arr);
  return true;
}

function dedupKey(body: AttackEventBody): string {
  return `${body.sessionId}:${body.targetNode}:${body.eventType}`;
}

export async function POST(req: Request) {
  let body: AttackEventBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body" },
      { status: 400 }
    );
  }

  const { sessionId, sessionToken, eventType, targetNode, description } = body;

  // Validate session
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

  // Validate eventType
  if (!eventType || !ALLOWED_EVENT_TYPES.includes(eventType)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid eventType. Allowed: ${ALLOWED_EVENT_TYPES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Validate targetNode
  if (!targetNode || !VALID_TARGET_NODES.includes(targetNode)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid targetNode. Valid: ${VALID_TARGET_NODES.join(", ")}`,
      },
      { status: 400 }
    );
  }

  // Rate limit
  if (!rateLimitCheck(sessionId)) {
    return NextResponse.json(
      { ok: false, error: "Rate limit exceeded (30 events/min)" },
      { status: 429 }
    );
  }

  // Duplicate suppression
  const key = dedupKey(body);
  if (isDuplicate(key)) {
    return NextResponse.json(
      { ok: false, error: "Duplicate event within 5s window", duplicate: true },
      { status: 409 }
    );
  }

  const eventId = randomUUID();
  const timestamp = new Date().toISOString();

  // Build the incident log
  const incident: IncidentLog = {
    id: eventId,
    created_at: timestamp,
    session_id: sessionId,
    threat_node: targetNode,
    threat_ip: "192.168.10.102", // simulated
    safecut_triggered: false,
    certificate_issued: false,
    edges_cut: 0,
    safety_loops_preserved: 0,
    total_safety_loops: SAFETY_LOOPS.length,
    log_messages: [description ?? `Simulated ${eventType} against ${targetNode}`],
  };

  let safecutResult: SafeCutResult | undefined;

  // If this is an exploit event, run SafeCut
  if (eventType === "exploit") {
    const solverOutput = computeSafeCut({
      graph: OT_TOPOLOGY,
      compromisedNode: targetNode,
    });

    const certificate = verifyCertificate(
      OT_TOPOLOGY,
      solverOutput.cutEdges,
      SAFETY_LOOPS
    );

    const reactorStable = coolingPreserved(certificate);

    safecutResult = {
      mode: "safecut",
      compromisedNode: targetNode,
      cutEdges: solverOutput.cutEdges,
      certificate,
      solveTimeMs: solverOutput.solveTimeMs,
      safetyLoopsPreserved: certificate.sifResults.filter((r) => r.preserved).length,
      totalSafetyLoops: certificate.sifResults.length,
      reactorStable,
      feasible: solverOutput.feasible,
      infeasibilityReason: solverOutput.infeasibilityReason,
    };

    // Update incident with SafeCut results
    incident.safecut_triggered = true;
    incident.certificate_issued = certificate.allPreserved;
    incident.edges_cut = solverOutput.cutEdges.length;
    incident.cut_edges = solverOutput.cutEdges;
    incident.response_mode = "safecut";
    incident.safety_loops_preserved =
      certificate.sifResults.filter((r) => r.preserved).length;
    incident.log_messages.push(
      `[SAFECUT] Edmonds-Karp min-cut applied (${solverOutput.cutEdges.length} edges cut)`
    );
    incident.log_messages.push(
      `[SAFECUT] Independent reachability verification complete`
    );
  }

  // Mark seen BEFORE any async work so subsequent requests hit the dedup
  markSeen(key);

  // Record to in-memory store (immediate visibility for Defender polling)
  recordEvent(incident);

  // Persist to Supabase (non-blocking)
  logIncident(incident).catch((err) =>
    console.error("[API/attack-event] Supabase log failed:", err)
  );

  // Write to Neo4j (non-blocking)
  if (safecutResult) {
    writeIsolationEvent(targetNode, safecutResult.cutEdges, "safecut").catch(
      (err) => console.error("[API/attack-event] Neo4j write failed:", err)
    );
  }

  return NextResponse.json(
    {
      ok: true,
      eventId,
      timestamp,
      eventType,
      targetNode,
      ...(safecutResult ? { safecutResult } : {}),
    },
    { status: eventType === "exploit" ? 201 : 200 }
  );
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId")?.trim().toUpperCase();
  const sessionToken = url.searchParams.get("sessionToken")?.trim();
  const limit = parseInt(url.searchParams.get("limit") ?? "50", 10);

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

  const events = getEvents(sessionId, limit);
  return NextResponse.json({ ok: true, events });
}