"""Build SafeCut-Bench and run all four isolation methods over it."""
import sys, json, os, time
sys.path.insert(0, '/home/claude/bench')
import numpy as np
import networkx as nx
from generator import (ScenarioBuilder, scenario_to_record, record_to_graph,
                       content_hash, FAMILIES, SCHEMA_VERSION)
import methods as M

OUT = "/home/claude/bench/out"
os.makedirs(OUT, exist_ok=True)

N_TARGET = 6000
SIZE_STRATA = [(12, 24), (25, 49), (50, 99), (100, 199), (200, 400)]
STRATUM_NAME = ["XS", "S", "M", "L", "XL"]

records, rows = [], []
seed = 0
built = 0
t_start = time.time()

while built < N_TARGET and seed < N_TARGET * 6:
    fam = FAMILIES[seed % len(FAMILIES)]
    si = (seed // len(FAMILIES)) % len(SIZE_STRATA)
    lo, hi = SIZE_STRATA[si]
    rng = np.random.default_rng(seed ^ 0x5EED)
    n = int(rng.integers(lo, hi + 1))
    b = ScenarioBuilder(seed)
    out = b.build(fam, n)
    seed += 1
    if out is None:
        continue
    G, sifs, atk, tgts, tiers, depth = out
    sid = f"SC{built:05d}"
    rec = scenario_to_record(sid, seed - 1, fam, G, sifs, atk, tgts)
    rec["size_stratum"] = STRATUM_NAME[si]
    rec["attacker_depth"] = depth
    rec["schema"] = SCHEMA_VERSION

    row = {"scenario_id": sid, "family": fam, "stratum": STRATUM_NAME[si],
           "attacker_depth": depth, "n_nodes": G.number_of_nodes(),
           "n_edges": G.number_of_edges(), "n_sif": len(sifs),
           "n_targets": len(tgts)}

    for name, fn in (("m1_blind", M.m1_blind_quarantine),
                     ("m2_static", M.m2_static_segmentation)):
        cut, ms = fn(G, sifs, atk, tgts)
        ev = M.evaluate(G, cut, sifs)
        row[f"{name}_cut"] = len(cut)
        row[f"{name}_ms"] = round(ms, 4)
        row[f"{name}_contained"] = M.contained(G, cut, atk, tgts)
        row[f"{name}_conn"] = ev["all_connected"]
        row[f"{name}_deadline"] = ev["all_meet_deadline"]
        row[f"{name}_sif_ok"] = ev["n_meets_deadline"]

    c3, ms3 = M.m3_connectivity_cut(G, sifs, atk, tgts)
    row["m3_conn_feasible"] = c3 is not None
    row["m3_conn_ms"] = round(ms3, 4)
    if c3 is not None:
        ev = M.evaluate(G, c3, sifs)
        row["m3_conn_cut"] = len(c3)
        row["m3_conn_contained"] = M.contained(G, c3, atk, tgts)
        row["m3_conn_conn"] = ev["all_connected"]
        row["m3_conn_deadline"] = ev["all_meet_deadline"]
        row["m3_conn_sif_ok"] = ev["n_meets_deadline"]
    else:
        row.update({"m3_conn_cut": None, "m3_conn_contained": None,
                    "m3_conn_conn": None, "m3_conn_deadline": None, "m3_conn_sif_ok": None})

    c4, ms4, st4, rounds = M.m4_pst_bounded_cut(G, sifs, atk, tgts)
    row["m4_pst_feasible"] = c4 is not None
    row["m4_pst_ms"] = round(ms4, 4)
    row["m4_pst_rounds"] = rounds
    if c4 is not None:
        ev = M.evaluate(G, c4, sifs)
        row["m4_pst_cut"] = len(c4)
        row["m4_pst_contained"] = M.contained(G, c4, atk, tgts)
        row["m4_pst_conn"] = ev["all_connected"]
        row["m4_pst_deadline"] = ev["all_meet_deadline"]
        row["m4_pst_sif_ok"] = ev["n_meets_deadline"]
        row["m4_used_reroute"] = any(
            r["post_latency_ms"] is not None and
            r["post_latency_ms"] > s["nominal_latency_ms"] + 1e-6
            for s, r in zip(sifs, ev["per_sif"]))
        row["m4_min_margin_ms"] = min(
            [r["margin_ms"] for r in ev["per_sif"] if r["margin_ms"] is not None] or [None])
    else:
        row.update({"m4_pst_cut": None, "m4_pst_contained": None, "m4_pst_conn": None,
                    "m4_pst_deadline": None, "m4_pst_sif_ok": None,
                    "m4_used_reroute": None, "m4_min_margin_ms": None})

    # exhaustive ground truth for small instances
    gt = M.exhaustive_oracle(G, sifs, atk, tgts)
    row["gt_available"] = gt is not None
    row["gt_optimal_cut"] = gt["optimal_cut_size"] if gt else None
    row["gt_feasible"] = gt["feasible"] if gt else None

    rec["labels"] = {"gt_optimal_cut_size": row["gt_optimal_cut"],
                     "gt_feasible": row["gt_feasible"],
                     "m4_reference_cut_size": row["m4_pst_cut"],
                     "m4_reference_feasible": row["m4_pst_feasible"]}
    records.append(rec); rows.append(row); built += 1
    if built % 500 == 0:
        print(f"  {built}/{N_TARGET}  ({time.time()-t_start:.0f}s)", flush=True)

print(f"built {built} scenarios in {time.time()-t_start:.0f}s")

import pandas as pd
df = pd.DataFrame(rows)
df.to_csv(f"{OUT}/results.csv", index=False)
with open(f"{OUT}/scenarios.jsonl", "w") as f:
    for r in records:
        f.write(json.dumps(r, separators=(",", ":")) + "\n")

h = content_hash(records)
meta = {"schema": SCHEMA_VERSION, "n_scenarios": built,
        "content_sha256": h, "families": FAMILIES,
        "size_strata": dict(zip(STRATUM_NAME, SIZE_STRATA)),
        "generated_seeds": list(range(seed))}
json.dump(meta, open(f"{OUT}/manifest.json", "w"), indent=2)
print("content sha256:", h)
print("files written to", OUT)
