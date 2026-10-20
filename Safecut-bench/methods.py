"""
Isolation methods under comparison, and an exhaustive ground-truth oracle.

M1  blind_quarantine        — sever the compromised node's whole zone (IT practice)
M2  static_segmentation     — cut along fixed Purdue/zone conduits
M3  connectivity_cut        — safety-constrained min cut (connectivity only)
M4  pst_bounded_cut         — SafeCut: connectivity AND Process-Safety-Time bounded
                              *** this is the new inventive step ***

M3 is the prior-art-adjacent formulation: it guarantees each safety loop still has
*a* path. M4 additionally guarantees each loop still meets its deadline. The gap
between M3 and M4 is a latent deadline violation: connected but too slow.
"""
import time, itertools
import networkx as nx

INF = 1e9
EPS = 1e-9


# ----------------------------------------------------------------- helpers
def sif_edges(G, sifs):
    """Edges on the current shortest sensor->solver->actuator path of each SIF."""
    out = set()
    for s in sifs:
        for a, b in ((s["sensor"], s["logic_solver"]), (s["logic_solver"], s["final_element"])):
            try:
                p = nx.shortest_path(G, a, b, weight="latency_us")
                out.update(tuple(sorted((p[i], p[i + 1]))) for i in range(len(p) - 1))
            except nx.NetworkXNoPath:
                pass
    return out


def loop_latency_ms(G, s):
    try:
        return (nx.shortest_path_length(G, s["sensor"], s["logic_solver"], weight="latency_us") +
                nx.shortest_path_length(G, s["logic_solver"], s["final_element"], weight="latency_us")) / 1000.0
    except nx.NetworkXNoPath:
        return None


def evaluate(G, cut, sifs):
    """Post-cut evaluation: connectivity AND deadline per safety loop."""
    H = G.copy(); H.remove_edges_from(cut)
    res = []
    for s in sifs:
        lat = loop_latency_ms(H, s)
        connected = lat is not None
        meets = bool(connected and lat <= s["pst_budget_ms"] + EPS)
        res.append({"sif_id": s["sif_id"], "class": s["class"], "connected": connected,
                    "post_latency_ms": None if lat is None else round(lat, 4),
                    "pst_budget_ms": s["pst_budget_ms"], "meets_deadline": meets,
                    "margin_ms": None if lat is None else round(s["pst_budget_ms"] - lat, 4)})
    return {
        "n_sif": len(res),
        "n_connected": sum(r["connected"] for r in res),
        "n_meets_deadline": sum(r["meets_deadline"] for r in res),
        "all_connected": all(r["connected"] for r in res),
        "all_meet_deadline": all(r["meets_deadline"] for r in res),
        "per_sif": res,
    }


def contained(G, cut, attacker, targets):
    H = G.copy(); H.remove_edges_from(cut)
    return not any(nx.has_path(H, attacker, t) for t in targets if t in H and attacker in H)


# ----------------------------------------------------------------- methods
def m1_blind_quarantine(G, sifs, attacker, targets):
    t0 = time.perf_counter()
    zone = {attacker} | set(G.neighbors(attacker))
    cut = {tuple(sorted((n, v))) for n in zone for v in G.neighbors(n)}
    return sorted(cut), (time.perf_counter() - t0) * 1000


def m2_static_segmentation(G, sifs, attacker, targets):
    """Cut every conduit crossing the attacker's Purdue tier boundary."""
    t0 = time.perf_counter()
    def tier(x):
        for t in ("L3", "L2", "L1", "L0", "SW"):
            if x.startswith(t): return t
        return "SW"
    at = tier(attacker)
    cut = {tuple(sorted((u, v))) for u, v in G.edges() if (tier(u) == at) != (tier(v) == at)}
    return sorted(cut), (time.perf_counter() - t0) * 1000


