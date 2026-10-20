import { createClient } from "@supabase/supabase-js";
import type { IncidentLog } from "@/types";

// ─── Supabase client singleton ────────────────────────────────────────────────

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

// Check if credentials are real (not template placeholders)
const isConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  !supabaseUrl.includes("your-project") &&
  !supabaseKey.includes("your-anon-key") &&
  supabaseUrl.startsWith("http")
);

const _supabase = isConfigured ? createClient(supabaseUrl, supabaseKey) : null;

function getClient() {
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
      return null;
    }
    return data?.id ?? null;
  } catch {
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
      return [];
    }
    return (data ?? []) as IncidentLog[];
  } catch {
    return [];
  }
}
