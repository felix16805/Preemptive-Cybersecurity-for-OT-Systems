// ─── Graph primitives ─────────────────────────────────────────────────────────

export const INF_CAPACITY = Number.MAX_SAFE_INTEGER;

export interface OTNode {
  id: string;
  label: string;
  type: "PLC" | "Sensor" | "Actuator" | "HMI" | "SCADA" | "Historian" | "SafetyController" | "Switch";
  isSafetyCritical: boolean;
  criticality: number; // 0-10
  zone?: string;
  x?: number;
  y?: number;
}

export interface OTEdge {
  source: string;
  target: string;
  capacity: number; // Use INF_CAPACITY for safety-loop edges
  isSafetyLoop: boolean;
  protectedFromCut: boolean; // Explicit safety constraint
  safetyLoopId?: string;
}

export interface OTGraph {
  nodes: OTNode[];
  edges: OTEdge[];
}

// ─── Safety loops ─────────────────────────────────────────────────────────────

export interface SafetyLoop {
  id: string;
  name: string;
  source: string;
  controller: string;
  actuator: string;
  required: boolean;
  edges: Array<{ source: string; target: string }>;
}

// ─── Solver output ────────────────────────────────────────────────────────────

export interface CutEdge {
  source: string;
  target: string;
}

export interface SIFResult {
  loopId: string;
  loopName: string;
  preserved: boolean;
  path: string[]; // surviving path nodes
}

export interface Certificate {
  issuedAt: string;
  solverUsed: string;
  sifResults: SIFResult[];
  allPreserved: boolean;
  preservedCount: number;
  requiredCount: number;
  valid: boolean;
}

export interface SafeCutResult {
  mode: "safecut" | "quarantine";
  compromisedNode: string;
  cutEdges: CutEdge[];
  certificate: Certificate;
  solveTimeMs: number;
  safetyLoopsPreserved: number;
  totalSafetyLoops: number;
  reactorStable: boolean;
  feasible: boolean;
  infeasibilityReason?: string;
  maxReactorTemp?: number;
  processStable?: boolean;
}

// ─── Reactor / CSTR ───────────────────────────────────────────────────────────

export interface ReactorDataPoint {
  t: number;      // time in seconds
  temp: number;   // Kelvin
  concentration?: number;
  mode: "safecut" | "quarantine" | "idle";
}

// ─── Attacker state ───────────────────────────────────────────────────────────

declare module '*.css';

export type AttackPhase =
  | "idle"
  | "recon"
  | "exploitation"
  | "lateral_movement"
  | "impact"
  | "contained";

export interface AttackEvent {
  timestamp: string;
  phase: AttackPhase;
  description: string;
  targetNode?: string;
}

// ─── ML / Threat Assessment ───────────────────────────────────────────────────

export interface MLPrediction {
  prediction: "normal" | "attack";
  confidence: number;
  attackType?: string;
  modelVersion?: string;
  timestamp: string;
}

export interface ThreatAssessment {
  riskScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedAction: "MONITOR" | "ALERT" | "INVESTIGATE" | "SAFECUT" | "QUARANTINE";
  reasoning: string;
}

export interface SecurityIncident {
  id: string;
  timestamp: string;
  attackType: string;
  confidence: number;
  sourceIp?: string;
  targetIp?: string;
  targetNode: string;
  riskScore: number;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  response: "MONITOR" | "ALERT" | "INVESTIGATE" | "SAFECUT" | "QUARANTINE";
  safeCutSessionId?: string;
  certificateValid?: boolean;
  reactorStable?: boolean;
  modelVersion?: string;
}

// ─── Incident log (Supabase row shape) ───────────────────────────────────────

export interface IncidentLog {
  id?: string;
  created_at?: string;
  session_id: string;
  threat_node: string;
  threat_ip?: string;
  safecut_triggered: boolean;
  certificate_issued: boolean;
  edges_cut: number;
  safety_loops_preserved: number;
  total_safety_loops: number;
  log_messages: string[];
  attack_type?: string;
  confidence?: number;
  risk_score?: number;
  severity?: string;
  model_version?: string;
}