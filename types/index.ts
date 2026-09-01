// ─── Graph primitives ─────────────────────────────────────────────────────────

export interface OTNode {
  id: string;
  label: string;
  type: "PLC" | "Sensor" | "Actuator" | "HMI" | "SCADA" | "Historian" | "SafetyController" | "Switch";
  isSafetyCritical: boolean;
  x?: number;
  y?: number;
}

export interface OTEdge {
  source: string;
  target: string;
  capacity: number; // Infinity for safety-loop edges
  isSafetyLoop: boolean;
  safetyLoopId?: string; // e.g. "COOLING_LOOP"
}

export interface OTGraph {
  nodes: OTNode[];
  edges: OTEdge[];
}

// ─── Safety loops ─────────────────────────────────────────────────────────────

export interface SafetyLoop {
  id: string;
  name: string;
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
  solverUsed: "Edmonds-Karp";
  sifResults: SIFResult[];
  allPreserved: boolean;
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
}

// ─── Reactor / CSTR ───────────────────────────────────────────────────────────

export interface ReactorDataPoint {
  t: number;      // time in seconds
  temp: number;   // Kelvin
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

// ─── Incident log (Supabase row shape) ───────────────────────────────────────

export interface IncidentLog {
  id?: string;
  created_at?: string;
  detected_at: string;
  responded_at: string;
  mitre_tactic: string;
  source_ip: string;
  target_ip: string;
  mode: "safecut" | "quarantine";
  compromised_node: string;
  cut_edges: CutEdge[];
  certificate: Certificate;
  solve_time_ms: number;
  safety_loops_preserved: number;
  reactor_stable: boolean;
  reactor_curve?: ReactorDataPoint[];
}

