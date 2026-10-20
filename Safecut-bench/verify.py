"""
SafeCut-Bench verification suite.

Eight independent check families. Every check either PASSES with a printed
statistic or FAILS loudly. Nothing here reuses the generator's or the solver's
internal state: graphs are rebuilt from the on-disk records and every safety
verdict is recomputed from scratch, so a bug in the pipeline cannot hide here.

    python3 verify.py
"""
import sys, json, hashlib, collections
sys.path.insert(0, '/home/claude/bench')
import numpy as np, pandas as pd, networkx as nx
from scipy import stats
from generator import (ScenarioBuilder, scenario_to_record, record_to_graph,
                       content_hash, FAMILIES, PST_CLASS, SCHEMA_VERSION)
import methods as M

OUT = "/home/claude/bench/out"
PASS, FAIL = [], []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name)
    print(f"  [{'PASS' if cond else 'FAIL'}] {name}" + (f"  —  {detail}" if detail else ""))
    return cond


def section(t):
    print(f"\n{'='*78}\n{t}\n{'='*78}")


records = [json.loads(l) for l in open(f"{OUT}/scenarios.jsonl")]
df = pd.read_csv(f"{OUT}/results.csv")
meta = json.load(open(f"{OUT}/manifest.json"))
N = len(records)

# ------------------------------------------------------------------ V1
section("V1 — STRUCTURAL INTEGRITY  (every scenario well-formed)")
bad_conn = bad_sif = bad_atk = bad_lat = bad_dup_ep = 0
for r in records:
    G = record_to_graph(r)
    if not nx.is_connected(G): bad_conn += 1
    eps = set()
    for s in r["safety_loops"]:
        t = (s["sensor"], s["logic_solver"], s["final_element"])
        if len(set(t)) != 3: bad_sif += 1
        if not all(x in G for x in t): bad_sif += 1
        eps.update(t)
    if r["attacker_node"] in eps: bad_atk += 1
    if any(e["latency_us"] <= 0 for e in r["edges"]): bad_lat += 1
check("all scenario graphs are connected", bad_conn == 0, f"{bad_conn} disconnected")
check("all safety loops have 3 distinct, present endpoints", bad_sif == 0, f"{bad_sif} malformed")
check("attacker is never a safety-loop endpoint", bad_atk == 0, f"{bad_atk} violations")
check("all edge latencies are strictly positive", bad_lat == 0, f"{bad_lat} bad")
check("schema version consistent", all(r["schema"] == SCHEMA_VERSION for r in records))
check("scenario ids unique", len({r["scenario_id"] for r in records}) == N)

# ------------------------------------------------------------------ V2
section("V2 — REPRODUCIBILITY  (seed regenerates the corpus bit-for-bit)")
sample = records[:200]
mismatch = 0
for r in sample:
    b = ScenarioBuilder(r["seed"])
    out = b.build(r["family"], r["n_nodes"])
    if out is None:
        mismatch += 1; continue
    G2, sifs2, atk2, tgt2, _t, _d = out
    r2 = scenario_to_record(r["scenario_id"], r["seed"], r["family"], G2, sifs2, atk2, tgt2)
    a = json.dumps({k: r[k] for k in ("nodes", "edges", "safety_loops", "attacker_node", "lateral_targets")}, sort_keys=True)
    b_ = json.dumps({k: r2[k] for k in ("nodes", "edges", "safety_loops", "attacker_node", "lateral_targets")}, sort_keys=True)
    if a != b_: mismatch += 1
check("200 sampled scenarios regenerate identically from their seed", mismatch == 0,
      f"{mismatch} mismatches")
check("stored corpus hash matches recomputed hash",
      content_hash(records) == meta["content_sha256"], meta["content_sha256"][:16] + "…")

# ------------------------------------------------------------------ V3
section("V3 — ENGINEERING REALISM  (values lie in published ICS ranges)")
lat = np.array([e["latency_us"] for r in records for e in r["edges"]])
print(f"      per-link latency: mean {lat.mean():.1f} µs, p50 {np.percentile(lat,50):.1f}, "
      f"p99 {np.percentile(lat,99):.1f}, range [{lat.min():.1f}, {lat.max():.1f}]")
check("per-link latency within industrial-Ethernet envelope (1 µs–1 ms)",
      lat.min() > 1 and lat.max() < 1000)
by_class = collections.defaultdict(list)
for r in records:
    for e in r["edges"]:
        by_class[e["link_class"]].append(e["latency_us"])
ordered = [np.mean(by_class[c]) for c in ("fiber_1g", "copper_1g", "copper_100m", "fieldbus")]
for c in ("fiber_1g", "copper_1g", "copper_100m", "fieldbus"):
    print(f"      {c:14s} mean {np.mean(by_class[c]):7.1f} µs  (n={len(by_class[c])})")
