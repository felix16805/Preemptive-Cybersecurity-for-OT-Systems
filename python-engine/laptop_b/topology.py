"""OT network as a graph + the SafeCut constrained min-cut solver + verifier.

The attacker's Modbus packets are REAL over the cable. Lateral movement through
this graph is the modelled abstraction. State that boundary on the poster.
"""
import time
import networkx as nx

from shared import config

INF = float("inf")


def build_graph():
    G = nx.Graph()
    G.add_nodes_from(config.NODES)
    for u, v, cap in config.LINKS:
        G.add_edge(u, v, capacity=cap)
    return G


def solve_cut(G, attacker=config.ATTACKER_NODE, critical=config.CRITICAL):
    """Constrained min-cut: isolate `attacker` from the rest while the safety
    loop edges are uncuttable (infinite capacity). Returns (cut_edges, solve_ms,
    feasible). Infeasible => attacker sits inside the protected loop (a real,
    honestly-reported limitation)."""
    t0 = time.perf_counter()
    H = G.copy()

    # Make every safety-loop edge impossible to cut.
    for a, b in config.SIF_PATHS + [("SIS", "Actuator_Cool"), ("Sensor_T", "SIS")]:
        if H.has_edge(a, b):
            H[a][b]["capacity"] = INF

    # Tie-break bias: among equal-cost cuts, prefer ejecting the attacker
    # (cut the links AROUND the malware) over walling off the plant. Slightly
    # cheaper attacker-incident edges make the min-cut box the intruder in.
    for nbr in H.neighbors(attacker):
        if H[attacker][nbr]["capacity"] != INF:
            H[attacker][nbr]["capacity"] = 0.9

    # Super-sink joining all critical assets; keep them on the safe side.
    H.add_node("__SINK__")
    for c in critical:
        H.add_edge(c, "__SINK__", capacity=INF)

    try:
        cut_value, (src_side, sink_side) = nx.minimum_cut(H, attacker, "__SINK__")
    except nx.NetworkXUnbounded:
        return [], (time.perf_counter() - t0) * 1000, False

    if cut_value == INF:
        return [], (time.perf_counter() - t0) * 1000, False

    cut_edges = []
    for u in src_side:
        for v in G.neighbors(u):
            if v in sink_side and v != "__SINK__":
                cut_edges.append(tuple(sorted((u, v))))
    cut_edges = sorted(set(cut_edges))
    solve_ms = (time.perf_counter() - t0) * 1000
    return cut_edges, solve_ms, True


def naive_cut(G, attacker=config.ATTACKER_NODE):
    """Baseline: blindly sever the whole compromised zone (attacker + its
    1-hop neighbours). This is what breaks the safety loop."""
    zone = {attacker} | set(G.neighbors(attacker))
    # blast radius: also pull the neighbours' links, catching PLC1 -> Sensor_T
    cut = []
    for n in list(zone):
        for v in G.neighbors(n):
            cut.append(tuple(sorted((n, v))))
    return sorted(set(cut))


def certify(G, cut_edges, solve_ms):
    """Independent verification: remove the cut, confirm every SIF path survives.
    This runs WITHOUT trusting the solver -- it's the checkable proof artifact."""
    H = G.copy()
    H.remove_edges_from(cut_edges)
    sifs = []
    for a, b in config.SIF_PATHS:
        intact = nx.has_path(H, a, b) if (a in H and b in H) else False
        path = nx.shortest_path(H, a, b) if intact else None
        sifs.append({"sif": f"{a}->{b}", "intact": intact, "path": path})
    return {
        "cut_edges": [list(e) for e in cut_edges],
        "cut_size": len(cut_edges),
        "solve_ms": round(solve_ms, 3),
        "all_safe": all(s["intact"] for s in sifs),
        "sifs": sifs,
    }
