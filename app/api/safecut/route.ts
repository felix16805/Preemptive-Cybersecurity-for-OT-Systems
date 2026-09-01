import { NextResponse } from "next/server";
import { OT_TOPOLOGY, SAFETY_LOOPS } from "@/lib/ot-topology";
import { computeSafeCut, verifyCertificate } from "@/lib/safecut-engine";
import { simulateCSTR } from "@/lib/cstr-model";
import { sendAttackAlert } from "@/lib/mailer";
import { logIncident } from "@/lib/supabase";
import { writeIsolationEvent } from "@/lib/neo4j";
import type { SafeCutResult } from "@/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const compromisedNode: string = body.compromisedNode ?? "PLC_02";

    // 1. Run Edmonds-Karp solver
    const solverOutput = computeSafeCut({
      graph: OT_TOPOLOGY,
      compromisedNode,
    });

    // 2. Run independent certificate verifier
    const certificate = verifyCertificate(
      OT_TOPOLOGY,
      solverOutput.cutEdges,
      SAFETY_LOOPS
    );

    // 3. Determine reactor stability
    const reactorStable = certificate.allPreserved;

    const result: SafeCutResult = {
      mode: "safecut",
      compromisedNode,
      cutEdges: solverOutput.cutEdges,
      certificate,
      solveTimeMs: solverOutput.solveTimeMs,
      safetyLoopsPreserved: certificate.sifResults.filter((r) => r.preserved).length,
      totalSafetyLoops: certificate.sifResults.length,
      reactorStable,
      feasible: solverOutput.feasible,
      infeasibilityReason: solverOutput.infeasibilityReason,
    };

    // 4. Fire email alert (async, non-blocking for response)
    sendAttackAlert(result).catch((err) =>
      console.error("[API/safecut] Alert send failed:", err)
    );

    // 5. Log to Supabase (non-blocking)
    logIncident({
      mode: "safecut",
      compromised_node: compromisedNode,
      cut_edges: solverOutput.cutEdges,
      certificate,
      solve_time_ms: solverOutput.solveTimeMs,
      safety_loops_preserved: result.safetyLoopsPreserved,
      reactor_stable: reactorStable,
    }).catch((err) => console.error("[API/safecut] Supabase log failed:", err));

    // 6. Write isolation event to Neo4j (non-blocking)
    writeIsolationEvent(compromisedNode, solverOutput.cutEdges, "safecut").catch(
      (err) => console.error("[API/safecut] Neo4j write failed:", err)
    );

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/safecut]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
