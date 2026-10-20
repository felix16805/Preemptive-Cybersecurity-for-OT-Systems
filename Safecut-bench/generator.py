"""
SafeCut-Bench v1.0 — synthetic benchmark corpus generator for safety-constrained
OT network isolation.

Every scenario is generated from an explicit, documented stochastic process with a
recorded seed, so any row can be regenerated bit-for-bit. Design parameters are
anchored to published ICS engineering practice:

  * Topology families follow the Purdue Enterprise Reference Architecture
    (ISA-95 / IEC 62443 zone-and-conduit structure).
  * Per-hop latency is modelled as industrial-Ethernet store-and-forward switch
    latency plus serialization delay (IEEE 802.3 / IEC 61784 profiles).
  * Process Safety Time (PST) budgets follow IEC 61511 practice, where the
    protective loop must act well inside the process safety time; typical
    SIS response allocations run from ~100 ms (fast pressure protection) to
    several seconds (thermal protection).

The corpus is DESIGNED to expose a failure mode that connectivity-only methods
cannot see: a cut may preserve a safety loop's connectivity while forcing its
traffic onto a longer path that misses the Process Safety Time deadline.
"""
import json, hashlib, random, itertools
import numpy as np
import networkx as nx

SCHEMA_VERSION = "safecut-bench-1.0"

# ---------------------------------------------------------------- constants
# industrial ethernet store-and-forward latency per hop (microseconds)
SWITCH_LAT_US = {"core": (8.0, 2.0), "distribution": (12.0, 3.0), "field": (25.0, 6.0)}
# link serialization + media delay by link class (microseconds)
LINK_LAT_US = {"fiber_1g": (5.0, 1.0), "copper_1g": (9.0, 2.0),
               "copper_100m": (38.0, 8.0), "fieldbus": (120.0, 25.0)}
# PST budgets by protective function class (milliseconds), IEC 61511 practice
PST_CLASS = {
    "pressure_relief":    (80.0, 250.0),
    "emergency_shutdown": (150.0, 500.0),
    "cooling":            (400.0, 1500.0),
    "alarm":              (800.0, 3000.0),
    "flow_isolation":     (200.0, 700.0),
}
SIF_CLASSES = list(PST_CLASS.keys())
FAMILIES = ["purdue_layered", "redundant_ring", "star_cell", "meshed_cell", "hierarchical_tree"]


def _lat(spec, rng):
    mu, sd = spec
    return max(0.5, rng.normal(mu, sd))


