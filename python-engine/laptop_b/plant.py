"""CSTR with an exothermic reaction. If cooling is lost, temperature runs away.

This is the physics that makes the demo visceral: cut the safety loop and the
curve goes vertical; keep it and the curve flattens.
"""
import numpy as np


class CSTR:
    def __init__(self):
        # Standard exothermic CSTR parameters (Seborg et al.).
        self.q, self.V = 100.0, 100.0          # flow, volume
        self.rho, self.Cp = 1000.0, 0.239      # density, heat capacity
        self.dH = -5.0e4                        # heat of reaction (exothermic)
        self.EoverR, self.k0 = 8750.0, 7.2e10   # Arrhenius terms
        self.UA = 8.0e4                          # heat-transfer coeff (tuned)
        self.Ca0 = 1.0                           # feed concentration
        self.T0 = 350.0                          # feed temp  <-- ATTACK target
        self.Tc = 300.0                          # coolant temp <-- SAFETY actuator
        self.Ca, self.T = 0.5, 350.0             # initial state

    def step(self, dt):
        k = self.k0 * np.exp(-self.EoverR / self.T)
        rA = k * self.Ca
        dCa = (self.q / self.V) * (self.Ca0 - self.Ca) - rA
        dT = ((self.q / self.V) * (self.T0 - self.T)
              + (-self.dH / (self.rho * self.Cp)) * rA
              + (self.UA / (self.rho * self.Cp * self.V)) * (self.Tc - self.T))
        self.Ca += dCa * dt
        self.T += dT * dt
        # numeric guard so a runaway doesn't overflow to NaN mid-demo
        self.T = float(np.clip(self.T, 250.0, 1000.0))
        self.Ca = float(np.clip(self.Ca, 0.0, 1.0))
        return self.Ca, self.T


def sis_control(T, T_trip):
    """Safety Instrumented System control law. Emergency cooling above trip."""
    if T > T_trip:
        return 280.0      # max cooling
    if T < T_trip - 10.0:
        return 320.0      # relax
    return 300.0          # hold
