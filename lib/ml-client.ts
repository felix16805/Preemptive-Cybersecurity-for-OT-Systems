/**
 * lib/ml-client.ts
 * Client for the FastAPI ML detection service.
 * Never hard-codes the API URL - uses environment variable.
 */

export interface MLPredictionRequest {
  features: Record<string, number>;
  timestamp?: string;
}

export interface MLPredictionResponse {
  prediction: "normal" | "attack";
  confidence: number;
  attack_type?: string;
  model_version?: string;
  timestamp: string;
}

export interface MLHealthResponse {
  status: "ok" | "error";
  model_loaded: boolean;
  model_version?: string;
}

export class MLClient {
  private baseUrl: string;
  private timeout: number;

  constructor(baseUrl?: string, timeout: number = 5000) {
    this.baseUrl = baseUrl || process.env.ML_API_URL || "http://localhost:8000";
    this.timeout = timeout;
  }

  async health(): Promise<MLHealthResponse> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);
      
      const response = await fetch(`${this.baseUrl}/health`, {
        method: "GET",
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`ML health check failed: ${response.status}`);
      }
      
      return await response.json();
    } catch (err) {
      return {
        status: "error",
        model_loaded: false,
      };
    }
  }

  async predict(request: MLPredictionRequest): Promise<MLPredictionResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`ML prediction failed: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Validate response
      if (typeof data.prediction !== "string" || typeof data.confidence !== "number") {
        throw new Error("Invalid ML prediction response format");
      }

      return {
        prediction: data.prediction,
        confidence: Math.max(0, Math.min(1, data.confidence)),
        attack_type: data.attack_type,
        model_version: data.model_version,
        timestamp: data.timestamp || new Date().toISOString(),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }
}

// Default singleton instance
export const mlClient = new MLClient();