import { NextResponse } from "next/server";
import { OT_TOPOLOGY, SAFETY_LOOPS } from "@/lib/ot-topology";
import { computeSafeCut, verifyCertificate } from "@/lib/safecut-engine";
import { checkReactorStability } from "@/lib/cstr-model";
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

    // Batch evaluation option for multiple threats
    if (Array.isArray(rawBody) || (rawBody && typeof rawBody === "object" && (rawBody as any).batchMode)) {
      // For now fall back to standard processing
    }

    const { sessionId, compromisedNode, threatIp } = validation.data;

    // 2. Ensure session exists in session store
    getOrCreateSession(sessionId);

    // 3. Execute Edmonds-Karp min-cut solver
    const solverOutput = computeSafeCut({
      graph: OT_TOPOLOGY,
      compromisedNode,
    });

    // 4. Execute independent certificate verifier
    const certificate = verifyCertificate(
      OT_TOPOLOGY,
      solverOutput.cutEdges,
      SAFETY_LOOPS
    );

    const reactorStable = certificate.allPreserved;

    // Check process stability via CSTR simulation
    // SafeCut preserves cooling loops → cooling should remain active
    const coolingActive = certificate.allPreserved;
    const reactorCheck = checkReactorStability(coolingActive);

    const result: SafeCutResult = {
      mode: "safecut",
      compromisedNode,
      cutEdges: solverOutput.cutEdges,
      certificate,
      solveTimeMs: solverOutput.solveTimeMs,
      safetyLoopsPreserved: certificate.sifResults.filter((r) => r.preserved).length,
      totalSafetyLoops: certificate.sifResults.length,
      reactorStable: reactorCheck.stable,
      feasible: solverOutput.feasible,
      infeasibilityReason: solverOutput.infeasibilityReason,
      maxReactorTemp: reactorCheck.maxTemp,
      processStable: reactorCheck.stable,
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
          safecut_triggered: true,
          certificate_issued: certificate.allPreserved,
          edges_cut: solverOutput.cutEdges.length,
          safety_loops_preserved: result.safetyLoopsPreserved,
          total_safety_loops: result.totalSafetyLoops,
          log_messages: [
            `[SAFECUT] Edmonds-Karp min-cut applied for session ${sessionId}`,
            `[SAFECUT] Threat identified at node ${compromisedNode} (${threatIp})`,
            `[SAFECUT] Independent reachability verification: ${certificate.allPreserved ? "PASSED" : "FAILED"}`,
            `[SAFECUT] Edges severed: ${solverOutput.cutEdges.map((e) => `${e.source}→${e.target}`).join(", ")}`,
          ],
        });
        persistenceStatus = "ok";
      } catch (dbErr) {
        const msg = dbErr instanceof Error ? dbErr.message : String(dbErr);
        console.error("[API/safecut] Supabase persistence error:", msg);
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
      "safecut",
      incidentId,
      result.cutEdges.length,
      result.safetyLoopsPreserved,
      result.totalSafetyLoops,
      certificate.allPreserved,
      reactorStable
    );

    // 7. Write to Neo4j (if configured) — fire and forget
    if (isNeo4jConfigured()) {
      writeIsolationEvent(compromisedNode, solverOutput.cutEdges, "safecut").catch(
        (err) => console.error("[API/safecut] Neo4j write failed:", err)
      );
    }

    // 8. Fire email alert asynchronously (optional)
    sendAttackAlert(result).catch(
      (err) => console.error("[API/safecut] Alert send failed:", err)
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
    console.error("[API/safecut] Unexpected failure:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
