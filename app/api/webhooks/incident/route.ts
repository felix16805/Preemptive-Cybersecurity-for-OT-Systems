import { NextRequest, NextResponse } from "next/server";
import { computeSafeCut, verifyCertificate } from "@/lib/safecut-engine";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import { createClient } from "@supabase/supabase-js";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Ensure this route is not cached
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Rate Limiting
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      const redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      });
      const ratelimit = new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"), // 10 requests per minute per IP
      });
      const ip = req.headers.get("x-forwarded-for") ?? "127.0.0.1";
      const { success } = await ratelimit.limit(ip);
      if (!success) {
        return NextResponse.json({ error: "Too many requests" }, { status: 429 });
      }
    }

    const body = await req.json();
    const { targetNode, sessionId } = body;

    if (!targetNode || !sessionId) {
      return NextResponse.json(
        { error: "Missing required fields: targetNode and sessionId" },
        { status: 400 }
      );
    }

    // Server-Side Independent Verification
    // Run the Edmonds-Karp min-cut directly on the server to prevent client spoofing.
    const scResult = computeSafeCut({ graph: OT_TOPOLOGY, compromisedNode: targetNode });
    const certificate = verifyCertificate(OT_TOPOLOGY, scResult.cutEdges);

    const result = {
      edgesCut: scResult.cutEdges.length,
      sifLoopsPreserved: certificate.sifResults.filter(r => r.preserved).length,
      totalSifLoops: certificate.sifResults.length,
      allPreserved: certificate.allPreserved,
    };

    // Connect to Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.warn("Supabase credentials missing, skipping database insertion.");
      return NextResponse.json({ success: true, verifiedEngineResult: result });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Insert into database, tying it firmly to the provided sessionId
    const { error } = await supabase.from("incidents").insert({
      id: crypto.randomUUID(),
      session_id: sessionId,
      threat_node: targetNode,
      safecut_triggered: true,
      certificate_issued: result.allPreserved,
      edges_cut: result.edgesCut,
      safety_loops_preserved: result.sifLoopsPreserved,
      total_safety_loops: result.totalSifLoops,
      log_messages: [`SafeCut executed. Edges cut: ${result.edgesCut}.`]
    });

    if (error) {
      console.error("Supabase insert error:", error);
      return NextResponse.json({ error: "Failed to log incident" }, { status: 500 });
    }

    return NextResponse.json({ success: true, verifiedEngineResult: result });
  } catch (err: any) {
    console.error("Webhook error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
