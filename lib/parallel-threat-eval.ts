import { computeSafeCut, verifyCertificate } from "@/lib/safecut-engine";
import { OT_TOPOLOGY } from "@/lib/ot-topology";
import type { SafeCutResult, Certificate } from "@/types";

/**
 * Interface for a threat scenario
 */
export interface ThreatScenario {
  node: string; // compromised node ID
  ip: string;   // threat IP address
  sessionId: string; // session identifier
}

/**
 * Result of evaluating a single threat scenario
 */
export interface ThreatEvaluationResult {
  scenario: ThreatScenario;
  safecutResult: SafeCutResult | null;
  certificate: Certificate | null;
  error: string | null;
  evaluationTimeMs: number;
}

/**
 * Evaluates multiple threat scenarios in parallel with concurrency control
 * @param scenarios Array of threat scenarios to evaluate
 * @param maxConcurrent Maximum number of concurrent evaluations (default: 3)
 * @returns Promise resolving to array of evaluation results
 */
export async function evaluateThreatsParallel(
  scenarios: ThreatScenario[],
  maxConcurrent: number = 3
): Promise<ThreatEvaluationResult[]> {
  const results: ThreatEvaluationResult[] = new Array(scenarios.length);
  
  // Process in batches to control concurrency
  for (let i = 0; i < scenarios.length; i += maxConcurrent) {
    const batch = scenarios.slice(i, i + maxConcurrent);
    const batchPromises = batch.map((scenario, index) => 
      evaluateSingleThreat(scenario).then(result => {
        results[i + index] = result;
      })
    );
    
    // Wait for batch to complete before proceeding
    await Promise.all(batchPromises);
  }
  
  return results;
}

/**
 * Evaluates a single threat scenario
 * @param scenario The threat scenario to evaluate
 * @returns Promise resolving to the evaluation result
 */
async function evaluateSingleThreat(scenario: ThreatScenario): Promise<ThreatEvaluationResult> {
  const startTime = performance.now();
  
  try {
    // Validate inputs
    if (!scenario.node || !scenario.ip || !scenario.sessionId) {
      throw new Error("Invalid threat scenario: missing required fields");
    }
    
    // Verify node exists in topology
    const validNodes = OT_TOPOLOGY.nodes.map(n => n.id);
    if (!validNodes.includes(scenario.node)) {
      throw new Error(`Invalid node: ${scenario.node}. Valid nodes: ${validNodes.join(", ")}`);
    }
    
    // Run SafeCut computation
    const safecutResult = computeSafeCut({
      graph: OT_TOPOLOGY,
      compromisedNode: scenario.node,
    });
    
    // Generate safety certificate
    const certificate = verifyCertificate(OT_TOPOLOGY, safecutResult.cutEdges);
    
    // Construct result object
    const result: SafeCutResult = {
      mode: "safecut",
      compromisedNode: scenario.node,
      cutEdges: safecutResult.cutEdges,
      certificate,
      solveTimeMs: safecutResult.solveTimeMs,
      safetyLoopsPreserved: certificate.sifResults.filter(r => r.preserved).length,
      totalSafetyLoops: certificate.sifResults.length,
      reactorStable: certificate.allPreserved, // Assuming reactor stable if all safety loops preserved
      feasible: safecutResult.feasible,
      infeasibilityReason: safecutResult.infeasibilityReason
    };
    
    return {
      scenario,
      safecutResult: result,
      certificate,
      error: null,
      evaluationTimeMs: Math.floor(performance.now() - startTime)
    };
  } catch (error) {
    return {
      scenario,
      safecutResult: null,
      certificate: null,
      error: error instanceof Error ? error.message : String(error),
      evaluationTimeMs: Math.floor(performance.now() - startTime)
    };
  }
}

/**
 * Simple metrics collector for evaluation performance
 */
export class EvaluationMetrics {
  private evalCount: number = 0;
  private totalTimeMs: number = 0;
  private errorCount: number = 0;
  
  recordEvaluation(timeMs: number, hasError: boolean): void {
    this.evalCount++;
    this.totalTimeMs += timeMs;
    if (hasError) this.errorCount++;
  }
  
  getAverageTimeMs(): number {
    return this.evalCount > 0 ? Math.floor(this.totalTimeMs / this.evalCount) : 0;
  }
  
  getErrorRate(): number {
    return this.evalCount > 0 ? (this.errorCount / this.evalCount) * 100 : 0;
  }
  
  getSummary(): string {
    return `Evaluations: ${this.evalCount}, Avg Time: ${this.getAverageTimeMs()}ms, Error Rate: ${this.getErrorRate().toFixed(1)}%`;
  }
  
  reset(): void {
    this.evalCount = 0;
    this.totalTimeMs = 0;
    this.errorCount = 0;
  }
}

// Export a default metrics instance for convenience
export const evaluationMetrics = new EvaluationMetrics();