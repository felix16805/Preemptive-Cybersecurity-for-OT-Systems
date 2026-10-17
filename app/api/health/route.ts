import { NextResponse } from "next/server";
import { isSupabaseConfigured, isNeo4jConfigured, isMLConfigured } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const services: Record<string, string> = {
    application: "ok",
  };

  // Check Supabase
  if (isSupabaseConfigured()) {
    services.supabase = "ok";
  } else {
    services.supabase = "disabled";
  }

  // Check Neo4j
  if (isNeo4jConfigured()) {
    services.neo4j = "ok";
  } else {
    services.neo4j = "disabled";
  }

  // Check ML Service
  if (isMLConfigured()) {
    services.ml = "ok";
  } else {
    services.ml = "disabled";
  }

  return NextResponse.json({
    status: "ok",
    services,
    timestamp: new Date().toISOString(),
  });
}