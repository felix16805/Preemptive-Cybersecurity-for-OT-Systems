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
      session_id: "API_QUARANTINE_RUN",
      threat_node: compromisedNode,
      threat_ip: "192.168.10.102",
      safecut_triggered: false,
      certificate_issued: false,
      edges_cut: cutEdges.length,
      safety_loops_preserved: result.safetyLoopsPreserved,
      total_safety_loops: result.totalSafetyLoops,
      log_messages: ["[QUARANTINE] Blind quarantine applied", "[QUARANTINE] Reactor runaway!"]
    }).catch((err) => console.error("[API/quarantine] Supabase log failed:", err));

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
