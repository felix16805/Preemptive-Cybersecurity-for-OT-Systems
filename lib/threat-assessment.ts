/**
 * lib/threat-assessment.ts
 * Risk assessment engine that combines ML confidence with node criticality.
 * ML detects, threat engine assesses, SafeCut responds.
 */

export interface ThreatInput {
  confidence: number;        // 0-1 from ML model
  attackType: string;
  nodeCriticality: number;   // 0-10 from topology
  exposure: number;          // 0-10 network exposure score
}

export interface ThreatOutput {
  riskScore: number;         // 0-100
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  recommendedAction: "MONITOR" | "ALERT" | "INVESTIGATE" | "SAFECUT" | "QUARANTINE";
  reasoning: string;
}

// Configurable thresholds
const THRESHOLDS = {
  LOW_MAX: 25,
  MEDIUM_MAX: 50,
  HIGH_MAX: 75,
  // CRITICAL is anything above HIGH_MAX
};

const ACTION_THRESHOLDS = {
  MONITOR_MAX: 25,
  ALERT_MAX: 50,
  INVESTIGATE_MAX: 75,
  // SAFECUT is anything above INVESTIGATE_MAX
};

export function assessThreat(input: ThreatInput): ThreatOutput {
  const { confidence, attackType, nodeCriticality, exposure } = input;

  // Validate inputs
  const validConfidence = Math.max(0, Math.min(1, confidence));
  const validCriticality = Math.max(0, Math.min(10, nodeCriticality));
  const validExposure = Math.max(0, Math.min(10, exposure));

  // Calculate risk score (0-100)
  // Weighted: confidence (40%), criticality (35%), exposure (25%)
  const confidenceScore = validConfidence * 40;
  const criticalityScore = (validCriticality / 10) * 35;
  const exposureScore = (validExposure / 10) * 25;
  
  // Attack type multiplier
  const attackMultipliers: Record<string, number> = {
    "DoS": 1.2,
    "DDoS": 1.1,
    "injection": 1.3,
    "ransomware": 1.4,
    "backdoor": 1.3,
    "scanning": 0.8,
    "reconnaissance": 0.7,
    "normal": 0.0,
  };
  const attackMultiplier = attackMultipliers[attackType] ?? 1.0;
  
  let riskScore = (confidenceScore + criticalityScore + exposureScore) * attackMultiplier;
  riskScore = Math.round(Math.max(0, Math.min(100, riskScore)));

  // Determine severity
  let severity: ThreatOutput["severity"];
  if (riskScore <= THRESHOLDS.LOW_MAX) {
    severity = "LOW";
  } else if (riskScore <= THRESHOLDS.MEDIUM_MAX) {
    severity = "MEDIUM";
  } else if (riskScore <= THRESHOLDS.HIGH_MAX) {
    severity = "HIGH";
  } else {
    severity = "CRITICAL";
  }

  // Determine recommended action
  let action: ThreatOutput["recommendedAction"];
  if (riskScore <= ACTION_THRESHOLDS.MONITOR_MAX) {
    action = "MONITOR";
  } else if (riskScore <= ACTION_THRESHOLDS.ALERT_MAX) {
    action = "ALERT";
  } else if (riskScore <= ACTION_THRESHOLDS.INVESTIGATE_MAX) {
    action = "INVESTIGATE";
  } else {
    action = "SAFECUT";
  }

  // Build reasoning
  const reasoning = `Risk score ${riskScore}/100 based on ` +
    `confidence ${(validConfidence * 100).toFixed(0)}%, ` +
    `node criticality ${validCriticality}/10, ` +
    `exposure ${validExposure}/10, ` +
    `attack type: ${attackType}.`;

  return {
    riskScore,
    severity,
    recommendedAction: action,
    reasoning,
  };
}

export function getThresholds() {
  return { ...THRESHOLDS, ...ACTION_THRESHOLDS };
}

export function updateThresholds(newThresholds: Partial<typeof THRESHOLDS & typeof ACTION_THRESHOLDS>) {
  Object.assign(THRESHOLDS, newThresholds);
}