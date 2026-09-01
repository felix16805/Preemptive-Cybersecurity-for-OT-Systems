import { createClient } from "@supabase/supabase-js";
import type { IncidentLog } from "@/types";

// ─── Supabase client singleton ────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

const _supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

function getClient() {
  if (!_supabase) {
    console.warn("[Supabase] No credentials configured — incident logging disabled.");
  }
  return _supabase;
}

// ─── Log an incident ─────────────────────────────────────────────────────────

export async function logIncident(log: IncidentLog): Promise<string | null> {
  const sb = getClient();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from("incidents")
      .insert([log])
      .select("id")
      .single();

    if (error) {
      console.error("[Supabase] Insert error:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[Supabase] Unexpected error:", err);
    return null;
  }
}

// ─── Fetch recent incidents ───────────────────────────────────────────────────

export async function fetchIncidents(limit = 20): Promise<IncidentLog[]> {
  const sb = getClient();
  if (!sb) return [];

  try {
    const { data, error } = await sb
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      console.error("[Supabase] Fetch error:", error.message);
      return [];
    }
    return (data ?? []) as IncidentLog[];
  } catch (err) {
    console.error("[Supabase] Unexpected error:", err);
    return [];
  }
}
