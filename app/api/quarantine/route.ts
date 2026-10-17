import { NextResponse } from "next/server";
import { OT_TOPOLOGY, SAFETY_LOOPS } from "@/lib/ot-topology";
import { computeBlindQuarantine, verifyCertificate } from "@/lib/safecut-engine";
import { sendAttackAlert } from "@/lib/mailer";
import { logIncidentServer } from "@/lib/supabase-server";
import { writeIsolationEvent } from "@/lib/neo4j";
import { validateSafeCutPayload, isSupabaseServerConfigured, isNeo4jConfigured } from "@/lib/config";
import { getOrCreateSession, recordResponse } from "@/lib/session-store";
import type { SafeCutResult } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format in request body." },
        { status: 400 }
      );
    }

    // 1. Validate request payload
    const validation = validateSafeCutPayload(rawBody);
    if (!validation.valid || !validation.data) {
      return NextResponse.json(
        { error: "Request validation failed.", details: validation.errors },
        { status: 400 }
      );
    }

    const { sessionId, compromisedNode, threatIp } = validation.data;

    // 2. Ensure session exists
    getOrCreateSession(sessionId);

    const start = performance.now();

    // 3. Blind quarantine: cut ALL edges connected to the compromised node
    const cutEdges = computeBlindQuarantine(OT_TOPOLOGY, compromisedNode);
    const solveTimeMs = performance.now() - start;

    // 4. Certificate shows which loops are severed
    const certificate = verifyCertificate(OT_TOPOLOGY, cutEdges, SAFETY_LOOPS);

    const result: SafeCutResult = {
      mode: "quarantine",
      compromisedNode,
      cutEdges,
      certificate,
      solveTimeMs,
      safetyLoopsPreserved: certificate.sifResults.filter((r) => r.preserved).length,
      totalSafetyLoops: certificate.sifResults.length,
      reactorStable: false, // Blind quarantine severs cooling → runaway
      feasible: true,
    };

    // 5. Persist to Supabase
    let incidentId: string | null = null;
    let persistenceStatus: "ok" | "unavailable" | "failed" = "unavailable";

    if (isSupabaseServerConfigured()) {
      try {
        incidentId = await logIncidentServer({
          session_id: sessionId,
          threat_node: compromisedNode,
          threat_ip: threatIp,
          safecut_triggered: false,
          certificate_issued: false,
          edges_cut: cutEdges.length,
          safety_loops_preserved: result.safetyLoopsPreserved,
          total_safety_loops: result.totalSafetyLoops,
          log_messages: [
            `[QUARANTINE] Blind quarantine applied for session ${sessionId}`,
            `[QUARANTINE] Threat node ${compromisedNode} (${threatIp}) isolated indiscriminately`,
            `[QUARANTINE] SIF loops severed: ${result.totalSafetyLoops - result.safetyLoopsPreserved}`,
            `[QUARANTINE] Cooling loop severed → Thermal runaway triggered!`,
            `[QUARANTINE] Edges severed: ${cutEdges.map((e) => `${e.source}→${e.target}`).join(", ")}`,
          ],
        });
        persistenceStatus = "ok";
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.error("[API/quarantine] Supabase persistence error:", msg);
        persistenceStatus = "failed";
        return NextResponse.json(
          {
            error: "Database persistence failed.",
            details: msg,
          },
          { status: 500 }
        );
      }
    }

    // 6. Update session store
    recordResponse(
      sessionId,
      "quarantine",
      incidentId,
      result.cutEdges.length,
      result.safetyLoopsPreserved,
      result.totalSafetyLoops,
      certificate.allPreserved,
      false
    );

    // 7. Neo4j (if configured)
    if (isNeo4jConfigured()) {
      writeIsolationEvent(compromisedNode, cutEdges, "quarantine").catch(
        (err) => console.error("[API/quarantine] Neo4j write failed:", err)
      );
    }

    // 8. Fire email alert asynchronously
    sendAttackAlert(result).catch(
      (err) => console.error("[API/quarantine] Alert send failed:", err)
    );

    return NextResponse.json({
      success: true,
      incidentId,
      persistenceStatus,
      sessionId,
      threatIp,
      ...result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown internal server error";
    console.error("[API/quarantine] Unexpected failure:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
