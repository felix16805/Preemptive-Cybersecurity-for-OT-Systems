import { OT_TOPOLOGY } from "@/lib/ot-topology";

/**
 * Service Configuration Classification
 * - Supabase: Required for incident persistence and webhooks.
 * - Neo4j: Optional for live dynamic topology updates (falls back to in-memory OT_TOPOLOGY).
 * - SMTP: Optional for email alert dispatch.
 * - Upstash: Optional for rate limiting on incident webhooks.
 */

export interface ServiceStatus {
  name: string;
  required: boolean;
  configured: boolean;
  missingVariables: string[];
  notes?: string;
}

export interface BackendConfigReport {
  isReady: boolean;
  services: {
    supabase: ServiceStatus;
    neo4j: ServiceStatus;
    smtp: ServiceStatus;
    upstash: ServiceStatus;
  };
}

/**
 * Checks whether Supabase is configured for server-side usage.
 */
export function isSupabaseServerConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.trim().length > 0 && key.trim().length > 0);
}

/**
 * Checks whether Supabase is configured for browser client usage.
 */
export function isSupabaseBrowserConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && key && url.trim().length > 0 && key.trim().length > 0);
}

/**
 * Checks whether Neo4j is configured.
 */
export function isNeo4jConfigured(): boolean {
  const uri = process.env.NEO4J_URI;
  const user = process.env.NEO4J_USER;
  const pass = process.env.NEO4J_PASSWORD;
  return Boolean(uri && user && pass);
}

/**
 * Checks whether SMTP mailer is configured.
 */
export function isSmtpConfigured(): boolean {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const to = process.env.ALERT_TO;
  return Boolean(host && user && pass && to);
}

/**
 * Checks whether Upstash Redis is configured for rate limiting.
 */
export function isUpstashConfigured(): boolean {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return Boolean(url && token);
}

/**
 * Inspects all backend service environment configurations safely.
 * Never logs or exposes secret keys.
 */
export function getBackendConfigReport(): BackendConfigReport {
  const supabaseMissing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) supabaseMissing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    supabaseMissing.push("SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  const neo4jMissing: string[] = [];
  if (!process.env.NEO4J_URI) neo4jMissing.push("NEO4J_URI");
  if (!process.env.NEO4J_USER) neo4jMissing.push("NEO4J_USER");
  if (!process.env.NEO4J_PASSWORD) neo4jMissing.push("NEO4J_PASSWORD");

  const smtpMissing: string[] = [];
  if (!process.env.SMTP_HOST) smtpMissing.push("SMTP_HOST");
  if (!process.env.SMTP_USER) smtpMissing.push("SMTP_USER");
  if (!process.env.SMTP_PASS) smtpMissing.push("SMTP_PASS");
  if (!process.env.ALERT_TO) smtpMissing.push("ALERT_TO");

  const upstashMissing: string[] = [];
  if (!process.env.UPSTASH_REDIS_REST_URL) upstashMissing.push("UPSTASH_REDIS_REST_URL");
  if (!process.env.UPSTASH_REDIS_REST_TOKEN) upstashMissing.push("UPSTASH_REDIS_REST_TOKEN");

  const supabaseConfigured = supabaseMissing.length === 0;

  return {
    isReady: supabaseConfigured,
    services: {
      supabase: {
        name: "Supabase Database",
        required: true,
        configured: supabaseConfigured,
        missingVariables: supabaseMissing,
        notes: process.env.SUPABASE_SERVICE_ROLE_KEY
          ? "Configured with privileged Service Role Key."
          : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? "Configured with Anon Key (Service Role Key recommended for backend writes)."
          : "Not configured. Incident persistence will fail with 503.",
      },
      neo4j: {
        name: "Neo4j Graph Database",
        required: false,
        configured: neo4jMissing.length === 0,
        missingVariables: neo4jMissing,
        notes: neo4jMissing.length === 0
          ? "Live topology available."
          : "Not configured. Operating with in-memory OT_TOPOLOGY fallback.",
      },
      smtp: {
        name: "SMTP Mailer (Nodemailer)",
        required: false,
        configured: smtpMissing.length === 0,
        missingVariables: smtpMissing,
        notes: smtpMissing.length === 0
          ? "Email alerts enabled."
          : "Not configured. Email alerts are skipped.",
      },
      upstash: {
        name: "Upstash Redis",
        required: false,
        configured: upstashMissing.length === 0,
        missingVariables: upstashMissing,
        notes: upstashMissing.length === 0
          ? "Rate limiting active."
          : "Not configured. Rate limiting is bypassed.",
      },
    },
  };
}

/**
 * Validation schema for SafeCut and Quarantine API endpoints
 */
export interface SafeCutRequestPayload {
  sessionId: string;
  compromisedNode: string;
  threatIp: string;
}

export function validateSafeCutPayload(body: unknown): {
  valid: boolean;
  errors: string[];
  data?: SafeCutRequestPayload;
} {
  const errors: string[] = [];

  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Request body must be a valid JSON object."] };
  }

  const record = body as Record<string, unknown>;
  const sessionId = record.sessionId;
  const compromisedNode = record.compromisedNode;
  const threatIp = record.threatIp;

  if (typeof sessionId !== "string" || sessionId.trim().length === 0) {
    errors.push("Field 'sessionId' is required and must be a non-empty string.");
  }

  if (typeof compromisedNode !== "string" || compromisedNode.trim().length === 0) {
    errors.push("Field 'compromisedNode' is required and must be a non-empty string.");
  } else {
    const validNodeIds = OT_TOPOLOGY.nodes.map((n) => n.id);
    if (!validNodeIds.includes(compromisedNode.trim())) {
      errors.push(
        `Field 'compromisedNode' ('${compromisedNode}') is invalid. Valid nodes are: ${validNodeIds.join(", ")}`
      );
    }
  }

  if (typeof threatIp !== "string" || threatIp.trim().length === 0) {
    errors.push("Field 'threatIp' is required and must be a non-empty string.");
  } else {
    const trimmedIp = threatIp.trim();
    // Validate IPv4, IPv6, or localhost
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    if (!ipv4Regex.test(trimmedIp) && !ipv6Regex.test(trimmedIp) && trimmedIp !== "localhost" && trimmedIp !== "127.0.0.1") {
      errors.push(`Field 'threatIp' ('${threatIp}') is not a valid IPv4 or IPv6 address.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return {
    valid: true,
    errors: [],
    data: {
      sessionId: (sessionId as string).trim(),
      compromisedNode: (compromisedNode as string).trim(),
      threatIp: (threatIp as string).trim(),
    },
  };
}
