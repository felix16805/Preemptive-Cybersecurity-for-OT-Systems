"""Generate a reproducible synthetic OT cybersecurity dataset for coursework.

This generator creates simulated telemetry, not observations from a real plant.
The generated CSV intentionally has 15,000 labeled rows by default.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import pandas as pd

DEFAULT_ROWS = 15_000
DEFAULT_OUT = Path(__file__).resolve().parents[1] / "datasets" / "synthetic_ot" / "ot_cybersecurity_synthetic_15000.csv"


def generate(rows: int = DEFAULT_ROWS, seed: int = 20261020) -> pd.DataFrame:
    if rows < 10_000:
        raise ValueError("The assignment requirement is at least 10,000 rows. Choose --rows 10000 or higher.")
    rng = np.random.default_rng(seed)
    y = (rng.random(rows) < 0.32).astype(np.int8)
    attacks = np.array(["normal", "sensor_spoofing", "modbus_write_abuse", "network_dos", "process_manipulation"])
    attack_kind = np.full(rows, "normal", dtype=object)
    attack_idx = np.flatnonzero(y == 1)
    if len(attack_idx):
        attack_kind[attack_idx] = rng.choice(attacks[1:], size=len(attack_idx), p=[0.24, 0.28, 0.25, 0.23])

    # Baseline values approximate plausible OT telemetry; they are fully simulated.
    temperature = rng.normal(62.0, 2.8, rows)
    pressure = rng.normal(3.4, 0.24, rows)
    flow_rate = rng.normal(20.0, 2.8, rows)
    tank_level = rng.normal(55.0, 8.5, rows)
    coolant_flow = rng.normal(11.0, 1.3, rows)
    valve_position = rng.normal(55.0, 9.5, rows)
    pump_current = rng.normal(4.5, 0.55, rows)
    vibration = np.clip(rng.normal(0.12, 0.035, rows), 0.005, None)
    packet_rate = np.clip(rng.normal(45.0, 12.0, rows), 2.0, None)
    modbus_write_rate = rng.poisson(1.5, rows).astype(float)
    tcp_syn_rate = rng.poisson(4.0, rows).astype(float)
    response_latency_ms = np.clip(rng.lognormal(np.log(18), 0.35, rows), 3.0, None)
    failed_login_count = rng.poisson(0.08, rows).astype(float)
    sensor_disagreement = np.abs(rng.normal(0.8, 0.45, rows))
    read_write_ratio = np.clip(rng.normal(8.0, 2.4, rows), 0.2, None)

    protocol = rng.choice(["ModbusTCP", "OPCUA", "EtherNetIP"], rows, p=[0.58, 0.27, 0.15]).astype(object)
    function_code = rng.choice(["ReadHolding", "ReadInput", "WriteSingle", "WriteMultiple"], rows, p=[0.47, 0.27, 0.18, 0.08]).astype(object)
    source_zone = rng.choice(["ControlLAN", "Historian", "EngineeringStation", "ExternalGateway"], rows, p=[0.61, 0.18, 0.17, 0.04]).astype(object)
    operating_mode = rng.choice(["steady", "startup", "maintenance"], rows, p=[0.82, 0.11, 0.07]).astype(object)

    # Attack families alter different groups of features, with overlap/noise kept
    # intentionally so the classification task is not a perfect rule lookup.
    for kind in attacks[1:]:
        idx = np.flatnonzero(attack_kind == kind)
        n = len(idx)
        if not n:
            continue
        if kind == "sensor_spoofing":
            temperature[idx] += rng.choice([-1, 1], n) * rng.normal(7.0, 3.0, n)
            pressure[idx] += rng.choice([-1, 1], n) * rng.normal(0.45, 0.2, n)
            sensor_disagreement[idx] += rng.gamma(2.0, 0.8, n)
            # Some attacks alter sensor values only mildly.
            mild = idx[rng.random(n) < 0.22]
            temperature[mild] = temperature[mild] * 0.6 + 62.0 * 0.4
        elif kind == "modbus_write_abuse":
            modbus_write_rate[idx] += rng.integers(8, 38, n)
            packet_rate[idx] += rng.normal(34, 18, n)
            read_write_ratio[idx] = np.clip(read_write_ratio[idx] * rng.uniform(0.08, 0.45, n), 0.1, None)
            function_code[idx] = rng.choice(["WriteSingle", "WriteMultiple", "ReadHolding"], n, p=[0.48, 0.46, 0.06])
            source_zone[idx] = rng.choice(["EngineeringStation", "ExternalGateway", "ControlLAN"], n, p=[0.54, 0.25, 0.21])
        elif kind == "network_dos":
            packet_rate[idx] += rng.gamma(4.0, 38.0, n)
            tcp_syn_rate[idx] += rng.integers(25, 150, n)
            response_latency_ms[idx] += rng.gamma(3.2, 55.0, n)
            source_zone[idx] = rng.choice(["ExternalGateway", "EngineeringStation", "ControlLAN"], n, p=[0.65, 0.25, 0.10])
        elif kind == "process_manipulation":
            valve_position[idx] += rng.choice([-1, 1], n) * rng.normal(18.0, 8.0, n)
            coolant_flow[idx] += rng.choice([-1, 1], n) * rng.normal(2.8, 1.1, n)
            flow_rate[idx] += rng.choice([-1, 1], n) * rng.normal(5.0, 2.0, n)
            pump_current[idx] += rng.normal(0.8, 0.5, n)
            vibration[idx] += rng.gamma(2.0, 0.035, n)

    # Clip only physically nonsensical values; do not remove normal/attack overlap.
    df = pd.DataFrame({
        "temperature_c": np.clip(temperature, 5, 130).round(4),
        "pressure_bar": np.clip(pressure, 0.1, 12).round(4),
        "flow_rate_lpm": np.clip(flow_rate, 0.1, 100).round(4),
        "tank_level_pct": np.clip(tank_level, 0, 100).round(4),
        "coolant_flow_lpm": np.clip(coolant_flow, 0.1, 40).round(4),
        "valve_position_pct": np.clip(valve_position, 0, 100).round(4),
        "pump_current_a": np.clip(pump_current, 0.1, 20).round(4),
        "vibration_mm_s": np.clip(vibration, 0.001, 5).round(4),
        "packet_rate_per_s": np.clip(packet_rate, 1, 1200).round(4),
        "modbus_write_rate_per_s": np.clip(modbus_write_rate, 0, 200).round(4),
        "tcp_syn_rate_per_s": np.clip(tcp_syn_rate, 0, 1000).round(4),
        "response_latency_ms": np.clip(response_latency_ms, 1, 5000).round(4),
        "failed_login_count_5m": np.clip(failed_login_count, 0, 100).round(4),
        "sensor_disagreement_score": np.clip(sensor_disagreement, 0, 20).round(4),
        "read_write_ratio": np.clip(read_write_ratio, 0.01, 100).round(4),
        "protocol": protocol,
        "function_code": function_code,
        "source_zone": source_zone,
        "operating_mode": operating_mode,
        # Kept as documentation/analysis metadata; train.py drops alternate label columns.
        "attack_type": attack_kind,
        "label": y,
    })
    return df


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--rows", type=int, default=DEFAULT_ROWS, help="Number of generated rows; minimum 10000")
    parser.add_argument("--seed", type=int, default=20261020, help="Reproducible random seed")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUT, help="Output CSV path")
    args = parser.parse_args()
    try:
        data = generate(args.rows, args.seed)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        data.to_csv(args.output, index=False)
        metadata = {
            "dataset_name": "SafeCut Synthetic OT Cybersecurity Dataset",
            "rows": int(len(data)),
            "columns": int(len(data.columns)),
            "seed": args.seed,
            "label_column": "label",
            "label_semantics": {"0": "normal/simulated benign", "1": "simulated attack"},
            "class_counts": {"normal": int((data.label == 0).sum()), "attack": int((data.label == 1).sum())},
            "attack_families": {str(k): int(v) for k, v in data.loc[data.label == 1, "attack_type"].value_counts().items()},
            "data_origin": "synthetic; generated from seeded statistical distributions and simulated attack perturbations; not captured from a real OT plant",
            "limitations": [
                "Distribution assumptions are authored for this project and may not represent actual industrial systems.",
                "Test metrics measure generalization within this synthetic generator only.",
                "Do not interpret the results as real-world operational detection performance or connect the model to automated isolation without separate validation.",
            ],
        }
        metadata_path = args.output.with_suffix(".metadata.json")
        metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")
        print(f"Generated {len(data):,} rows x {len(data.columns)} columns: {args.output}")
        print("Class counts:", metadata["class_counts"])
        print("Attack families:", metadata["attack_families"])
        print(f"Metadata: {metadata_path}")
        print("NOTICE: This is synthetic coursework data, not real-world telemetry.")
        return 0
    except Exception as exc:
        parser.exit(1, f"[error] {exc}\n")


if __name__ == "__main__":
    raise SystemExit(main())
