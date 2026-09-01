import { NextResponse } from "next/server";
import { OT_TOPOLOGY, SAFETY_LOOPS } from "@/lib/ot-topology";
import { computeBlindQuarantine, verifyCertificate } from "@/lib/safecut-engine";
import { sendAttackAlert } from "@/lib/mailer";
import { logIncident } from "@/lib/supabase";
import type { SafeCutResult } from "@/types";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const compromisedNode: string = body.compromisedNode ?? "PLC_02";

    const start = performance.now();

    // Blind quarantine: cut ALL edges on the compromised node
    const cutEdges = computeBlindQuarantine(OT_TOPOLOGY, compromisedNode);

    const solveTimeMs = performance.now() - start;

    // Certificate will show which loops are severed by this blunt cut
    const certificate = verifyCertificate(OT_TOPOLOGY, cutEdges, SAFETY_LOOPS);

    const result: SafeCutResult = {
      mode: "quarantine",
      compromisedNode,
      cutEdges,
      certificate,
      solveTimeMs,
      safetyLoopsPreserved: certificate.sifResults.filter((r) => r.preserved).length,
      totalSafetyLoops: certificate.sifResults.length,
      reactorStable: false, // blind quarantine severs cooling loop → runaway
      feasible: true,
    };

    // Alert + log (same pipeline as safecut, so logs are comparable)
    sendAttackAlert(result).catch((err) =>
      console.error("[API/quarantine] Alert send failed:", err)
    );

    logIncident({
      mode: "quarantine",
      compromised_node: compromisedNode,
      cut_edges: cutEdges,
      certificate,
      solve_time_ms: solveTimeMs,
      safety_loops_preserved: result.safetyLoopsPreserved,
      reactor_stable: false,
    }).catch((err) => console.error("[API/quarantine] Supabase log failed:", err));

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
