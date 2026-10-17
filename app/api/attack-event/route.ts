import { NextRequest, NextResponse } from "next/server";
import {
  getOrCreateSession,
  appendEvent,
  updateSessionPhase,
} from "@/lib/session-store";
import { OT_TOPOLOGY } from "@/lib/ot-topology";

export const dynamic = "force-dynamic";

const VALID_NODES = new Set(OT_TOPOLOGY.nodes.map((n) => n.id));
const VALID_EVENT_TYPES = new Set(["recon", "exploitation", "lateral_movement", "impact"]);

/**
 * POST /api/attack-event
 * Attacker sends a simulated attack event to the session.
 * Backend validates, stores, and makes it visible to the defender polling the same session.
 *
 * Body: {
 *   eventId: string
 *   sessionId: string
 *   targetNode: string
 *   threatIp: string
 *   eventType: "recon" | "exploitation" | "lateral_movement" | "impact"
 *   description: string
 * }
 */
export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Request body must be a JSON object." },
        { status: 400 }
      );
    }

    const {
      eventId,
      sessionId,
      targetNode,
      threatIp,
      eventType,
      description,
    } = body as Record<string, string>;

    const errors: string[] = [];

    if (!eventId || !eventId.trim()) errors.push("'eventId' is required.");
    if (!sessionId || !sessionId.trim()) errors.push("'sessionId' is required.");
    if (!targetNode || !targetNode.trim()) {
      errors.push("'targetNode' is required.");
    } else if (!VALID_NODES.has(targetNode.trim())) {
      errors.push(
        `'targetNode' '${targetNode}' is not a valid OT node. Valid: ${Array.from(VALID_NODES).join(", ")}`
      );
    }
    if (!threatIp || !threatIp.trim()) errors.push("'threatIp' is required.");
    if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
      errors.push(
        `'eventType' must be one of: ${Array.from(VALID_EVENT_TYPES).join(", ")}`
      );
    }
    if (!description || !description.trim()) errors.push("'description' is required.");

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Validation failed.", details: errors },
        { status: 400 }
      );
    }

    const session = getOrCreateSession(sessionId.trim());

    const event = {
      eventId: eventId.trim(),
      sessionId: sessionId.trim(),
      timestamp: new Date().toISOString(),
      source: "ATTACKER_CONSOLE",
      targetNode: targetNode.trim(),
      threatIp: threatIp.trim(),
      eventType: eventType as "recon" | "exploitation" | "lateral_movement" | "impact",
      status: "ACCEPTED" as const,
      description: description.trim(),
    };

    const updated = appendEvent(sessionId.trim(), event);
    if (!updated) {
      return NextResponse.json(
        { error: "Session not found or could not be updated." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      event,
      session: {
        sessionId: updated.sessionId,
        phase: updated.phase,
        activeTarget: updated.activeTarget,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/attack-event]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
