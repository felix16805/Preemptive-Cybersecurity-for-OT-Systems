import { NextRequest, NextResponse } from "next/server";
import { computeSafeCut, verifyCertificate } from "@/lib/safecut-engine";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import { logIncidentServer } from "@/lib/supabase-server";
import { isSupabaseServerConfigured } from "@/lib/config";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Ensure this route is not cached
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // 1. Optional Rate Limiting via Upstash Redis
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
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
          return NextResponse.json(
            { error: "Too many requests. Rate limit exceeded." },
            { status: 429 }
          );
        }
      } catch (rateLimitErr) {
        console.error("[API/webhooks/incident] Upstash rate limiter error:", rateLimitErr);
        // Continue processing if rate limiting infrastructure has a glitch
      }
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON format in webhook body." },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Webhook body must be a JSON object." },
        { status: 400 }
      );
    }

    const { targetNode, sessionId } = body as { targetNode?: string; sessionId?: string };

    if (!targetNode || typeof targetNode !== "string" || targetNode.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: 'targetNode' must be a non-empty string." },
        { status: 400 }
      );
    }

    const validNodes = OT_TOPOLOGY.nodes.map((n) => n.id);
    if (!validNodes.includes(targetNode.trim())) {
      return NextResponse.json(
        {
          error: `Invalid 'targetNode': '${targetNode}'. Valid nodes are: ${validNodes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    if (!sessionId || typeof sessionId !== "string" || sessionId.trim().length === 0) {
      return NextResponse.json(
        { error: "Missing required field: 'sessionId' must be a non-empty string." },
        { status: 400 }
      );
    }

    // 2. Server-Side Independent Verification
    // Run the Edmonds-Karp min-cut directly on the server to prevent client spoofing.
    const scResult = computeSafeCut({
      graph: OT_TOPOLOGY,
      compromisedNode: targetNode.trim(),
    });
    const certificate = verifyCertificate(OT_TOPOLOGY, scResult.cutEdges);

    const verifiedEngineResult = {
      edgesCut: scResult.cutEdges.length,
      sifLoopsPreserved: certificate.sifResults.filter((r) => r.preserved).length,
      totalSifLoops: certificate.sifResults.length,
      allPreserved: certificate.allPreserved,
    };

    // 3. Persist to Supabase
    if (!isSupabaseServerConfigured()) {
      return NextResponse.json(
        {
          error: "Database configuration missing: Supabase credentials are required for incident logging.",
          verifiedEngineResult,
          success: false,
        },
        { status: 503 }
      );
    }

    let incidentId: string;
    try {
      incidentId = await logIncidentServer({
        session_id: sessionId.trim(),
        threat_node: targetNode.trim(),
        safecut_triggered: true,
        certificate_issued: verifiedEngineResult.allPreserved,
        edges_cut: verifiedEngineResult.edgesCut,
        safety_loops_preserved: verifiedEngineResult.sifLoopsPreserved,
        total_safety_loops: verifiedEngineResult.totalSifLoops,
        log_messages: [
          `Webhook SafeCut executed for session ${sessionId.trim()}.`,
          `Target node ${targetNode.trim()} isolated. Edges cut: ${verifiedEngineResult.edgesCut}.`,
        ],
      });
    } catch (dbErr) {
      console.error("[API/webhooks/incident] Supabase insert error:", dbErr);
      return NextResponse.json(
        {
          error: "Failed to persist incident in database.",
          details: dbErr instanceof Error ? dbErr.message : String(dbErr),
          verifiedEngineResult,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      incidentId,
      verifiedEngineResult,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/webhooks/incident] Internal error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
