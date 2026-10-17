import { NextResponse } from "next/server";
import { fetchTopology } from "@/lib/neo4j";
import { isNeo4jConfigured } from "@/lib/config";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import type { OTGraph } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const isLive = isNeo4jConfigured();
    let topology: OTGraph;
    if (!isLive) {
      topology = OT_TOPOLOGY;
    } else {
      topology = await fetchTopology();
    }

    return NextResponse.json(topology, {
      headers: {
        "X-Topology-Source": isLive ? "neo4j-live" : "in-memory-baseline",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[API/topology] Error fetching topology:", message);
    return NextResponse.json(
      {
        error: "Failed to fetch network topology.",
        details: message,
      },
      { status: 500 }
    );
  }
}
