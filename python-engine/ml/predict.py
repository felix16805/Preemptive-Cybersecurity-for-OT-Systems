"""Run inference with SafeCut's saved ML model on a CSV or JSON feature file.

Example from python-engine:
  py -m ml.predict --input datasets/synthetic_ot/ot_cybersecurity_synthetic_15000.csv --limit 5

Input data must contain the same feature columns used in training. Label/attack_type
columns are ignored; they are never passed to the classifier.
"""
from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

import joblib
import pandas as pd

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_MODEL = ROOT / "python-engine" / "artifacts" / "ml" / "best_model.joblib"
DEFAULT_METADATA = ROOT / "python-engine" / "artifacts" / "ml" / "metadata.json"


def read_rows(path: Path) -> pd.DataFrame:
    if not path.is_file():
        raise FileNotFoundError(f"Input file does not exist: {path}")
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return pd.read_csv(path, low_memory=False)
    if suffix == ".json":
        value: Any = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(value, dict):
            value = [value]
        if not isinstance(value, list) or not all(isinstance(row, dict) for row in value):
            raise ValueError("JSON input must be an object or a list of row objects.")
        return pd.DataFrame(value)
    raise ValueError("Input file must be .csv or .json")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True, help="CSV or JSON containing model feature columns")
    parser.add_argument("--model", type=Path, default=DEFAULT_MODEL)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--limit", type=int, default=20, help="Predict at most this many rows; use 0 for all rows")
    args = parser.parse_args()
    try:
        if not args.model.is_file():
            raise FileNotFoundError(f"Model artifact not found: {args.model}. Run ml.train first.")
        if not args.metadata.is_file():
            raise FileNotFoundError(f"Training metadata not found: {args.metadata}. Run ml.train first.")
        metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
        feature_names = metadata.get("input_features")
        if not isinstance(feature_names, list) or not feature_names:
            raise ValueError("Metadata does not contain a usable input_features list.")
        rows = read_rows(args.input)
        if args.limit < 0:
            raise ValueError("--limit must be zero (all rows) or a positive integer")
        if args.limit > 0:
            rows = rows.head(args.limit)
        missing = [name for name in feature_names if name not in rows.columns]
        if missing:
            raise ValueError(f"Input is missing {len(missing)} trained feature(s): {missing}")
        X = rows.loc[:, feature_names].copy()
        model = joblib.load(args.model)
        start = time.perf_counter()
        pred = model.predict(X)
        elapsed_ms = (time.perf_counter() - start) * 1000
        if hasattr(model, "predict_proba"):
            probabilities = model.predict_proba(X)[:, 1].tolist()
        else:
            probabilities = [None] * len(pred)
        outputs = []
        for index, (label, probability) in enumerate(zip(pred.tolist(), probabilities)):
            outputs.append({
                "row": index,
                "prediction": "attack" if int(label) == 1 else "normal",
                "predicted_label": int(label),
                "attack_probability": None if probability is None else round(float(probability), 6),
            })
        result = {
            "status": "ok",
            "model": metadata.get("best_model", "unknown"),
            "dataset_training_origin": metadata.get("data_origin", "unknown"),
            "is_synthetic_training": bool(metadata.get("is_synthetic", False)),
            "rows_predicted": len(outputs),
            "total_inference_ms": round(elapsed_ms, 4),
            "inference_ms_per_row": round(elapsed_ms / max(len(outputs), 1), 6),
            "warning": "These predictions inherit the training dataset's limitations. Synthetic-data predictions are not real-world validation and must not trigger automatic isolation.",
            "predictions": outputs,
        }
        print(json.dumps(result, indent=2))
        return 0
    except Exception as exc:
        print(f"[error] {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
