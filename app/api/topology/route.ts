import { NextResponse } from "next/server";
import { fetchTopology } from "@/lib/neo4j";

export async function GET() {
  try {
    const topology = await fetchTopology();
    return NextResponse.json(topology);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