def _constrained_cut(G, protected, attacker, targets):
    """Min cut with `protected` edges made uncuttable; attacker-incident edges biased."""
    H = nx.Graph()
    for u, v in G.edges():
        k = tuple(sorted((u, v)))
        if k in protected:
            cap = INF
        elif u == attacker or v == attacker:
            cap = 0.9
        else:
            cap = 1.0
        H.add_edge(u, v, capacity=cap)
    SINK = "__SINK__"
    for t in targets:
        H.add_edge(t, SINK, capacity=INF)
    if attacker not in H or SINK not in H or not nx.has_path(H, attacker, SINK):
        return [], True                       # already separated
    val, (src, _snk) = nx.minimum_cut(H, attacker, SINK)
    if val >= INF:
        return None, False                    # infeasible: only INF cuts separate
    cut = []
    for u in src:
        for v in G.neighbors(u):
            if v not in src:
                cut.append(tuple(sorted((u, v))))
    return sorted(set(cut)), True


def m3_connectivity_cut(G, sifs, attacker, targets):
    t0 = time.perf_counter()
    cut, ok = _constrained_cut(G, sif_edges(G, sifs), attacker, targets)
    return (cut if ok else None), (time.perf_counter() - t0) * 1000


def m4_pst_bounded_cut(G, sifs, attacker, targets, max_iter=15):
    """SafeCut — Process-Safety-Time-bounded constrained cut (the inventive step).

    Unlike M3, which rigidly forbids cutting any edge presently carrying safety
    traffic, this method treats the PHYSICAL TIMING REQUIREMENT as the constraint.
    A safety-path edge may be severed provided a surviving route still delivers the
    protective action inside that loop's Process Safety Time budget. Protection is
    therefore applied lazily and only where a deadline would actually be missed.

    Consequences, both demonstrated experimentally:
      * smaller cuts, because edges are protected only when timing requires it;
      * fewer false infeasibility declarations, because rerouting within the
        deadline budget resolves cases the rigid formulation cannot express.
    """
    t0 = time.perf_counter()
    protected = set()
    rounds = 0
    for _ in range(max_iter):
        rounds += 1
        cut, ok = _constrained_cut(G, protected, attacker, targets)
        if not ok:
            return None, (time.perf_counter() - t0) * 1000, "infeasible", rounds
        ev = evaluate(G, cut, sifs)
        if ev["all_meet_deadline"]:
            return cut, (time.perf_counter() - t0) * 1000, "ok", rounds
        added = False
        for s, r in zip(sifs, ev["per_sif"]):
            if r["meets_deadline"]:
                continue
            for a, b in ((s["sensor"], s["logic_solver"]),
                         (s["logic_solver"], s["final_element"])):
                try:
                    p = nx.shortest_path(G, a, b, weight="latency_us")
                except nx.NetworkXNoPath:
                    continue
                for i in range(len(p) - 1):
                    k = tuple(sorted((p[i], p[i + 1])))
                    if k not in protected:
                        protected.add(k); added = True
        if not added:
            return None, (time.perf_counter() - t0) * 1000, "infeasible", rounds
    return None, (time.perf_counter() - t0) * 1000, "infeasible", rounds


# ------------------------------------------------------------ ground truth
def exhaustive_oracle(G, sifs, attacker, targets, max_edges=18, max_k=3):
    """Brute-force optimum for small instances: smallest cut that contains the
    adversary AND keeps every safety loop inside its PST budget."""
    edges = [tuple(sorted(e)) for e in G.edges()]
    if len(edges) > max_edges:
        return None
    for k in range(0, max_k + 1):
        for combo in itertools.combinations(edges, k):
            cut = list(combo)
            if not contained(G, cut, attacker, targets):
                continue
            if evaluate(G, cut, sifs)["all_meet_deadline"]:
                return {"optimal_cut_size": k, "optimal_cut": cut, "feasible": True}
    return {"optimal_cut_size": None, "optimal_cut": None, "feasible": False}