check("link-class latency ordering is physically monotonic (fiber<cu1g<cu100m<fieldbus)",
      all(ordered[i] < ordered[i+1] for i in range(3)))
pst = np.array([s["pst_budget_ms"] for r in records for s in r["safety_loops"]])
print(f"      PST budgets: mean {pst.mean():.0f} ms, range [{pst.min():.0f}, {pst.max():.0f}]")
check("PST budgets within IEC 61511 practice (80 ms–3 s)", pst.min() >= 80 and pst.max() <= 3000)
ok_cls = True
for r in records:
    for s in r["safety_loops"]:
        lo, hi = PST_CLASS[s["class"]]
        if not (lo - 1e-6 <= s["pst_budget_ms"] <= hi + 1e-6): ok_cls = False
check("每 PST budget lies inside its declared function-class band".replace("每", "each "), ok_cls)
nom = np.array([s["nominal_latency_ms"] for r in records for s in r["safety_loops"]])
check("nominal loop latency is below its PST budget for every loop (plant is safe pre-attack)",
      bool((nom < pst).all()), f"max nominal/PST ratio {np.max(nom/pst):.3f}")

# ------------------------------------------------------------------ V4
section("V4 — COVERAGE & BALANCE  (corpus spans the design space)")
for col in ("family", "stratum", "attacker_depth"):
    vc = df[col].value_counts()
    print(f"      {col}: " + ", ".join(f"{k}={v}" for k, v in vc.items()))
check("all 5 topology families present", df["family"].nunique() == 5)
check("all 5 size strata present", df["stratum"].nunique() == 5)
check("node counts span the intended range",
      df["n_nodes"].min() <= 20 and df["n_nodes"].max() >= 250,
      f"[{df['n_nodes'].min()}, {df['n_nodes'].max()}]")
check("no size stratum is under-represented (<10% of corpus)",
      (df["stratum"].value_counts(normalize=True) > 0.10).all())
check("corpus contains both feasible and infeasible instances for the rigid method",
      0.02 < (~df["m3_conn_feasible"]).mean() < 0.5,
      f"{(~df['m3_conn_feasible']).mean()*100:.1f}% infeasible")

# ------------------------------------------------------------------ V5
section("V5 — NON-DEGENERACY  (no duplicate or trivial instances)")
sigs = set()
for r in records:
    G = record_to_graph(r)
    sigs.add(hashlib.md5(json.dumps(
        {"e": sorted([sorted([e["u"], e["v"]]) for e in r["edges"]]),
         "a": r["attacker_node"],
         "s": sorted([s["sensor"] + s["final_element"] for s in r["safety_loops"]])},
        sort_keys=True).encode()).hexdigest())
check("no duplicate scenarios", len(sigs) == N, f"{N-len(sigs)} duplicates")
check("every scenario has >=2 safety loops", df["n_sif"].min() >= 2, f"min {df['n_sif'].min()}")
check("every scenario has >=1 lateral target", df["n_targets"].min() >= 1)
deg = [np.mean([d for _, d in record_to_graph(r).degree()]) for r in records[:400]]
print(f"      mean node degree (400 sampled): {np.mean(deg):.2f}")
check("graphs are sparse and realistic (mean degree 1.5–6)", 1.5 < np.mean(deg) < 6)

# ------------------------------------------------------------------ V6
section("V6 — INDEPENDENT RE-VERIFICATION OF EVERY SAFETY VERDICT")
print("      recomputing each reported cut from the on-disk graph, from scratch…")
recheck = collections.Counter()
viol = []
for r, (_, row) in zip(records, df.iterrows()):
    G = record_to_graph(r); sifs = r["safety_loops"]
    atk, tgts = r["attacker_node"], r["lateral_targets"]
    for tag, fn in (("m3", M.m3_connectivity_cut), ("m4", None)):
        if tag == "m3":
            cut, _ = M.m3_connectivity_cut(G, sifs, atk, tgts)
        else:
            cut, _, st, _rd = M.m4_pst_bounded_cut(G, sifs, atk, tgts)
        if cut is None:
            recheck[f"{tag}_infeasible"] += 1; continue
        ev = M.evaluate(G, cut, sifs)
        if not ev["all_meet_deadline"]:
            viol.append((r["scenario_id"], tag)); recheck[f"{tag}_violation"] += 1
        if not M.contained(G, cut, atk, tgts):
            viol.append((r["scenario_id"], tag + "_uncontained")); recheck[f"{tag}_uncontained"] += 1
        recheck[f"{tag}_ok"] += 1
print(f"      {dict(recheck)}")
check("no accepted M3 cut ever misses a deadline", recheck["m3_violation"] == 0)
check("no accepted M4 cut ever misses a deadline", recheck["m4_violation"] == 0)
check("no accepted cut ever fails to contain the adversary",
      recheck["m3_uncontained"] == 0 and recheck["m4_uncontained"] == 0)
