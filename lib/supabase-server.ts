import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { IncidentLog } from "@/types";

let _serverClient: SupabaseClient | null = null;

/**
 * Returns a server-side Supabase client with elevated service privileges.
 * NEVER call this function in browser code or client components.
 */
export function getServerSupabase(): SupabaseClient {
  if (typeof window !== "undefined") {
    throw new Error(
      "[Security Violation] Server Supabase client cannot be instantiated in a browser environment."
    );
  }

  if (_serverClient) return _serverClient;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error(
      "Supabase configuration error: NEXT_PUBLIC_SUPABASE_URL environment variable is missing."
    );
  }

  if (!serviceKey) {
    throw new Error(
      "Supabase configuration error: SUPABASE_SERVICE_ROLE_KEY is required for server operations."
    );
  }

  const keyToUse = serviceKey;

  _serverClient = createClient(url, keyToUse, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return _serverClient;
}

/**
 * Persists an incident log from the server (API routes and webhooks).
 * Throws a descriptive Error if Supabase is unconfigured or if the database insert fails.
 */
export async function logIncidentServer(log: IncidentLog): Promise<string> {
  const sb = getServerSupabase();

  const recordToInsert = {
    id: log.id || crypto.randomUUID(),
    session_id: log.session_id,
    threat_node: log.threat_node,
    threat_ip: log.threat_ip ?? null,
    safecut_triggered: log.safecut_triggered,
    certificate_issued: log.certificate_issued,
    edges_cut: log.edges_cut,
    safety_loops_preserved: log.safety_loops_preserved,
    total_safety_loops: log.total_safety_loops,
    log_messages: log.log_messages || [],
  };

  const { data, error } = await sb
    .from("incidents")
    .insert([recordToInsert])
    .select("id")
    .single();

  if (error) {
    console.error("[Supabase/Server] Incident insert failed:", error.message);
    throw new Error(`Database persistence failure: ${error.message} (Code: ${error.code})`);
  }

  if (!data?.id) {
    throw new Error("Database persistence failure: Record was inserted but no ID was returned.");
  }

  return data.id;
}

/**
 * Fetches recent incidents directly on the server.
 * Throws if the query fails.
 */
export async function fetchIncidentsServer(limit = 50): Promise<IncidentLog[]> {
  const sb = getServerSupabase();

  const { data, error } = await sb
    .from("incidents")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("[Supabase/Server] Incident query failed:", error.message);
    throw new Error(`Database query failure: ${error.message}`);
  }

  return (data ?? []) as IncidentLog[];
}
