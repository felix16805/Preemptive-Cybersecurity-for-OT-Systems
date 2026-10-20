#!/usr/bin/env python3
"""
SafeCut synthetic dataset generator (TRL-4 style validation data)
=================================================================

Generates five artefacts that line up with the IDF zones:

  Zone 1  network_topology_edges.csv, safety_loops_registry.csv  (+ topologies/ for other sizes)
  Zone 1/2 raw_packet_captures.json, pcap_extracted.csv          (Modbus/TCP register-write trace)
  Zone 2/3 solver_performance_validation.csv, solver_performance_summary.csv,
           reference_cut_certificate.json
  Zone 5  reactor_process_dynamics.csv, reactor_scenario_summary.csv
  --      run_metadata.json (seed, versions, parameters -> reproducibility)

IMPORTANT (integrity of the validation data)
--------------------------------------------
* Every timing in solver_performance_validation.csv is MEASURED on the machine that runs this
  script (time.perf_counter around the real min-cut and the real verifier). Nothing is typed in.
  Pure-Python NetworkX will not match a C/FPGA implementation; report what you measure and state
  the hardware/software used (run_metadata.json records it).
* Switch-programming / hardware enforcement latency cannot be measured here. It is an explicit
  assumption (--hw-enforcement-ms) and is labelled as such in the outputs.
* Reactor temperatures come out of the ODE. They are not forced to hit any target value.
* The Modbus trace is synthetic. For a real capture use MiniCPS/pymodbus + tshark and feed the
  resulting CSV through the same policy monitor (evaluate_policy).

Requirements:  pip install networkx numpy pandas
Usage:         python safecut_dataset_generator.py --out safecut_datasets --seed 42
"""

import argparse
import json
import math
import platform
import statistics
import sys
import time
from collections import deque
from dataclasses import dataclass, field
from pathlib import Path

import networkx as nx
import numpy as np
import pandas as pd

INF_CAP = 1e9            # "infinite" capacity for safety-instrumented-function (SIF) edges
ORDINARY_CAP = 1.0
DEFAULT_ATTACKER_CAP = 0.9   # attacker-eject bias (<1.0 => solver prefers cutting attacker links)
SINK = "__PROTECTED_SINK__"


# =============================================================================
# ZONE 1 - Topology / safety-loop tag store
# =============================================================================
@dataclass
class Topology:
    G: nx.DiGraph                       # physical/logical graph (links stored in both directions)
    H: nx.DiGraph                       # flow network = G + super-sink over protected assets
    adj: dict                           # adjacency lists for the independent verifier
    roles: dict
    sif_loops: list
    sif_links: set                      # frozenset({u, v}) of every SIF link
    protected: list
    attacker: str
    entry_nodes: list = field(default_factory=list)


def _add_link(G, u, v, cap, link_type, proto, sif):
    if G.has_edge(u, v):
        return
    for a, b in ((u, v), (v, u)):
        G.add_edge(a, b, capacity=cap, link_type=link_type, protocol=proto, is_sif=sif)


LOOP_NAMES = ["Emergency Cooling", "Pressure Control", "Level Trip", "Flow Interlock",
              "Overtemp Shutdown", "Relief Valve", "Feed Cutoff", "Agitator Trip"]


