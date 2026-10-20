# SafeCut-Bench v1.0 — Dataset Datasheet

**Content hash (SHA-256):** `f06003bd4bbcda997c12f12d5b3f394b33d755397edc6cb180d2805a7a872f95`
**Scenarios:** 6,000 · **Safety loops:** 23,183 · **Network links:** 1,179,644
**Verification:** 34 / 34 checks passed (`VERIFICATION_REPORT.txt`)

---

## 1. Motivation

No public benchmark exists for *safety-constrained* intrusion containment in OT
networks. Existing ICS security datasets (SWaT, WADI, Tennessee Eastman) supply
process telemetry for **detection**, not network topology with protective-loop
timing constraints for **response**. SafeCut-Bench fills that gap: each instance
poses the question *"which links may be severed to contain this adversary without
any safety-instrumented function missing its deadline?"*

## 2. Composition

Each scenario contains:

| Field | Description |
|---|---|
| `scenario_id`, `seed` | identity and the RNG seed that regenerates it exactly |
| `family` | one of 5 topology families |
| `nodes`, `edges` | graph; each edge carries `latency_us`, `link_class`, `switch_class` |
| `safety_loops` | 2–6 SIFs: sensor → logic solver → final element, with `pst_budget_ms` |
| `attacker_node`, `lateral_targets` | the intrusion |
| `labels` | exhaustive-oracle optimum (small instances) and reference solution |

**Topology families** (1,190–1,205 scenarios each): `purdue_layered`,
`redundant_ring`, `star_cell`, `meshed_cell`, `hierarchical_tree`.

**Size strata** (~1,200 each): XS 12–24, S 25–49, M 50–99, L 100–199, XL 200–400 nodes.

**Attacker depth:** `control_layer` 4,338 · `infrastructure` 1,170 ·
`it_foothold` 467 · `other` 25. Control-layer compromise is weighted because
TRITON reached the control layer; leaf-only attackers make the problem trivial.

## 3. Generative process

Fully specified in `generator.py`; every parameter is anchored to engineering
practice rather than chosen for convenience:

- **Per-hop latency** = store-and-forward switch latency + link serialization,
  sampled per media class. Measured means: fiber-1G 13.0 µs, copper-1G 20.3 µs,
  copper-100M 63.0 µs, fieldbus 145.0 µs — monotonic, as physics requires.
- **PST budgets** follow IEC 61511 practice by protective-function class:
  pressure relief 80–250 ms, emergency shutdown 150–500 ms, cooling 400–1500 ms,
  flow isolation 200–700 ms, alarm 800–3000 ms.
- **Redundancy:** field devices are dual-homed to a fast primary and a slower
  secondary parent with probability ≈0.6, reproducing standard ICS practice and
  creating the reroute opportunities the benchmark is designed to probe.
- **Pre-attack safety:** every loop's nominal latency is far inside its budget
  (max observed ratio 0.015), so the plant is unambiguously safe before the attack.

## 4. Labels and ground truth

For instances with ≤18 edges, an exhaustive oracle enumerates all cuts up to
size 3 and returns the true optimum. 427 instances carry a verified optimum.
The oracle's "infeasible" means *no safe cut of size ≤3*, not *no safe cut* —
a distinction the verification suite enforces explicitly.

## 5. Intended use and limits

**Use for:** evaluating safety-constrained isolation, response-latency studies,
ablations on timing constraints.

**Do not use for:** intrusion *detection* research (no packet payloads or
telemetry); claims about any specific vendor's equipment; absolute latency
prediction for a real plant (latencies are sampled, not measured on hardware).

**Known limitations, stated plainly:**
1. Topologies are synthetic. They follow published architectural patterns but are
   not traced from any real facility.
2. Latency is modelled as additive per-hop delay. Queuing, jitter and congestion
   are not simulated.
3. The oracle bound (k ≤ 3) limits exact ground truth to small instances.
4. Attack behaviour is reduced to (compromised node, lateral targets); multi-stage
   temporal dynamics are out of scope.

## 6. Files

| File | Rows | Description |
|---|---|---|
| `scenarios.jsonl(.gz)` | 6,000 | full scenario records |
| `results.csv` | 6,000 | all four methods' outcomes per scenario |
| `safety_loops.csv` | 23,183 | flattened SIF table |
| `edges.csv(.gz)` | 1,179,644 | flattened link table |
| `manifest.json` | — | schema, seeds, content hash |
| `VERIFICATION_REPORT.txt` | — | 34-check audit output |

## 7. Reproduction

```bash
python3 build.py      # regenerates the corpus; hash must match manifest.json
python3 verify.py     # 34 independent checks
python3 expfigs.py    # result figures
```

Regeneration is bit-for-bit deterministic from the recorded seeds; the suite
re-derives the corpus hash and fails if it differs.
