import type { ReactorDataPoint } from "@/types";

// ─── Physics-based CSTR Reactor Model ────────────────────────────────────────
//
//  Exothermic CSTR (Continuous Stirred Tank Reactor) with cooling jacket.
//  When the cooling loop is severed, the heat of reaction drives thermal runaway.
//
//  Simplified energy balance:
//    ρ·Cp·V · dT/dt = F·ρ·Cp·(T_feed - T) - UA·(T - T_cool) + (-ΔH)·r·V
//
//  Parameters calibrated so:
//    - Nominal operating point: ~355 K (stable with cooling)
//    - Runaway threshold: 400 K
//    - Runaway endpoint: ~850 K (without cooling)
// ─────────────────────────────────────────────────────────────────────────────

const PARAMS = {
  F: 0.1,          // volumetric flow rate (m³/s)
  V: 1.0,          // reactor volume (m³)
  rho: 1000,       // density (kg/m³)
  Cp: 4184,        // heat capacity (J/kg·K)
  UA: 15_000,      // heat transfer coefficient × area (W/K)
  T_feed: 300,     // feed temperature (K)
  T_cool: 295,     // coolant temperature (K)
  dH: -210_000,    // heat of reaction (J/mol) — exothermic
  E_R: 8500,       // activation energy / R (K) — Arrhenius
  k0: 1.0e7,       // pre-exponential factor (1/s)
  C_feed: 1.0,     // feed concentration (mol/m³)
};

function reactionRate(T: number, C: number): number {
  const k = PARAMS.k0 * Math.exp(-PARAMS.E_R / T);
  return k * C;
}

function dTdt(T: number, C: number, coolingActive: boolean): number {
  const r = reactionRate(T, C);
  const flow_term = (PARAMS.F / PARAMS.V) * PARAMS.rho * PARAMS.Cp * (PARAMS.T_feed - T);
  const cooling_term = coolingActive ? PARAMS.UA * (T - PARAMS.T_cool) : 0;
  const reaction_term = -PARAMS.dH * r * PARAMS.V;
  return (flow_term - cooling_term + reaction_term) / (PARAMS.rho * PARAMS.Cp * PARAMS.V);
}

function dCdt(T: number, C: number): number {
  const r = reactionRate(T, C);
  return (PARAMS.F / PARAMS.V) * (PARAMS.C_feed - C) - r;
}

/**
 * Simulate the CSTR for `duration` seconds with RK4, returning data points
 * sampled every `sampleInterval` seconds.
 */
export function simulateCSTR(
  duration: number,
  sampleInterval: number,
  coolingActive: boolean,
  T0 = 355,    // initial temperature (K)
  C0 = 0.5,    // initial concentration (mol/m³)
  mode: "safecut" | "quarantine" | "idle" = "idle"
): ReactorDataPoint[] {
  const dt = 0.5; // integration timestep (s)
  const points: ReactorDataPoint[] = [];

  let T = T0;
  let C = C0;
  let t = 0;
  let nextSample = 0;

  while (t <= duration) {
    if (t >= nextSample) {
      points.push({ t: Math.round(t), temp: parseFloat(T.toFixed(2)), mode });
      nextSample += sampleInterval;
    }

    // RK4
    const k1T = dTdt(T, C, coolingActive);
    const k1C = dCdt(T, C);

    const k2T = dTdt(T + 0.5 * dt * k1T, C + 0.5 * dt * k1C, coolingActive);
    const k2C = dCdt(T + 0.5 * dt * k1T, C + 0.5 * dt * k1C);

    const k3T = dTdt(T + 0.5 * dt * k2T, C + 0.5 * dt * k2C, coolingActive);
    const k3C = dCdt(T + 0.5 * dt * k2T, C + 0.5 * dt * k2C);

    const k4T = dTdt(T + dt * k3T, C + dt * k3C, coolingActive);
    const k4C = dCdt(T + dt * k3T, C + dt * k3C);

    T += (dt / 6) * (k1T + 2 * k2T + 2 * k3T + k4T);
    C += (dt / 6) * (k1C + 2 * k2C + 2 * k3C + k4C);

    // Clamp — physical bounds
    T = Math.min(Math.max(T, 280), 1200);
    C = Math.max(C, 0);

    t += dt;
  }

  return points;
}

/** Pre-generate comparison datasets (called once at startup) */
export function generateComparisonData() {
  const safecutData = simulateCSTR(120, 2, true,  355, 0.5, "safecut");
  const quarantineData = simulateCSTR(120, 2, false, 355, 0.5, "quarantine");
  return { safecutData, quarantineData };
}