def build_topology(n_nodes, seed=0, attacker_cap=DEFAULT_ATTACKER_CAP, entry_points=None):
    """Purdue-style layered ICS graph.  IDs: sensors 1000+, PLCs 2000+, actuators 3000+,
    HMI/historian/eng-WS 4000+, DMZ switches 5000+, attacker Node_666."""
    if n_nodes < 12:
        raise ValueError("need at least 12 nodes")
    rng = np.random.default_rng(seed)

    n_plc = max(2, n_nodes // 10)
    n_sup = max(3, n_nodes // 12)
    n_dmz = max(2, n_nodes // 25)
    n_field = n_nodes - n_plc - n_sup - n_dmz - 1
    n_sens = n_field // 2
    n_act = n_field - n_sens

    sensors = [f"Node_{1000 + i}" for i in range(n_sens)]
    plcs = [f"Node_{2000 + i}" for i in range(n_plc)]
    actuators = [f"Node_{3000 + i}" for i in range(n_act)]
    sups = [f"Node_{4000 + i}" for i in range(n_sup)]
    dmzs = [f"Node_{5000 + i}" for i in range(n_dmz)]
    attacker = "Node_666"

    roles = {}
    roles.update({n: "Sensor" for n in sensors})
    roles.update({n: "PLC" for n in plcs})
    roles.update({n: "Actuator" for n in actuators})
    for i, n in enumerate(sups):
        roles[n] = "HMI" if i < n_sup - 2 else ("Historian" if i == n_sup - 2 else "EngWS")
    roles.update({n: "DMZ_Switch" for n in dmzs})
    roles[attacker] = "Attacker"
    hmis = [n for n in sups if roles[n] == "HMI"]

    G = nx.DiGraph()
    G.add_nodes_from(roles)
    nx.set_node_attributes(G, roles, "role")

    # --- field level: first sensor + first actuator of every PLC form a SIF loop ---------------
    sif_links, sif_loops = set(), []
    for i, s in enumerate(sensors):
        sif = i < n_plc
        _add_link(G, s, plcs[i % n_plc], INF_CAP if sif else ORDINARY_CAP, "Physical", "Modbus/TCP", sif)
        if sif:
            sif_links.add(frozenset((s, plcs[i % n_plc])))
    for j, a in enumerate(actuators):
        sif = j < n_plc
        _add_link(G, plcs[j % n_plc], a, INF_CAP if sif else ORDINARY_CAP, "Physical", "Modbus/TCP", sif)
        if sif:
            sif_links.add(frozenset((plcs[j % n_plc], a)))
    for p in range(n_plc):
        s, pl, a = sensors[p], plcs[p], actuators[p]
        sif_loops.append({
            "sif_id": f"SIF_{p + 1:02d}",
            "loop_name": LOOP_NAMES[p % len(LOOP_NAMES)],
            "sensor_element": s, "logic_solver_plc": pl, "final_control_element": a,
            "required_path_nodes": [s, pl, a],
        })

    # --- control level: PLC ring, supervisory <-> PLC ----------------------------------------
    for i in range(n_plc):
        _add_link(G, plcs[i], plcs[(i + 1) % n_plc], ORDINARY_CAP, "Ethernet", "Modbus/TCP", False)
    for s in sups:
        for pi in rng.choice(n_plc, size=min(2, n_plc), replace=False):
            _add_link(G, s, plcs[int(pi)], ORDINARY_CAP, "Ethernet", "Modbus/TCP", False)
    for p in plcs:  # every PLC needs at least one supervisory link
        if not any(roles[v] in ("HMI", "Historian", "EngWS") for v in G.successors(p)):
            _add_link(G, sups[int(rng.integers(n_sup))], p, ORDINARY_CAP, "Ethernet", "Modbus/TCP", False)

    # --- DMZ ---------------------------------------------------------------------------------
    for d in dmzs:
        for si in rng.choice(n_sup, size=min(2, n_sup), replace=False):
            _add_link(G, d, sups[int(si)], ORDINARY_CAP, "Ethernet", "TCP/IP", False)
    for i in range(n_dmz):
        _add_link(G, dmzs[i], dmzs[(i + 1) % n_dmz], ORDINARY_CAP, "Ethernet", "TCP/IP", False)

    # --- attacker foothold(s) --------------------------------------------------------------
    if entry_points is None:
        entry_points = 3 + n_nodes // 60
    cands = hmis + dmzs
    entry_idx = rng.choice(len(cands), size=min(entry_points, len(cands)), replace=False)
    entry_nodes = [cands[int(i)] for i in entry_idx]
    for e in entry_nodes:
        _add_link(G, attacker, e, attacker_cap, "Ethernet", "TCP/IP", False)

    # --- guarantee connectivity ------------------------------------------------------------
    comps = list(nx.weakly_connected_components(G))
    for comp in comps[1:]:
        _add_link(G, sorted(comp)[0], sups[0], ORDINARY_CAP, "Ethernet", "TCP/IP", False)

    H = G.copy()
    for p in plcs:
        H.add_edge(p, SINK, capacity=INF_CAP)
    adj = {u: list(G.successors(u)) for u in G.nodes}
    return Topology(G, H, adj, roles, sif_loops, sif_links, plcs, attacker, entry_nodes)


def topology_edges_df(topo):
    seen, rows = set(), []
    for u, v, d in topo.G.edges(data=True):
        key = frozenset((u, v))
        if key in seen:
            continue
        seen.add(key)
        rows.append({
            "source_node": u, "source_role": topo.roles[u],
            "destination_node": v, "destination_role": topo.roles[v],
            "link_type": d["link_type"], "industrial_protocol": d["protocol"],
            "is_sif_edge": d["is_sif"], "base_capacity_assignment": d["capacity"],
        })
    return pd.DataFrame(rows)


def sif_registry_df(topo):
    df = pd.DataFrame(topo.sif_loops)
    df["required_path_nodes"] = df["required_path_nodes"].apply(json.dumps)
    return df


# =============================================================================
# ZONE 2/3 - Min-cut solver + independent reachability-certificate verifier
# =============================================================================
def _reachable(adj, source, removed):
    seen, dq = {source}, deque([source])
    while dq:
        u = dq.popleft()
        for v in adj[u]:
            if frozenset((u, v)) in removed or v in seen:
                continue
            seen.add(v)
            dq.append(v)
    return seen


def solve_min_cut(topo, source):
    """Safety-constrained min cut: SIF links carry INF capacity so they are never cut.
    Returns (feasible, cut_value, cut_links)."""
    cut_value, (S, T) = nx.minimum_cut(topo.H, source, SINK, capacity="capacity")
    if cut_value >= INF_CAP:
        return False, cut_value, set()          # attacker only reachable through SIF edges
    cut_links = set()
    for u in S:
        for v in topo.G.successors(u):
            if v in T:
                cut_links.add(frozenset((u, v)))
    return True, cut_value, cut_links


def verify_certificate(topo, source, cut_links):
    """Independent verifier (separate code path, plain BFS - does not call the solver)."""
    checks = {}
    checks["no_sif_edge_cut"] = all(l not in topo.sif_links for l in cut_links)
    reach = _reachable(topo.adj, source, cut_links)
    checks["attacker_isolated_from_protected"] = not (reach & set(topo.protected))
    checks["all_sif_loops_intact"] = all(
        frozenset((a, b)) not in cut_links
        for loop in topo.sif_loops
        for a, b in zip(loop["required_path_nodes"], loop["required_path_nodes"][1:])
    )
    irredundant = True
    for l in cut_links:                          # inclusion-minimality: restoring any link must re-open a path
        if not (_reachable(topo.adj, source, cut_links - {l}) & set(topo.protected)):
            irredundant = False
            break
    checks["cut_is_irredundant"] = irredundant
    return all(checks.values()), checks


def run_isolation(topo, source):
    t0 = time.perf_counter()
    feasible, cut_value, cut_links = solve_min_cut(topo, source)
    t1 = time.perf_counter()
    out = {"solve_ms": (t1 - t0) * 1e3, "feasible": feasible, "cut_value": cut_value,
           "cut_links": cut_links, "verify_ms": float("nan"), "checks": None}
    if not feasible:
        out["verdict"] = "INFEASIBLE (Interlock Alert)"
        return out
    t2 = time.perf_counter()
    ok, checks = verify_certificate(topo, source, cut_links)
    t3 = time.perf_counter()
    out.update(verify_ms=(t3 - t2) * 1e3, checks=checks, verdict="ACCEPTED" if ok else "REJECTED")
    return out


# =============================================================================
# ZONE 1/2 - Modbus/TCP register-write policy monitor + synthetic trace
# =============================================================================
IPS = {"PLC": "192.168.1.10", "HMI": "192.168.1.50", "ENG": "192.168.1.60", "ATTACKER": "192.168.1.99"}
KNOWN_MASTERS = {IPS["HMI"], IPS["ENG"]}
AUTHORISED_WRITERS = {IPS["HMI"], IPS["ENG"]}
WRITE_FCS = {5, 6, 15, 16}
SIS_REGISTERS = range(40100, 40200)     # SIS trip lock / bypass registers: no network writes allowed
SETPOINT_REG = 40002
SETPOINT_BOUNDS = (340, 360)            # K
FC_NAMES = {3: "03 (Read)", 6: "06 (Write)", 16: "16 (Write Mult)"}
REG_NAMES = {40001: "Temp", 40002: "Setpoint", 40100: "SIS Trip Lock"}


def evaluate_policy(pkt):
    """Returns (policy_status, containment_trigger_asserted, reason)."""
    fc, src, reg, val = pkt["fc"], pkt["src"], pkt["reg"], pkt["value"]
    if fc in WRITE_FCS:
        if reg in SIS_REGISTERS:
            return "UNAUTHORIZED", True, "write to SIS-protected register"
        if src not in AUTHORISED_WRITERS:
            return "UNAUTHORIZED", True, "write from non-authorised master"
        if reg == SETPOINT_REG and not (SETPOINT_BOUNDS[0] <= val <= SETPOINT_BOUNDS[1]):
            return "UNAUTHORIZED", True, "setpoint outside engineering bounds"
        return "ALLOWED", False, ""
    if src not in KNOWN_MASTERS:
        return "UNAUTHORIZED", False, "read from unknown master (recon)"
    return "ALLOWED", False, ""


def measure_policy_eval_ms(reps=2000):
    pkt = {"fc": 16, "src": IPS["ATTACKER"], "reg": 40100, "value": 0}
    samples = []
    for _ in range(reps):
        t0 = time.perf_counter_ns()
        evaluate_policy(pkt)
        samples.append((time.perf_counter_ns() - t0) / 1e6)
    return statistics.median(samples)


def generate_modbus_trace(seed, duration_s, t_attack_s, enforce_delay_ms, poisoned_setpoint_k=420):
    rng = np.random.default_rng(seed)
    pkts, attack_ms = [], t_attack_s * 1e3
    txn = 0

    def add(ts, src, fc, reg, val):
        nonlocal txn
        txn += 1
        pkts.append({"timestamp_ms": round(ts, 2), "transaction_id": txn, "source_ip": src, "src": src,
                     "dest_ip": IPS["PLC"], "fc": fc, "reg": reg, "value": val})

    t = 0.0
    while t < duration_s * 1e3:                                   # 10 ms HMI poll of temperature
        add(t, IPS["HMI"], 3, 40001, None)
        t += 10.0 + rng.normal(0, 0.3)
    t = 250.0
    while t < duration_s * 1e3:                                   # 2 Hz operator setpoint refresh
        add(t, IPS["HMI"], 6, SETPOINT_REG, int(rng.integers(349, 352)))
        t += 500.0
    add(attack_ms - 30.0, IPS["ATTACKER"], 3, 40001, None)        # recon read
    add(attack_ms + 0.0, IPS["ATTACKER"], 16, 40100, 0x0000)      # clear SIS trip lock
    add(attack_ms + 1.2, IPS["ATTACKER"], 6, SETPOINT_REG, poisoned_setpoint_k)   # poison setpoint
    t = attack_ms + 5.0
    while t < attack_ms + enforce_delay_ms:                       # retries until the cut lands
        add(t, IPS["ATTACKER"], 16, 40100, 0x0000)
        t += 5.0

    pkts.sort(key=lambda p: p["timestamp_ms"])
    rows = []
    for p in pkts:
        t0 = time.perf_counter_ns()
        status, trig, reason = evaluate_policy(p)
        eval_ms = (time.perf_counter_ns() - t0) / 1e6
        rows.append({
            "timestamp_ms": p["timestamp_ms"], "transaction_id": p["transaction_id"],
            "source_ip": p["source_ip"], "dest_ip": p["dest_ip"],
            "modbus_function_code": FC_NAMES.get(p["fc"], str(p["fc"])),
            "target_register": f'{p["reg"]} ({REG_NAMES.get(p["reg"], "")})'.strip(),
            "write_value": "N/A" if p["value"] is None else (hex(p["value"]) if p["reg"] in SIS_REGISTERS else p["value"]),
            "policy_status": status, "containment_trigger_asserted": trig,
            "violation_reason": reason, "policy_eval_ms": round(eval_ms, 6),
        })
    return rows


# =============================================================================
# ZONE 5 - Exothermic CSTR (Seborg-style) with SIF / attack / mitigation logic
# =============================================================================
@dataclass
class ReactorParams:
    q: float = 100.0 / 60      # feed flow, L/s
    V: float = 100.0           # L
    CAf: float = 1.0           # feed concentration, mol/L
    Tf: float = 350.0          # feed temp, K
    rho: float = 1000.0        # g/L
    Cp: float = 0.239          # J/g/K
    dH: float = -5.0e4         # J/mol (exothermic)
    E_R: float = 8750.0        # K
    k0: float = 7.2e10 / 60    # 1/s
    UA: float = 5.0e4 / 60     # J/s/K at cooling effectiveness 1.0
    Tc: float = 300.0          # coolant temp, K
    T_set: float = 350.0       # nominal setpoint, K
    T_set_poisoned: float = 420.0
    Kc: float = 0.3            # proportional gain (cooling effectiveness per K)
    T_sif_trip: float = 365.0  # SIS high-temperature trip -> full cooling
    T_sif_reset: float = 352.0
    T_runaway: float = 450.0   # status label threshold only


def _rhs(CA, T, eff, P):
    k = P.k0 * math.exp(-P.E_R / T)
    dCA = P.q / P.V * (P.CAf - CA) - k * CA
    dT = (P.q / P.V * (P.Tf - T)
          + (-P.dH) / (P.rho * P.Cp) * k * CA
          + P.UA * eff * (P.Tc - T) / (P.V * P.rho * P.Cp))
    return dCA, dT


def _rk4(CA, T, eff, dt, P):
    a1, b1 = _rhs(CA, T, eff, P)
    a2, b2 = _rhs(CA + 0.5 * dt * a1, T + 0.5 * dt * b1, eff, P)
    a3, b3 = _rhs(CA + 0.5 * dt * a2, T + 0.5 * dt * b2, eff, P)
    a4, b4 = _rhs(CA + dt * a3, T + dt * b3, eff, P)
    return (CA + dt / 6 * (a1 + 2 * a2 + 2 * a3 + a4),
            T + dt / 6 * (b1 + 2 * b2 + 2 * b3 + b4))


def simulate_reactor(scenario, enforce_delay_s, P=ReactorParams(), t_attack=10.0, t_end=60.0,
                     t_restore=25.0, dt=1e-3, log_dt=0.1, seed=0):
    """
    scenario:
      baseline          - no attack
      no_mitigation     - attack persists: setpoint poisoned + SIS bypassed
      safecut           - attacker ejected after enforce_delay; SIF links kept, SIS re-armed,
                          operator restores the setpoint at t_restore
      blind_quarantine  - everything cut after enforce_delay (SIF links too): sensor/actuator
                          path lost, valve holds the last (attacker-forced) command
    Attack payload: SIS trip lock cleared (bypass) + setpoint poisoned to 420 K (cooling shut off).
    Traffic column is a MODELLED proxy, not a measurement.
    """
    rng = np.random.default_rng(seed)
    CA, T = 0.5, P.T_set
    for _ in range(int(30 / dt)):                        # warm-up to the controlled steady state
        eff = min(2.0, max(0.0, 1 + P.Kc * (T - P.T_set)))
        CA, T = _rk4(CA, T, eff, dt, P)

    n_steps = int(round(t_end / dt))
    s_att = int(round(t_attack / dt))
    s_enf = s_att + max(1, int(round(enforce_delay_s / dt)))
    s_res = int(round(t_restore / dt))
    log_every = int(round(log_dt / dt))
    attack_on = scenario != "baseline"
    enforcing = scenario in ("safecut", "blind_quarantine")

    poisoned = bypassed = tripped = False
    frozen_eff, eff_prev = None, 1.0
    rows = []
    for step in range(n_steps + 1):
        t = step * dt
        if attack_on and step == s_att:
            poisoned = bypassed = True
        enforced = enforcing and step >= s_enf
        if scenario == "safecut" and step == s_enf:
            bypassed = False                              # SIS re-armed; SIF path intact
        if scenario == "safecut" and step == s_res:
            poisoned = False                              # operator restores setpoint locally
        if scenario == "blind_quarantine" and step == s_enf:
            frozen_eff = eff_prev                         # valve holds last forced command

        T_sp = P.T_set_poisoned if poisoned else P.T_set
        eff_reg = min(2.0, max(0.0, 1 + P.Kc * (T - T_sp)))
        blind = scenario == "blind_quarantine" and enforced
        sif_online = (not bypassed) and (not blind)
        if sif_online:
            if T > P.T_sif_trip:
                tripped = True
            elif T < P.T_sif_reset:
                tripped = False
        else:
            tripped = False
        eff = frozen_eff if blind else (2.0 if tripped else eff_reg)
        eff_prev = eff

        if step % log_every == 0 or step in (s_att, s_enf):
            if not attack_on or step < s_att:
                op, threat, mode = "Baseline", "Green", "None"
            elif step == s_att:
                op, threat, mode = "Intrusion Executed", "Red", "Detection Phase" if enforcing else "None"
            elif step == s_enf and enforcing:
                op, threat, mode = "Enforcement Applied", "Red", None
            elif tripped:
                op, threat, mode = "Coolant Injection (SIF trip)", "Red", None
            elif scenario == "safecut" and step >= s_res:
                op, threat, mode = "Post-Incident State", "Green", None
            else:
                op, threat, mode = "Attack Ongoing" if not enforced else "Post-Enforcement", "Red", None
            if mode is None:
                mode = {"safecut": "SafeCut Isolation Active",
                        "blind_quarantine": "Blind Quarantine (all links cut)"}.get(scenario, "None")
            if enforcing and s_att <= step < s_enf and op != "Enforcement Applied":
                mode = "Detection Phase"
            if T >= P.T_runaway:
                status = "Runaway"
            elif scenario == "safecut" and step >= s_res:
                status = "Safe Containment"
            elif enforced and scenario == "safecut":
                status = "Contained"
            elif attack_on and step >= s_att:
                status = "Vulnerable"
            else:
                status = "Nominal"
            traffic = 420 + rng.normal(0, 4)
            if tripped:
                traffic += 15
            if blind:
                traffic = 0.0
            rows.append({
                "scenario": scenario, "timestamp_s": round(t, 4), "operating_state": op,
                "threat_level": threat, "mitigation_mode_active": mode,
                "reactor_temp_k": round(T, 3), "reactor_conc_mol_l": round(CA, 5),
                "cooling_effectiveness": round(eff, 4), "sif_tripped": tripped,
                "safety_loop_traffic_packets_sec_modelled": round(traffic, 1), "plant_status": status,
            })
        CA, T = _rk4(CA, T, eff, dt, P)
        if T > 2000:                                       # numerical guard
            break
    return pd.DataFrame(rows)


# =============================================================================
# Orchestration
# =============================================================================
def benchmark(sizes, trials, seed, attacker_cap, policy_eval_ms):
    rows, reference_cert = [], None
    build_topology(12, seed=0)                               # warm-up (imports / caches)
    _w = build_topology(12, seed=0)
    run_isolation(_w, _w.attacker)
    for n in sizes:
        in_loop_trials = max(3, trials // 5)
        for k in range(trials + in_loop_trials):
            in_loop = k >= trials
            topo = build_topology(n, seed=seed + 1000 * n + k, attacker_cap=attacker_cap)
            source = topo.sif_loops[0]["sensor_element"] if in_loop else topo.attacker
            res = run_isolation(topo, source)
            sif_cut = sum(1 for l in res["cut_links"] if l in topo.sif_links)
            row = {
                "trial_id": f"N{n}_{'LOOP' if in_loop else 'ATK'}_{k:03d}",
                "scenario": "attacker_inside_sif_loop" if in_loop else "attacker_via_entry_points",
                "network_nodes_count": topo.G.number_of_nodes(),
                "network_links_count": topo.G.number_of_edges() // 2,
                "policy_eval_ms": round(policy_eval_ms, 6),
                "min_cut_solve_time_ms": round(res["solve_ms"], 4),
                "certificate_verify_time_ms": None if math.isnan(res["verify_ms"]) else round(res["verify_ms"], 4),
                "total_e2e_software_latency_ms": round(
                    policy_eval_ms + res["solve_ms"] + (0 if math.isnan(res["verify_ms"]) else res["verify_ms"]), 4),
                "sif_edges_severed": sif_cut,
                "cut_minimality_links_severed": len(res["cut_links"]),
                "cut_value": None if not res["feasible"] else round(res["cut_value"], 4),
                "verification_verdict": res["verdict"],
            }
            if res["checks"]:
                row.update({f"chk_{k_}": v for k_, v in res["checks"].items()})
            rows.append(row)
            if n == sizes[0] and not in_loop and reference_cert is None:
                reference_cert = {
                    "topology_nodes": n, "attacker": source, "entry_nodes": topo.entry_nodes,
                    "cut_links": sorted(sorted(l) for l in res["cut_links"]),
                    "cut_value": res["cut_value"], "checks": res["checks"], "verdict": res["verdict"],
                    "sif_loops": topo.sif_loops,
                }
    return pd.DataFrame(rows), reference_cert


def summarise(df):
    out = []
    for (n, scen), g in df.groupby(["network_nodes_count", "scenario"]):
        row = {"network_nodes_count": n, "scenario": scen, "trials": len(g),
               "verdicts": g["verification_verdict"].value_counts().to_dict()}
        for col in ("min_cut_solve_time_ms", "certificate_verify_time_ms", "total_e2e_software_latency_ms"):
            v = g[col].dropna()
            if len(v):
                row[f"{col}_median"] = round(v.median(), 4)
                row[f"{col}_p95"] = round(v.quantile(0.95), 4)
                row[f"{col}_max"] = round(v.max(), 4)
        row["cut_links_median"] = g["cut_minimality_links_severed"].median()
        row["sif_edges_severed_max"] = g["sif_edges_severed"].max()
        out.append(row)
    return pd.DataFrame(out)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default="safecut_datasets")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--sizes", type=int, nargs="+", default=[12, 100, 400])
    ap.add_argument("--trials", type=int, default=30, help="attack trials per size")
    ap.add_argument("--attacker-cap", type=float, default=DEFAULT_ATTACKER_CAP,
                    help="capacity on attacker links (1.0 removes the eject bias)")
    ap.add_argument("--hw-enforcement-ms", type=float, default=20.0,
                    help="ASSUMED switch/enforcement latency; replace with a testbed measurement")
    ap.add_argument("--trace-seconds", type=float, default=20.0)
    ap.add_argument("--t-attack", type=float, default=10.0)
    args = ap.parse_args()

    out = Path(args.out)
    (out / "topologies").mkdir(parents=True, exist_ok=True)

    # ---- Zone 1: topologies -------------------------------------------------------------
    for i, n in enumerate(args.sizes):
        topo = build_topology(n, seed=args.seed + 1000 * n, attacker_cap=args.attacker_cap)
        if i == 0:
            topology_edges_df(topo).to_csv(out / "network_topology_edges.csv", index=False)
            sif_registry_df(topo).to_csv(out / "safety_loops_registry.csv", index=False)
        topology_edges_df(topo).to_csv(out / "topologies" / f"N{n}_edges.csv", index=False)
        sif_registry_df(topo).to_csv(out / "topologies" / f"N{n}_sif_loops.csv", index=False)
    print(f"[zone1] topologies written for sizes {args.sizes}")

    # ---- Zone 2/3: measured solver benchmark -------------------------------------------
    policy_ms = measure_policy_eval_ms()
    perf, cert = benchmark(args.sizes, args.trials, args.seed, args.attacker_cap, policy_ms)
    perf.to_csv(out / "solver_performance_validation.csv", index=False)
    summ = summarise(perf)
    summ.to_csv(out / "solver_performance_summary.csv", index=False)
    (out / "reference_cut_certificate.json").write_text(json.dumps(cert, indent=2, default=str))
    print("[zone2/3] benchmark done (all times measured on this machine)")
    print(summ.drop(columns=["verdicts"]).to_string(index=False))

    ref = perf[(perf["network_nodes_count"] == args.sizes[0]) & (perf["scenario"] == "attacker_via_entry_points")]
    sw_ms = float(ref["total_e2e_software_latency_ms"].median())
    enforce_delay_s = (sw_ms + args.hw_enforcement_ms) / 1e3
    print(f"[coupling] enforcement delay = {sw_ms:.3f} ms measured software + "
          f"{args.hw_enforcement_ms:.1f} ms ASSUMED hardware = {enforce_delay_s * 1e3:.3f} ms")

    # ---- Zone 1/2: Modbus trace ---------------------------------------------------------
    trace = generate_modbus_trace(args.seed, args.trace_seconds, args.t_attack, enforce_delay_s * 1e3)
    pd.DataFrame(trace).to_csv(out / "pcap_extracted.csv", index=False)
    (out / "raw_packet_captures.json").write_text(json.dumps(trace, indent=1, default=str))
    n_trig = sum(r["containment_trigger_asserted"] for r in trace)
    print(f"[zone1/2] {len(trace)} packets, {n_trig} containment triggers")

    # ---- Zone 5: reactor ----------------------------------------------------------------
    frames = [simulate_reactor(s, enforce_delay_s, t_attack=args.t_attack, seed=args.seed)
              for s in ("baseline", "no_mitigation", "safecut", "blind_quarantine")]
    react = pd.concat(frames, ignore_index=True)
    react.to_csv(out / "reactor_process_dynamics.csv", index=False)
    srows = []
    for s, g in react.groupby("scenario", sort=False):
        pk = g.loc[g["reactor_temp_k"].idxmax()]
        srows.append({"scenario": s, "peak_temp_k": pk["reactor_temp_k"], "time_of_peak_s": pk["timestamp_s"],
                      "final_temp_k": g["reactor_temp_k"].iloc[-1],
                      "runaway_reached": bool((g["plant_status"] == "Runaway").any()),
                      "sif_ever_tripped": bool(g["sif_tripped"].any())})
    sdf = pd.DataFrame(srows)
    sdf.to_csv(out / "reactor_scenario_summary.csv", index=False)
    print("[zone5]\n" + sdf.to_string(index=False))

    # ---- metadata -----------------------------------------------------------------------
    (out / "run_metadata.json").write_text(json.dumps({
        "args": vars(args), "python": sys.version, "platform": platform.platform(),
        "processor": platform.processor(), "networkx": nx.__version__, "numpy": np.__version__,
        "pandas": pd.__version__, "policy_eval_ms_measured_median": policy_ms,
        "enforce_delay_s_used_in_reactor_and_trace": enforce_delay_s,
        "assumptions": ["hardware enforcement latency is an input, not a measurement",
                        "safety_loop_traffic_packets_sec is a modelled proxy",
                        "Modbus trace is synthetic"],
    }, indent=2, default=str))
    print(f"\nAll files written to {out.resolve()}")


if __name__ == "__main__":
    main()
