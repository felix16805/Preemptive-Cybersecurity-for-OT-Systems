"""Train and evaluate benchmark ML classifiers on SWaT or TON_IoT data.

Example (PowerShell from the python-engine directory):
  py -m pip install -r requirements.txt
  py -m ml.train --dataset ton_iot --data "datasets/ton_iot/train_test_network.csv"

Raw benchmark data is intentionally not bundled.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import sklearn
from sklearn.compose import ColumnTransformer
from sklearn.base import clone
from sklearn.ensemble import ExtraTreesClassifier, RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    average_precision_score,
    classification_report,
    confusion_matrix,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.tree import DecisionTreeClassifier
from sklearn.svm import LinearSVC

ROOT = Path(__file__).resolve().parents[2]
ARTIFACT_DIR = ROOT / "python-engine" / "artifacts" / "ml"
REPORT_DIR = ROOT / "python-engine" / "reports" / "ml-results"
PUBLIC_DIR = ROOT / "public" / "ml-results"
SUPPORTED = {".csv", ".xlsx", ".xls", ".parquet"}
LABEL_CANDIDATES = [
    "label", "normal/attack", "normal_attack", "attack", "is_attack",
    "class", "target", "type", "attack_type", "attack type", "category",
]
LABEL_COLUMN_NAMES = {
    "label", "normal/attack", "normal_attack", "attack", "is_attack",
    "class", "target", "type", "attack_type", "attack type", "category",
    "attackname", "attack_name", "attack name", "binary_label",
}


def _normalized_name(value: Any) -> str:
    return str(value).strip().lower().replace("\\", "/")


def detect_target_column(columns: list[Any], requested: str = "auto") -> str:
    if requested and requested.lower() != "auto":
        exact = [c for c in columns if str(c).strip().lower() == requested.strip().lower()]
        if not exact:
            raise ValueError(f"Target column {requested!r} not found. Available columns: {list(map(str, columns))}")
        return str(exact[0])
    by_name = {_normalized_name(c): str(c) for c in columns}
    for wanted in LABEL_CANDIDATES:
        if wanted in by_name:
            return by_name[wanted]
    raise ValueError(
        "Could not identify the label column automatically. Supply --target-col. "
        f"Available columns: {list(map(str, columns))}"
    )


def normalize_binary_labels(values: pd.Series) -> pd.Series:
    """Map benchmark labels to 0=normal and 1=attack without using features."""
    if pd.api.types.is_bool_dtype(values.dtype):
        return values.astype("float64").where(values.notna(), np.nan)
    numeric = pd.to_numeric(values, errors="coerce")
    non_null = values.notna()
    if non_null.any() and numeric[non_null].notna().all():
        unique_values = set(numeric[non_null].unique().tolist())
        if unique_values.issubset({0, 1, 0.0, 1.0}):
            return numeric.where(values.notna(), np.nan).astype("float64")
        # Other numeric label schemes: explicitly treat the lowest value as normal.
        lowest = min(unique_values)
        return (numeric != lowest).where(values.notna(), np.nan).astype("float64")

    def convert(value: Any) -> float:
        if pd.isna(value):
            return np.nan
        text = str(value).strip().lower().replace("_", " ").replace("-", " ")
        if text in {"0", "false", "normal", "benign", "legitimate", "clean", "safe", "no attack", "non attack", "nonattack"}:
            return 0
        if any(token in text for token in ("normal", "benign", "legitimate", "clean", "no attack", "non attack", "nonattack")):
            return 0
        return 1

    return values.map(convert).astype("float64")


def _read_data(path: Path, max_rows: int, target_request: str) -> tuple[pd.DataFrame, str, dict[str, int]]:
    if not path.exists():
        raise FileNotFoundError(
            f"Dataset file not found: {path}\nDownload/request the dataset and pass the path with --data. "
            "Raw SWaT and TON_IoT data are not included in this project ZIP."
        )
    if path.suffix.lower() not in SUPPORTED:
        raise ValueError(f"Unsupported file type {path.suffix!r}. Use CSV, XLSX/XLS, or Parquet.")

    if path.suffix.lower() == ".csv" and max_rows > 0:
        headers = list(pd.read_csv(path, nrows=0).columns)
        target = detect_target_column(headers, target_request)
        counts: Counter[int] = Counter()
        # First pass counts labels, avoiding loading a multi-GB CSV into memory.
        for chunk in pd.read_csv(path, chunksize=100_000, low_memory=False):
            labels = normalize_binary_labels(chunk[target]).dropna().astype(int)
            counts.update(labels.tolist())
        if len(counts) < 2:
            raise ValueError(f"The selected target column {target!r} must contain both normal and attack rows; counts={dict(counts)}")
        target_size = min(max_rows, sum(counts.values()))
        ordered = sorted(counts)
        quotas = {c: max(1, int(math.floor(target_size * counts[c] / sum(counts.values())))) for c in ordered}
        # Correct rounding while keeping the sampled set at target_size.
        while sum(quotas.values()) > target_size:
            options = [c for c in ordered if quotas[c] > 1]
            if not options:
                break
            quotas[max(options, key=lambda c: quotas[c] - target_size * counts[c] / sum(counts.values()))] -= 1
        while sum(quotas.values()) < target_size:
            c = max(ordered, key=lambda x: target_size * counts[x] / sum(counts.values()) - quotas[x])
            if quotas[c] >= counts[c]:
                break
            quotas[c] += 1
        rng = np.random.default_rng(42)
        reservoirs: dict[int, pd.DataFrame] = {c: pd.DataFrame() for c in ordered}
        scores: dict[int, np.ndarray] = {c: np.empty(0, dtype=float) for c in ordered}
        for chunk in pd.read_csv(path, chunksize=100_000, low_memory=False):
            binary = normalize_binary_labels(chunk[target])
            for cls in ordered:
                subset = chunk.loc[binary == cls]
                if subset.empty:
                    continue
                new_scores = rng.random(len(subset))
                candidate = pd.concat([reservoirs[cls], subset], axis=0, ignore_index=True)
                candidate_scores = np.concatenate([scores[cls], new_scores])
                keep_n = min(quotas[cls], len(candidate))
                keep_idx = np.argpartition(candidate_scores, keep_n - 1)[:keep_n]
                reservoirs[cls] = candidate.iloc[keep_idx].reset_index(drop=True)
                scores[cls] = candidate_scores[keep_idx]
        data = pd.concat([reservoirs[c] for c in ordered], ignore_index=True)
        class_counts = {"normal": int(quotas.get(0, 0)), "attack": int(quotas.get(1, 0))}
        # This branch used stratified uniform sampling from the full CSV.
        return data, target, class_counts

    if path.suffix.lower() == ".csv":
        data = pd.read_csv(path, low_memory=False)
    elif path.suffix.lower() in {".xlsx", ".xls"}:
        data = pd.read_excel(path)
    else:
        data = pd.read_parquet(path)
    target = detect_target_column(list(data.columns), target_request)
    raw_y = normalize_binary_labels(data[target])
    valid = raw_y.notna()
    data = data.loc[valid].copy()
    raw_y = raw_y.loc[valid]
    if max_rows > 0 and len(data) > max_rows:
        tagged = data.copy()
        tagged["__safecut_binary_target__"] = raw_y.astype(int).to_numpy()
        chosen = []
        for _, group in tagged.groupby("__safecut_binary_target__", sort=True):
            quota = min(len(group), max(1, int(round(max_rows * len(group) / len(tagged)))))
            chosen.append(group.sample(n=quota, random_state=42))
        data = pd.concat(chosen, ignore_index=True)
        # Correct any rounding difference with a stable random sample.
        if len(data) > max_rows:
            data = data.sample(n=max_rows, random_state=42, ignore_index=True)
        data = data.drop(columns=["__safecut_binary_target__"])
    sampled_y = normalize_binary_labels(data[target])
    class_counts = {"normal": int((sampled_y == 0).sum()), "attack": int((sampled_y == 1).sum())}
    return data.reset_index(drop=True), target, class_counts


def _build_preprocessor(X: pd.DataFrame) -> tuple[ColumnTransformer, list[str], list[str]]:
    # Drop timestamp, row IDs, raw network addresses, and all alternate label columns.
    excluded: set[str] = set()
    for col in X.columns:
        name = _normalized_name(col)
        compact = name.replace(" ", "").replace("_", "")
        if name.startswith("unnamed:") or compact in {"id", "flowid", "rowid", "index", "timestamp", "datetime", "date", "time", "ts"}:
            excluded.add(col)
            continue
        if any(token in compact for token in ("srcip", "dstip", "sourceip", "destinationip", "macaddress")):
            excluded.add(col)
            continue
        # Never pass an alternate ground-truth label into the model.
        if name in LABEL_COLUMN_NAMES:
            excluded.add(col)
    X = X.drop(columns=[c for c in excluded if c in X.columns], errors="ignore")
    X = X.replace([np.inf, -np.inf], np.nan)
    all_missing = [c for c in X.columns if X[c].isna().all()]
    X = X.drop(columns=all_missing, errors="ignore")
    constant = [c for c in X.columns if X[c].nunique(dropna=True) <= 1]
    X = X.drop(columns=constant, errors="ignore")
    if X.empty:
        raise ValueError("No usable feature columns remain after excluding labels, identifiers, timestamps and constant fields.")
    numeric_cols = X.select_dtypes(include=[np.number, "bool"]).columns.astype(str).tolist()
    categorical_cols = [str(c) for c in X.columns if str(c) not in set(numeric_cols)]
    transformers = []
    if numeric_cols:
        numeric_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
        ])
        transformers.append(("numeric", numeric_pipe, numeric_cols))
    if categorical_cols:
        categorical_pipe = Pipeline([
            ("imputer", SimpleImputer(strategy="most_frequent")),
            ("onehot", OneHotEncoder(handle_unknown="ignore", min_frequency=5)),
        ])
        transformers.append(("categorical", categorical_pipe, categorical_cols))
    return ColumnTransformer(transformers=transformers, remainder="drop", sparse_threshold=0.3), list(X.columns.astype(str)), numeric_cols + categorical_cols


def _model_specs() -> dict[str, Any]:
    return {
        "Logistic Regression": LogisticRegression(max_iter=1200, class_weight="balanced", solver="liblinear"),
        "Decision Tree": DecisionTreeClassifier(max_depth=24, min_samples_leaf=2, class_weight="balanced", random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, class_weight="balanced_subsample", n_jobs=-1, random_state=42, min_samples_leaf=1),
        "Extra Trees": ExtraTreesClassifier(n_estimators=100, class_weight="balanced", n_jobs=-1, random_state=42, min_samples_leaf=1),
        "Linear SVM": LinearSVC(class_weight="balanced", random_state=42, max_iter=5000),
    }


def _auc_scores(model: Pipeline, X: pd.DataFrame, y: pd.Series) -> tuple[float | None, float | None]:
    if y.nunique() != 2:
        return None, None
    try:
        if hasattr(model, "predict_proba"):
            scores = model.predict_proba(X)[:, 1]
        elif hasattr(model, "decision_function"):
            scores = model.decision_function(X)
        else:
            return None, None
        return float(roc_auc_score(y, scores)), float(average_precision_score(y, scores))
    except (ValueError, AttributeError):
        return None, None


def _measure(model: Pipeline, X: pd.DataFrame, y: pd.Series) -> dict[str, Any]:
    start = time.perf_counter()
    prediction = model.predict(X)
    duration = time.perf_counter() - start
    cm = confusion_matrix(y, prediction, labels=[0, 1])
    tn, fp, fn, tp = [int(v) for v in cm.ravel()]
    roc_auc, pr_auc = _auc_scores(model, X, y)
    report = classification_report(y, prediction, labels=[0, 1], target_names=["normal", "attack"], output_dict=True, zero_division=0)
    return {
        "accuracy": float(accuracy_score(y, prediction)),
        "precision": float(precision_score(y, prediction, pos_label=1, zero_division=0)),
        "recall": float(recall_score(y, prediction, pos_label=1, zero_division=0)),
        "f1": float(f1_score(y, prediction, pos_label=1, zero_division=0)),
        "macro_f1": float(f1_score(y, prediction, average="macro", zero_division=0)),
        "weighted_f1": float(f1_score(y, prediction, average="weighted", zero_division=0)),
        "false_positive_rate": float(fp / (fp + tn)) if fp + tn else 0.0,
        "false_negative_rate": float(fn / (fn + tp)) if fn + tp else 0.0,
        "roc_auc": roc_auc,
        "pr_auc": pr_auc,
        "confusion_matrix": [[tn, fp], [fn, tp]],
        "classification_report": report,
        "samples_tested": int(len(y)),
        "inference_ms_per_sample": float((duration / max(len(y), 1)) * 1000),
        "predictions_correct": int((prediction == y.to_numpy()).sum()),
    }


def _safe_json(data: Any) -> Any:
    if isinstance(data, dict):
        return {str(k): _safe_json(v) for k, v in data.items()}
    if isinstance(data, (list, tuple)):
        return [_safe_json(v) for v in data]
    if isinstance(data, (np.integer,)):
        return int(data)
    if isinstance(data, (np.floating, float)):
        return float(data) if math.isfinite(float(data)) else None
    if isinstance(data, (np.bool_, bool)):
        return bool(data)
    if pd.isna(data) if not isinstance(data, (list, dict, tuple)) else False:
        return None
    return data


def _write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(_safe_json(value), indent=2, allow_nan=False), encoding="utf-8")


def _save_plots(results: dict[str, dict[str, Any]], best_name: str) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    names = list(results)
    for metric, title in [("accuracy", "Accuracy"), ("precision", "Attack Precision"), ("recall", "Attack Recall"), ("f1", "Attack F1-score"), ("macro_f1", "Macro F1-score")]:
        fig, ax = plt.subplots(figsize=(9, 4.8))
        vals = [results[name]["test"][metric] for name in names]
        bars = ax.bar(names, vals)
        ax.set_ylim(0, 1)
        ax.set_ylabel("Score (0–1)")
        ax.set_title(f"{title} — held-out test set")
        ax.tick_params(axis="x", rotation=18)
        ax.grid(axis="y", alpha=0.25)
        for bar, value in zip(bars, vals):
            ax.text(bar.get_x() + bar.get_width() / 2, min(value + 0.015, 0.98), f"{value:.3f}", ha="center", va="bottom", fontsize=8)
        fig.tight_layout()
        slug = metric.replace("_", "-")
        for outdir in (REPORT_DIR, PUBLIC_DIR):
            fig.savefig(outdir / f"{slug}.png", dpi=150, bbox_inches="tight")
        plt.close(fig)
    for name, item in results.items():
        matrix = np.array(item["test"]["confusion_matrix"])
        fig, ax = plt.subplots(figsize=(4.5, 4))
        image = ax.imshow(matrix, cmap="Blues")
        ax.set_xticks([0, 1], labels=["Normal", "Attack"])
        ax.set_yticks([0, 1], labels=["Normal", "Attack"])
        ax.set_xlabel("Predicted label")
        ax.set_ylabel("True label")
        ax.set_title(f"{name} confusion matrix")
        for (row, col), value in np.ndenumerate(matrix):
            ax.text(col, row, str(value), ha="center", va="center", color="black")
        fig.colorbar(image, ax=ax, fraction=0.046, pad=0.04)
        fig.tight_layout()
        filename = "confusion-" + name.lower().replace(" ", "-") + ".png"
        for outdir in (REPORT_DIR, PUBLIC_DIR):
            fig.savefig(outdir / filename, dpi=140, bbox_inches="tight")
        plt.close(fig)


def train(dataset: str, data_path: Path, target_request: str, max_rows: int) -> dict[str, Any]:
    data, target_col, sampled_counts = _read_data(data_path, max_rows, target_request)
    raw_y = normalize_binary_labels(data[target_col])
    valid = raw_y.notna()
    data = data.loc[valid].reset_index(drop=True)
    y = raw_y.loc[valid].astype(int).reset_index(drop=True)
    counts = {"normal": int((y == 0).sum()), "attack": int((y == 1).sum())}
    if y.nunique() != 2:
        raise ValueError(f"Binary training requires both normal and attack rows. Actual counts: {counts}. Check --target-col.")
    if min(counts.values()) < 5:
        raise ValueError(f"Each class needs at least 5 rows for a train/validation/test evaluation. Actual counts: {counts}")

    # Exclude every target-like field except the selected target itself. The target is removed from X below.
    raw_X = data.drop(columns=[target_col])
    preprocessor, feature_names, ordered_columns = _build_preprocessor(raw_X)
    X = raw_X[feature_names].copy()
    X = X.replace([np.inf, -np.inf], np.nan)
    # Consistent split: 70% train, 15% validation, 15% final held-out test.
    try:
        X_train_val, X_test, y_train_val, y_test = train_test_split(
            X, y, test_size=0.15, random_state=42, stratify=y
        )
        X_train, X_val, y_train, y_val = train_test_split(
            X_train_val, y_train_val, test_size=0.1764705882, random_state=42, stratify=y_train_val
        )
    except ValueError as exc:
        raise ValueError(f"Cannot create stratified 70/15/15 split. Check class counts: {counts}. Details: {exc}") from exc

    results: dict[str, dict[str, Any]] = {}
    specs = _model_specs()
    for name, classifier in specs.items():
        print(f"[train] {name} ...", flush=True)
        start = time.perf_counter()
        candidate = Pipeline([("preprocessor", clone(preprocessor)), ("classifier", clone(classifier))])
        candidate.fit(X_train, y_train)
        training_seconds = time.perf_counter() - start
        val_metrics = _measure(candidate, X_val, y_val)
        results[name] = {"validation": val_metrics, "training_seconds": float(training_seconds)}
        print(f"        validation accuracy={val_metrics['accuracy']:.4f} macro-F1={val_metrics['macro_f1']:.4f}", flush=True)

    # Model selection occurs on validation macro-F1; test data is only used once after selection.
    best_name = max(results, key=lambda model_name: results[model_name]["validation"]["macro_f1"])
    best_classifier = specs[best_name]
    best_model = Pipeline([("preprocessor", clone(preprocessor)), ("classifier", clone(best_classifier))])
    start = time.perf_counter()
    best_model.fit(X_train_val, y_train_val)
    refit_seconds = time.perf_counter() - start
    test_metrics = _measure(best_model, X_test, y_test)
    results[best_name]["test"] = test_metrics
    # Evaluate all candidates on the final test set after model selection has been completed.
    # This produces the comparison table, but selection above remains validation-only.
    for name, classifier in specs.items():
        if name == best_name:
            continue
        model = Pipeline([("preprocessor", clone(preprocessor)), ("classifier", clone(classifier))])
        model.fit(X_train_val, y_train_val)
        results[name]["test"] = _measure(model, X_test, y_test)

    ARTIFACT_DIR.mkdir(parents=True, exist_ok=True)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)
    model_path = ARTIFACT_DIR / "best_model.joblib"
    joblib.dump(best_model, model_path)
    metadata = {
        "dataset": dataset,
        "source_file_name": data_path.name,
        "target_column": target_col,
        "target_semantics": "binary: normal=0, attack=1",
        "best_model": best_name,
        "input_features": feature_names,
        "numeric_features": [str(c) for c in X.select_dtypes(include=[np.number, "bool"]).columns],
        "label_counts_after_sampling": counts,
        "sampled_rows": int(len(data)),
        "split_rows": {"train": int(len(X_train)), "validation": int(len(X_val)), "test": int(len(X_test))},
        "sklearn_version": sklearn.__version__,
        "pandas_version": pd.__version__,
        "numpy_version": np.__version__,
        "trained_at_utc": datetime.now(timezone.utc).isoformat(),
        "selection_metric": "validation macro-F1",
        "best_model_refit_seconds": float(refit_seconds),
        "max_rows_setting": int(max_rows),
        "raw_dataset_included_in_project": dataset == "synthetic_ot",
        "data_origin": "synthetic generated coursework dataset" if dataset == "synthetic_ot" else "user-provided benchmark dataset",
        "is_synthetic": dataset == "synthetic_ot",
        "warnings": ([
            "This dataset is synthetic and generated by SafeCut's seeded statistical simulator; it is not captured from a real OT plant.",
            "Metrics measure performance on synthetic data generated from the same authored distributions and do not establish real-world attack detection performance.",
        ] if dataset == "synthetic_ot" else []) + [
            "These are offline dataset metrics, not a claim of production deployment performance.",
            "For final research reporting, prefer an attack-scenario or time-held-out split where the dataset metadata supports it; adjacent time-series rows can make random row splits optimistic.",
            "The selected benchmark's input features do not automatically match the live CSTR/Modbus simulator feature schema. Live inference must not be enabled without a validated adapter and matching features.",
        ],
    }
    summary = {
        "status": "trained",
        "dataset": dataset,
        "source_file_name": data_path.name,
        "target_column": target_col,
        "label_counts": counts,
        "rows_used": int(len(data)),
        "feature_count": len(feature_names),
        "features": feature_names,
        "split_rows": metadata["split_rows"],
        "best_model": best_name,
        "selection_metric": "validation macro-F1",
        "models": results,
        "metadata": metadata,
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "artifacts": {"best_model": "python-engine/artifacts/ml/best_model.joblib", "metadata": "python-engine/artifacts/ml/metadata.json"},
        "charts": {
            "accuracy": "/ml-results/accuracy.png",
            "precision": "/ml-results/precision.png",
            "recall": "/ml-results/recall.png",
            "f1": "/ml-results/f1.png",
            "macro_f1": "/ml-results/macro-f1.png",
        },
        "is_smoke_test": False,
        "is_synthetic": dataset == "synthetic_ot",
        "data_origin": "synthetic generated coursework dataset" if dataset == "synthetic_ot" else "user-provided benchmark dataset",
        "data_notice": "SYNTHETIC COURSEWORK DATA — metrics are not real-world validation." if dataset == "synthetic_ot" else "Offline benchmark metrics; not production validation.",
    }
    _write_json(ARTIFACT_DIR / "metadata.json", metadata)
    _write_json(REPORT_DIR / "summary.json", summary)
    _write_json(REPORT_DIR / "model_comparison.json", {
        "dataset": dataset,
        "best_model": best_name,
        "models": {name: {"validation": item["validation"], "test": item["test"], "training_seconds": item["training_seconds"]} for name, item in results.items()},
    })
    comparison_rows = []
    for name, item in results.items():
        row = {"model": name, "validation_accuracy": item["validation"]["accuracy"], "validation_macro_f1": item["validation"]["macro_f1"], "test_accuracy": item["test"]["accuracy"], "test_precision": item["test"]["precision"], "test_recall": item["test"]["recall"], "test_f1": item["test"]["f1"], "test_macro_f1": item["test"]["macro_f1"], "test_weighted_f1": item["test"]["weighted_f1"], "test_false_positive_rate": item["test"]["false_positive_rate"], "test_false_negative_rate": item["test"]["false_negative_rate"], "test_roc_auc": item["test"]["roc_auc"], "test_pr_auc": item["test"]["pr_auc"], "train_seconds": item["training_seconds"], "inference_ms_per_sample": item["test"]["inference_ms_per_sample"]}
        comparison_rows.append(row)
    pd.DataFrame(comparison_rows).sort_values("test_macro_f1", ascending=False).to_csv(REPORT_DIR / "model_comparison.csv", index=False)
    _save_plots(results, best_name)
    # Publish only generated evaluation results for the Next.js results page.
    _write_json(PUBLIC_DIR / "summary.json", summary)
    print("\n[done] Held-out test results:")
    print(pd.DataFrame(comparison_rows)[["model", "test_accuracy", "test_precision", "test_recall", "test_f1", "test_macro_f1", "test_false_positive_rate", "inference_ms_per_sample"]].to_string(index=False))
    print(f"\nBest validation model: {best_name}")
    print(f"Model artifact: {model_path}")
    print(f"Results page data: {PUBLIC_DIR / 'summary.json'}")
    print(f"Reports: {REPORT_DIR}")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Train and compare SafeCut's OT cybersecurity benchmark models.")
    parser.add_argument("--dataset", choices=["swat", "ton_iot", "custom", "synthetic_ot"], required=True, help="Dataset family; synthetic_ot identifies generated coursework data.")
    parser.add_argument("--data", required=True, help="Path to one CSV/XLSX/XLS/Parquet dataset file.")
    parser.add_argument("--target-col", default="auto", help="Label column name; default auto-detects common label names.")
    parser.add_argument("--max-rows", type=int, default=200_000, help="Deterministically sample up to this many rows stratified by normal/attack labels; use 0 for all rows.")
    args = parser.parse_args()
    if args.max_rows < 0:
        parser.error("--max-rows must be zero (all rows) or a positive integer")
    try:
        train(args.dataset, Path(args.data).expanduser().resolve(), args.target_col, args.max_rows)
        return 0
    except Exception as exc:
        print(f"[error] {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