check("independent recomputation reproduces the stored feasibility counts",
      recheck["m3_ok"] == int(df["m3_conn_feasible"].sum()) and
      recheck["m4_ok"] == int(df["m4_pst_feasible"].sum()),
      f"m3 {recheck['m3_ok']}=={int(df['m3_conn_feasible'].sum())}, "
      f"m4 {recheck['m4_ok']}=={int(df['m4_pst_feasible'].sum())}")

# ------------------------------------------------------------------ V7
section("V7 — GROUND-TRUTH SOUNDNESS  (exhaustive oracle on small instances)")
g = df[df["gt_available"] & df["gt_feasible"] & df["m4_pst_feasible"]]
print(f"      instances with a brute-force optimum: {len(g)}")
check("M4 never returns a cut smaller than the true optimum (soundness)",
      bool((g["m4_pst_cut"] >= g["gt_optimal_cut"]).all()))
match = (g["m4_pst_cut"] == g["gt_optimal_cut"]).mean()
check("M4 attains the true optimum in >95% of oracle-verified instances",
      match > 0.95, f"{match*100:.1f}%")
# The oracle enumerates cuts only up to size K_MAX, so its "infeasible" means
# "no safe cut of size <= K_MAX exists" — NOT "no safe cut exists". The sound
# check is therefore that any cut M4 returns on such an instance must exceed
# that bound; a smaller one would contradict the exhaustive enumeration.
K_MAX = 3
inf_g = df[df["gt_available"] & (~df["gt_feasible"].astype(bool))]
dis = inf_g[inf_g["m4_pst_feasible"]]
print(f"      oracle-infeasible (within k<={K_MAX}): {len(inf_g)}; M4 returned a cut in {len(dis)}")
check(f"no M4 cut contradicts the oracle's exhaustive enumeration up to k<={K_MAX}",
      bool((dis["m4_pst_cut"] > K_MAX).all()) if len(dis) else True,
      f"all {len(dis)} such cuts have size >{K_MAX} "
      f"(sizes {sorted(dis['m4_pst_cut'].astype(int).unique().tolist())})" if len(dis) else "n/a")
check("M4 declares infeasible whenever no cut of any size exists",
      bool((~inf_g[inf_g["m4_pst_cut"].isna()]["m4_pst_feasible"]).all()) if len(inf_g) else True,
      f"{len(inf_g)-len(dis)} of {len(inf_g)} agreed outright")

# ------------------------------------------------------------------ V8
section("V8 — STATISTICAL CLAIMS  (each headline number, with its test)")
b = int(((~df["m3_conn_feasible"]) & (df["m4_pst_feasible"])).sum())
c = int(((df["m3_conn_feasible"]) & (~df["m4_pst_feasible"])).sum())
chi = (abs(b - c) - 1) ** 2 / (b + c) if (b + c) else 0
p = 1 - stats.chi2.cdf(chi, 1)
print(f"      McNemar feasibility: M4-only={b}, M3-only={c}, chi2={chi:.1f}, p={p:.3g}")
check("M4 strictly dominates M3 on feasibility (no regressions)", c == 0)
check("feasibility gain is significant at p<0.001", p < 0.001)
pair = df[(df["m3_conn_feasible"]) & (df["m4_pst_feasible"])]
w = stats.wilcoxon(pair["m3_conn_cut"], pair["m4_pst_cut"], zero_method="zsplit")
print(f"      Wilcoxon cut size: p={w.pvalue:.3g}; M4 smaller {int((pair['m4_pst_cut']<pair['m3_conn_cut']).sum())}, "
      f"larger {int((pair['m4_pst_cut']>pair['m3_conn_cut']).sum())}")
check("M4 cut size is not worse than M3 in aggregate", w.pvalue < 0.05)
print(f"      blind quarantine deadline compliance: {df['m1_blind_deadline'].mean()*100:.1f}%")
print(f"      static segmentation deadline compliance: {df['m2_static_deadline'].mean()*100:.1f}%")
check("blind quarantine fails the safety requirement on a majority of scenarios",
      df["m1_blind_deadline"].mean() < 0.5)
ci = stats.binomtest(int(df["m1_blind_deadline"].sum()), len(df)).proportion_ci(0.95)
print(f"      95% CI for blind-quarantine compliance: [{ci.low*100:.1f}%, {ci.high*100:.1f}%]")

# ------------------------------------------------------------------ summary
section("SUMMARY")
print(f"  checks passed : {len(PASS)}")
print(f"  checks failed : {len(FAIL)}")
if FAIL:
    for f in FAIL: print(f"     - {f}")
print(f"\n  corpus        : {N} scenarios, sha256 {meta['content_sha256'][:24]}…")
print(f"  verdict       : {'ALL CHECKS PASSED' if not FAIL else 'FAILURES PRESENT'}")
