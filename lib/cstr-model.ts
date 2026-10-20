import type { ReactorDataPoint } from "@/types";

// ─── Physics-based CSTR Reactor Model ────────────────────────────────────────
//
//  Exothermic continuous stirred-tank reactor with a cooling jacket and a
//  first-order reactant whose conversion releases heat (Arrhenius kinetics).
//
//  Behaviour (verified against the Python reference engine):
//    - Cooling loop INTACT  →  the safety-instrumented system holds the reactor
//      at its ~355 K setpoint (thermostatic emergency cooling).
//    - Cooling loop SEVERED →  heat generation is no longer removed; the
//      reaction ignites, temperature crosses the 400 K trip point and runs away
//      to a ~880 K plateau as the reactant is consumed. This is the documented
//      thermal-runaway failure mode that blind quarantine induces.
//
//  Constants were calibrated numerically so the contrast is unmistakable on a
//  120 s chart: a flat line at 355 K versus a runaway S-curve past 400 K.
// ─────────────────────────────────────────────────────────────────────────────

const PARAMS = {
  Tset: 355.0,     // safety-system setpoint / nominal operating temperature (K)
  kcool: 1.1,      // thermostatic cooling gain (1/s) — only removes heat above Tset
  dHad: 285.0,     // adiabatic heat release scale (K) — sets the runaway plateau
  ER: 11000.0,     // activation energy / R (K) — Arrhenius temperature sensitivity
  k0: 5.96e10,     // pre-exponential factor (1/s)
  T_trip: 400.0,   // runaway / disaster threshold (K)
  T_min: 300.0,    // physical floor (K)
  T_max: 880.0,    // physical ceiling / runaway plateau (K)
};

function reactionRate(T: number, C: number): number {
  return PARAMS.k0 * Math.exp(-PARAMS.ER / T) * C;
}

/**
 * Simulate the CSTR for `duration` seconds (Euler, dt = 0.25 s), returning data
 * points sampled every `sampleInterval` seconds.
 *
 *   coolingActive = true   → SafeCut preserved the loop → stable ~355 K
 *   coolingActive = false  → loop severed → thermal runaway
 */
export function simulateCSTR(
  duration: number,
  sampleInterval: number,
  coolingActive: boolean,
  T0 = 355,    // initial temperature (K)
  C0 = 1.0,    // initial reactant concentration (normalised)
  mode: "safecut" | "quarantine" | "idle" = "idle"
): ReactorDataPoint[] {
  const dt = 0.25;
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

    const rate = reactionRate(T, C);
    const heat = PARAMS.dHad * rate; // K/s released by the reaction
    const cool = coolingActive ? PARAMS.kcool * Math.max(0, T - PARAMS.Tset) : 0;

    T += (heat - cool) * dt;
    C -= rate * dt;

    // Physical bounds
    T = Math.min(Math.max(T, PARAMS.T_min), PARAMS.T_max);
    C = Math.max(C, 0);

    t += dt;
  }

  return points;
}

/** The runaway / disaster threshold, exported for chart annotations. */
export const RUNAWAY_THRESHOLD_K = PARAMS.T_trip;

/** Pre-generate comparison datasets (called once at startup) */
export function generateComparisonData() {
  const safecutData = simulateCSTR(120, 2, true, 355, 1.0, "safecut");
  const quarantineData = simulateCSTR(120, 2, false, 355, 1.0, "quarantine");
  return { safecutData, quarantineData };
}
