"""Evaluate trained model with detailed metrics"""
import numpy as np
import joblib
import json
from pathlib import Path
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.src.config import *
from ml.src.train import evaluate_model

def main():
    print("=" * 60)
    print("SafeCut ML Pipeline - Model Evaluation")
    print("=" * 60)
    
    # Load model
    model = joblib.load(MODEL_PATH)
    print(f"Loaded model: {MODEL_PATH}")
    
    # Load test data
    X_test = np.load(PROCESSED_DATA_DIR / "X_test.npy")
    y_test = np.load(PROCESSED_DATA_DIR / "y_test.npy")
    
    # Evaluate
    metrics, y_pred = evaluate_model(model, X_test, y_test, "test")
    
    print("\nTest Set Metrics:")
    print(f"  Accuracy:  {metrics['accuracy']:.4f}")
    print(f"  Precision: {metrics['precision']:.4f}")
    print(f"  Recall:    {metrics['recall']:.4f}")
    print(f"  F1 Score:  {metrics['f1']:.4f}")
    if 'roc_auc' in metrics:
        print(f"  ROC-AUC:   {metrics['roc_auc']:.4f}")
    if 'false_negative_rate' in metrics:
        print(f"  False Negative Rate: {metrics['false_negative_rate']:.4f}")
        print(f"  False Positive Rate: {metrics['false_positive_rate']:.4f}")
    
    print(f"\nConfusion Matrix:\n{np.array(metrics['confusion_matrix'])}")
    
    # Save evaluation report
    report = {
        "model_version": MODEL_VERSION,
        "model_name": MODEL_NAME,
        "test_metrics": metrics,
        "dataset": DATASET_NAME
    }
    
    with open(REPORTS_DIR / "evaluation_report.json", "w") as f:
        json.dump(report, f, indent=2)
    
    print(f"\nEvaluation report saved to {REPORTS_DIR / 'evaluation_report.json'}")

if __name__ == "__main__":
    main()