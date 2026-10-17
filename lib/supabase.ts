import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { IncidentLog } from "@/types";

// ─── Browser / Public Supabase Client Singleton ──────────────────────────────
// Uses ONLY public environment variables (NEXT_PUBLIC_*) safe for browser execution.
// ─────────────────────────────────────────────────────────────────────────────

let _browserClient: SupabaseClient | null = null;

export function getBrowserSupabase(): SupabaseClient | null {
  if (_browserClient) return _browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

  if (!supabaseUrl || !supabaseKey) {
    return null;
  }

  _browserClient = createClient(supabaseUrl, supabaseKey);
  return _browserClient;
}

// ─── Fetch recent incidents (Browser Client) ─────────────────────────────────

export async function fetchIncidents(limit = 20): Promise<IncidentLog[]> {
  const sb = getBrowserSupabase();
  if (!sb) {
    console.warn("[Supabase/Browser] Supabase client credentials unconfigured.");
    return [];
  }

  try {
    const { data, error } = await sb
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Supabase/Browser] Fetch error:", error.message);
      return [];
    }
    return (data ?? []) as IncidentLog[];
  } catch (err) {
    console.error("[Supabase/Browser] Unexpected fetch error:", err);
    return [];
  }
}

// ─── Legacy/Browser Incident Logger ──────────────────────────────────────────
// Note: For secure server-side incident logging in API routes, use logIncidentServer
// from @/lib/supabase-server instead.

export async function logIncident(log: IncidentLog): Promise<string> {
  const sb = getBrowserSupabase();
  if (!sb) {
    throw new Error("[Supabase/Browser] Client credentials unconfigured — cannot log incident.");
  }

  try {
    const { data, error } = await sb
      .from("incidents")
      .insert([log])
      .select("id")
      .single();

    if (error) {
      throw new Error(`[Supabase/Browser] Insert error: ${error.message}`);
    }
    if (!data?.id) {
      throw new Error("[Supabase/Browser] Insert returned no ID.");
    }
    return data.id;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[Supabase/Browser] Unexpected error:", msg);
    throw err;
  }
}
