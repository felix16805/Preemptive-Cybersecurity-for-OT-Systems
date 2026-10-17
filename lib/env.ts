/**
 * lib/env.ts
 * Environment variable validation with safe defaults for development.
 * Required variables are validated when their corresponding feature is enabled.
 */

export interface EnvConfig {
  // Supabase
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceRoleKey?: string;
  
  // Neo4j
  neo4jUri?: string;
  neo4jUser?: string;
  neo4jPassword?: string;
  
  // SMTP
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  smtpPass?: string;
  alertTo?: string;
  
  // Upstash
  upstashRedisUrl?: string;
  upstashRedisToken?: string;
  
  // ML Service
  mlApiUrl: string;
  
  // App
  nodeEnv: string;
  port: number;
}

export interface ServiceStatus {
  name: string;
  required: boolean;
  configured: boolean;
  missingVariables: string[];
}

export interface EnvReport {
  valid: boolean;
  services: {
    supabase: ServiceStatus;
    neo4j: ServiceStatus;
    smtp: ServiceStatus;
    upstash: ServiceStatus;
    ml: ServiceStatus;
  };
  warnings: string[];
}

function getEnvVar(name: string): string | undefined {
  if (typeof process === "undefined") return undefined;
  return process.env[name];
}

function validateEnv(): EnvReport {
  const warnings: string[] = [];
  
  // Supabase (required for incident logging)
  const supabaseUrl = getEnvVar("NEXT_PUBLIC_SUPABASE_URL");
  const supabaseAnonKey = getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = getEnvVar("SUPABASE_SERVICE_ROLE_KEY");
  
  const supabaseMissing: string[] = [];
  if (!supabaseUrl) supabaseMissing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!supabaseAnonKey) supabaseMissing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (!supabaseServiceRoleKey) {
    supabaseMissing.push("SUPABASE_SERVICE_ROLE_KEY");
    warnings.push("SUPABASE_SERVICE_ROLE_KEY not set - server-side writes may fail with RLS.");
  }
  
  // Neo4j (optional)
  const neo4jUri = getEnvVar("NEO4J_URI");
  const neo4jUser = getEnvVar("NEO4J_USER");
  const neo4jPassword = getEnvVar("NEO4J_PASSWORD");
  
  const neo4jMissing: string[] = [];
  if (!neo4jUri) neo4jMissing.push("NEO4J_URI");
  if (!neo4jUser) neo4jMissing.push("NEO4J_USER");
  if (!neo4jPassword) neo4jMissing.push("NEO4J_PASSWORD");
  
  // SMTP (optional)
  const smtpHost = getEnvVar("SMTP_HOST");
  const smtpUser = getEnvVar("SMTP_USER");
  const smtpPass = getEnvVar("SMTP_PASS");
  const alertTo = getEnvVar("ALERT_TO");
  
  const smtpMissing: string[] = [];
  if (!smtpHost) smtpMissing.push("SMTP_HOST");
  if (!smtpUser) smtpMissing.push("SMTP_USER");
  if (!smtpPass) smtpMissing.push("SMTP_PASS");
  if (!alertTo) smtpMissing.push("ALERT_TO");
  
  // Upstash (optional)
  const upstashUrl = getEnvVar("UPSTASH_REDIS_REST_URL");
  const upstashToken = getEnvVar("UPSTASH_REDIS_REST_TOKEN");
  
  const upstashMissing: string[] = [];
  if (!upstashUrl) upstashMissing.push("UPSTASH_REDIS_REST_URL");
  if (!upstashToken) upstashMissing.push("UPSTASH_REDIS_REST_TOKEN");
  
  // ML Service (optional)
  const mlApiUrl = getEnvVar("ML_API_URL") || "http://localhost:8000";
  const mlMissing: string[] = [];
  // ML is optional - no required vars
  
  return {
    valid: supabaseMissing.length === 0,
    services: {
      supabase: {
        name: "Supabase Database",
        required: true,
        configured: supabaseMissing.length === 0,
        missingVariables: supabaseMissing,
      },
      neo4j: {
        name: "Neo4j Graph Database",
        required: false,
        configured: neo4jMissing.length === 0,
        missingVariables: neo4jMissing,
      },
      smtp: {
        name: "SMTP Mailer",
        required: false,
        configured: smtpMissing.length === 0,
        missingVariables: smtpMissing,
      },
      upstash: {
        name: "Upstash Redis",
        required: false,
        configured: upstashMissing.length === 0,
        missingVariables: upstashMissing,
      },
      ml: {
        name: "ML Detection Service",
        required: false,
        configured: mlMissing.length === 0,
        missingVariables: mlMissing,
      },
    },
    warnings,
  };
}

export const envReport = validateEnv();

export function getEnvConfig(): EnvConfig {
  return {
    supabaseUrl: getEnvVar("NEXT_PUBLIC_SUPABASE_URL") || "",
    supabaseAnonKey: getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "",
    supabaseServiceRoleKey: getEnvVar("SUPABASE_SERVICE_ROLE_KEY"),
    neo4jUri: getEnvVar("NEO4J_URI"),
    neo4jUser: getEnvVar("NEO4J_USER"),
    neo4jPassword: getEnvVar("NEO4J_PASSWORD"),
    smtpHost: getEnvVar("SMTP_HOST"),
    smtpPort: parseInt(getEnvVar("SMTP_PORT") || "587"),
    smtpUser: getEnvVar("SMTP_USER"),
    smtpPass: getEnvVar("SMTP_PASS"),
    alertTo: getEnvVar("ALERT_TO"),
    upstashRedisUrl: getEnvVar("UPSTASH_REDIS_REST_URL"),
    upstashRedisToken: getEnvVar("UPSTASH_REDIS_REST_TOKEN"),
    mlApiUrl: getEnvVar("ML_API_URL") || "http://localhost:8000",
    nodeEnv: getEnvVar("NODE_ENV") || "development",
    port: parseInt(getEnvVar("PORT") || "3000"),
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    getEnvVar("NEXT_PUBLIC_SUPABASE_URL") &&
    getEnvVar("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    getEnvVar("SUPABASE_SERVICE_ROLE_KEY")
  );
}

export function isNeo4jConfigured(): boolean {
  return Boolean(
    getEnvVar("NEO4J_URI") &&
    getEnvVar("NEO4J_USER") &&
    getEnvVar("NEO4J_PASSWORD")
  );
}

export function isMLConfigured(): boolean {
  return Boolean(getEnvVar("ML_API_URL"));
}

export function isSmtpConfigured(): boolean {
  return Boolean(
    getEnvVar("SMTP_HOST") &&
    getEnvVar("SMTP_USER") &&
    getEnvVar("SMTP_PASS") &&
    getEnvVar("ALERT_TO")
  );
}