class ScenarioBuilder:
    def __init__(self, seed):
        self.seed = int(seed)
        self.rng = np.random.default_rng(self.seed)
        self.pyrng = random.Random(self.seed)

    # ------------------------------------------------ topology construction
    def _add_link(self, G, a, b, cls, sw):
        lat = _lat(LINK_LAT_US[cls], self.rng) + _lat(SWITCH_LAT_US[sw], self.rng)
        G.add_edge(a, b, latency_us=round(float(lat), 2), link_class=cls, switch_class=sw)

    def purdue_layered(self, n):
        """L3 enterprise/DMZ, L2 supervisory, L1 control, L0 field."""
        G = nx.Graph()
        n_l3 = max(2, int(n * 0.16)); n_l2 = max(2, int(n * 0.20))
        n_l1 = max(2, int(n * 0.26)); n_l0 = max(3, n - n_l3 - n_l2 - n_l1 - 2)
        l3 = [f"L3_ENT_{i}" for i in range(n_l3)]
        l2 = [f"L2_SUP_{i}" for i in range(n_l2)]
        l1 = [f"L1_PLC_{i}" for i in range(n_l1)]
        l0 = [f"L0_FLD_{i}" for i in range(n_l0)]
        core, field_sw = "SW_CORE", "SW_FIELD"
        G.add_nodes_from(l3 + l2 + l1 + l0 + [core, field_sw])
        for x in l3: self._add_link(G, x, core, "fiber_1g", "core")
        for x in l2: self._add_link(G, x, core, "copper_1g", "core")
        self._add_link(G, core, field_sw, "fiber_1g", "core")
        for x in l1: self._add_link(G, x, field_sw, "copper_1g", "distribution")
        for x in l0:
            parent = self.pyrng.choice(l1)
            self._add_link(G, x, parent, "copper_100m", "field")
            # redundant secondary path (slower) — standard ICS practice
            if len(l1) > 1 and self.rng.random() < 0.62:
                alt = self.pyrng.choice([p for p in l1 if p != parent])
                self._add_link(G, x, alt, "fieldbus", "field")
        # engineering-workstation management link (the TRITON vector)
        if l3 and l1:
            self._add_link(G, l3[0], self.pyrng.choice(l1), "copper_1g", "distribution")
        return G, {"L3": l3, "L2": l2, "L1": l1, "L0": l0, "SW": [core, field_sw]}

    def redundant_ring(self, n):
        G = nx.Graph()
        n_sw = max(4, int(n * 0.30))
        sw = [f"SW_R_{i}" for i in range(n_sw)]
        G.add_nodes_from(sw)
        for i in range(n_sw):
            self._add_link(G, sw[i], sw[(i + 1) % n_sw], "fiber_1g", "core")
        dev, l1, l0 = [], [], []
        for i in range(n - n_sw):
            name = f"L1_PLC_{i}" if i % 3 == 0 else f"L0_FLD_{i}"
            (l1 if i % 3 == 0 else l0).append(name)
            G.add_node(name)
            self._add_link(G, name, self.pyrng.choice(sw), "copper_1g", "distribution")
            dev.append(name)
        return G, {"L3": [], "L2": [], "L1": l1, "L0": l0, "SW": sw}

    def star_cell(self, n):
        G = nx.Graph(); core = "SW_CORE"; G.add_node(core)
        l1, l0 = [], []
        for i in range(n - 1):
            name = f"L1_PLC_{i}" if i % 4 == 0 else f"L0_FLD_{i}"
            (l1 if i % 4 == 0 else l0).append(name)
            G.add_node(name)
            self._add_link(G, name, core, "copper_1g" if i % 4 == 0 else "copper_100m",
                           "core" if i % 4 == 0 else "field")
        return G, {"L3": [], "L2": [], "L1": l1, "L0": l0, "SW": [core]}

    def meshed_cell(self, n):
        G = nx.Graph()
        n_sw = max(3, int(n * 0.22)); sw = [f"SW_M_{i}" for i in range(n_sw)]
        G.add_nodes_from(sw)
        for a, b in itertools.combinations(sw, 2):
            if self.rng.random() < 0.55:
                self._add_link(G, a, b, "fiber_1g", "core")
        # guarantee switch connectivity
        for i in range(n_sw - 1):
            if not G.has_edge(sw[i], sw[i + 1]):
                self._add_link(G, sw[i], sw[i + 1], "fiber_1g", "core")
        l1, l0 = [], []
        for i in range(n - n_sw):
            name = f"L1_PLC_{i}" if i % 3 == 0 else f"L0_FLD_{i}"
            (l1 if i % 3 == 0 else l0).append(name); G.add_node(name)
            k = 2 if self.rng.random() < 0.35 else 1     # dual-homed devices
            for s in self.pyrng.sample(sw, min(k, len(sw))):
                self._add_link(G, name, s, "copper_1g", "distribution")
        return G, {"L3": [], "L2": [], "L1": l1, "L0": l0, "SW": sw}

    def hierarchical_tree(self, n):
        G = nx.Graph(); root = "SW_CORE"; G.add_node(root)
        tier1 = [f"SW_T1_{i}" for i in range(max(2, int(n * 0.10)))]
        for t in tier1: G.add_node(t); self._add_link(G, root, t, "fiber_1g", "core")
        l1, l0 = [], []
        remaining = n - 1 - len(tier1)
        for i in range(remaining):
            if i % 4 == 0:
                name = f"L1_PLC_{i}"; l1.append(name); G.add_node(name)
                self._add_link(G, name, self.pyrng.choice(tier1), "copper_1g", "distribution")
            else:
                name = f"L0_FLD_{i}"; l0.append(name); G.add_node(name)
                parent = self.pyrng.choice(l1) if l1 else self.pyrng.choice(tier1)
                self._add_link(G, name, parent, "copper_100m", "field")
                if len(l1) > 1 and self.rng.random() < 0.58:
                    alt = self.pyrng.choice([p for p in l1 if p != parent])
                    self._add_link(G, name, alt, "fieldbus", "field")
        return G, {"L3": [], "L2": [], "L1": l1, "L0": l0, "SW": [root] + tier1}

    # ------------------------------------------------ safety loops + attack
    def build(self, family, n):
        G, tiers = getattr(self, family)(n)
        if not nx.is_connected(G):                       # repair rare disconnection
            comps = list(nx.connected_components(G))
            for c in comps[1:]:
                self._add_link(G, next(iter(c)), next(iter(comps[0])), "copper_1g", "distribution")

        logic_pool = tiers["L1"] or tiers["SW"]
        field_pool = tiers["L0"] or tiers["L1"]
        n_sif = int(self.rng.integers(2, 7))
        sifs = []
        used = set()
        for i in range(n_sif):
            cand = [c for c in field_pool if c not in used]
            if len(cand) < 2 or not logic_pool:
                break
            sensor, actuator = self.pyrng.sample(cand, 2)
            solver = self.pyrng.choice(logic_pool)
            used.update([sensor, actuator])
            cls = self.pyrng.choice(SIF_CLASSES)
            lo, hi = PST_CLASS[cls]
            pst_ms = float(round(self.rng.uniform(lo, hi), 1))
            try:
                nom = (nx.shortest_path_length(G, sensor, solver, weight="latency_us") +
                       nx.shortest_path_length(G, solver, actuator, weight="latency_us"))
            except nx.NetworkXNoPath:
                continue
            sifs.append({"sif_id": f"SIF_{i}", "class": cls, "sensor": sensor,
                         "logic_solver": solver, "final_element": actuator,
                         "pst_budget_ms": pst_ms,
                         "nominal_latency_ms": round(nom / 1000.0, 4)})
        if len(sifs) < 2:
            return None

        # adversary: prefer an IT/supervisory foothold (realistic entry)
        prot = {s[k] for s in sifs for k in ("sensor", "logic_solver", "final_element")}
        it_pool = [x for x in tiers["L3"] + tiers["L2"] if x not in prot]
        ctl_pool = [x for x in tiers["L1"] if x not in prot]
        sw_pool = [x for x in tiers["SW"] if x not in prot]
        # realistic intrusion depth: IT foothold, control-layer device, or switch.
        # TRITON reached the control layer, so control-device compromise is weighted.
        roll = self.rng.random()
        if roll < 0.40 and ctl_pool:
            attacker = self.pyrng.choice(ctl_pool); depth = "control_layer"
        elif roll < 0.60 and sw_pool:
            attacker = self.pyrng.choice(sw_pool); depth = "infrastructure"
        elif it_pool:
            attacker = self.pyrng.choice(it_pool); depth = "it_foothold"
        elif ctl_pool:
            attacker = self.pyrng.choice(ctl_pool); depth = "control_layer"
        else:
            pool = [x for x in G.nodes if x not in prot]
            if not pool: return None
            attacker = self.pyrng.choice(pool); depth = "other"
        self._last_depth = depth
        tgt_pool = [x for x in G.nodes if x != attacker and x not in prot]
        targets = self.pyrng.sample(tgt_pool, min(len(tgt_pool), int(self.rng.integers(1, 4))))
        if not targets:
            return None
        return G, sifs, attacker, targets, tiers, self._last_depth


def scenario_to_record(sid, seed, family, G, sifs, attacker, targets):
    return {
        "scenario_id": sid, "seed": seed, "family": family,
        "n_nodes": G.number_of_nodes(), "n_edges": G.number_of_edges(),
        "nodes": sorted(G.nodes()),
        "edges": [{"u": u, "v": v, "latency_us": d["latency_us"],
                   "link_class": d["link_class"], "switch_class": d["switch_class"]}
                  for u, v, d in sorted(G.edges(data=True))],
        "safety_loops": sifs,
        "attacker_node": attacker,
        "lateral_targets": sorted(targets),
    }


def record_to_graph(rec):
    G = nx.Graph()
    G.add_nodes_from(rec["nodes"])
    for e in rec["edges"]:
        G.add_edge(e["u"], e["v"], latency_us=e["latency_us"],
                   link_class=e["link_class"], switch_class=e["switch_class"])
    return G


def content_hash(records):
    h = hashlib.sha256()
    for r in records:
        h.update(json.dumps(r, sort_keys=True, separators=(",", ":")).encode())
    return h.hexdigest()
