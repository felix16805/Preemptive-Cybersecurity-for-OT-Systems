"""Train Random Forest model for intrusion detection"""
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, confusion_matrix, classification_report
)
from pathlib import Path
import sys
import json

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.src.config import *

def load_processed_data():
    """Load preprocessed training data"""
    X_train = np.load(PROCESSED_DATA_DIR / "X_train.npy")
    y_train = np.load(PROCESSED_DATA_DIR / "y_train.npy")
    
    X_val = None
    y_val = None
    if (PROCESSED_DATA_DIR / "X_val.npy").exists():
        X_val = np.load(PROCESSED_DATA_DIR / "X_val.npy")
        y_val = np.load(PROCESSED_DATA_DIR / "y_val.npy")
    
    X_test = None
    y_test = None
    if (PROCESSED_DATA_DIR / "X_test.npy").exists():
        X_test = np.load(PROCESSED_DATA_DIR / "X_test.npy")
        y_test = np.load(PROCESSED_DATA_DIR / "y_test.npy")
    
    return X_train, y_train, X_val, y_val, X_test, y_test

def evaluate_model(model, X, y, set_name="test"):
    """Evaluate model and return metrics"""
    y_pred = model.predict(X)
    y_prob = model.predict_proba(X)[:, 1] if len(model.classes_) == 2 else None
    
    metrics = {
        "set": set_name,
        "accuracy": float(accuracy_score(y, y_pred)),
        "precision": float(precision_score(y, y_pred, average='weighted', zero_division=0)),
        "recall": float(recall_score(y, y_pred, average='weighted', zero_division=0)),
        "f1": float(f1_score(y, y_pred, average='weighted', zero_division=0)),
    }
    
    if y_prob is not None and len(np.unique(y)) == 2:
        try:
            metrics["roc_auc"] = float(roc_auc_score(y, y_prob))
        except:
            pass
    
    cm = confusion_matrix(y, y_pred)
    metrics["confusion_matrix"] = cm.tolist()
    
    # False negative rate (critical for security)
    if cm.shape == (2, 2):
        tn, fp, fn, tp = cm.ravel()
        metrics["false_negative_rate"] = float(fn / (fn + tp)) if (fn + tp) > 0 else 0.0
        metrics["false_positive_rate"] = float(fp / (fp + tn)) if (fp + tn) > 0 else 0.0
    
    return metrics, y_pred

def main():
    """Main training pipeline"""
    print("=" * 60)
    print("SafeCut ML Pipeline - Model Training")
    print("=" * 60)
    
    # Load data
    print("\nLoading processed data...")
    X_train, y_train, X_val, y_val, X_test, y_test = load_processed_data()
    
    print(f"Training samples: {X_train.shape[0]}")
    print(f"Features: {X_train.shape[1]}")
    
    # Train model
    print(f"\nTraining Random Forest ({N_ESTIMATORS} trees)...")
    model = RandomForestClassifier(
        n_estimators=N_ESTIMATORS,
        max_depth=MAX_DEPTH,
        min_samples_leaf=MIN_SAMPLES_LEAF,
        random_state=RANDOM_STATE,
        n_jobs=-1,
        class_weight='balanced',  # Handle imbalanced data
        verbose=1
    )
    
    model.fit(X_train, y_train)
    print("Training complete!")
    
    # Evaluate
    print("\n" + "=" * 60)
    print("Model Evaluation")
    print("=" * 60)
    
    all_metrics = {}
    
    train_metrics, _ = evaluate_model(model, X_train, y_train, "train")
    all_metrics["train"] = train_metrics
    
    if X_val is not None and len(X_val) > 0:
        val_metrics, _ = evaluate_model(model, X_val, y_val, "validation")
        all_metrics["validation"] = val_metrics
    
    if X_test is not None and len(X_test) > 0:
        test_metrics, y_test_pred = evaluate_model(model, X_test, y_test, "test")
        all_metrics["test"] = test_metrics
    
    # Print results
    for set_name, metrics in all_metrics.items():
        print(f"\n{set_name.upper()} Metrics:")
        print(f"  Accuracy:  {metrics['accuracy']:.4f}")
        print(f"  Precision: {metrics['precision']:.4f}")
        print(f"  Recall:    {metrics['recall']:.4f}")
        print(f"  F1 Score:  {metrics['f1']:.4f}")
        if 'roc_auc' in metrics:
            print(f"  ROC-AUC:   {metrics['roc_auc']:.4f}")
        if 'false_negative_rate' in metrics:
            print(f"  FNR:       {metrics['false_negative_rate']:.4f}")
            print(f"  FPR:       {metrics['false_positive_rate']:.4f}")
    
    # Feature importance
    feature_names = joblib.load(MODELS_DIR / "feature_names.joblib")
    importances = model.feature_importances_
    
    # Get top 20 features
    indices = np.argsort(importances)[::-1][:20]
    feature_importance = {
        "features": [],
        "importances": []
    }
    
    print("\nTop 20 Feature Importances:")
    for i, idx in enumerate(indices):
        if idx < len(feature_names):
            name = feature_names[idx]
            imp = importances[idx]
            feature_importance["features"].append(name)
            feature_importance["importances"].append(float(imp))
            print(f"  {i+1:2d}. {name}: {imp:.4f}")
    
    # Save model
    joblib.dump(model, MODEL_PATH)
    print(f"\nModel saved to {MODEL_PATH}")
    
    # Save metrics
    all_metrics["feature_importance"] = feature_importance
    all_metrics["model_version"] = MODEL_VERSION
    all_metrics["model_name"] = MODEL_NAME
    
    with open(REPORTS_DIR / "training_metrics.json", "w") as f:
        json.dump(all_metrics, f, indent=2)
    
    print(f"Metrics saved to {REPORTS_DIR / 'training_metrics.json'}")
    
    # Save classification report
    if X_test is not None:
        report = classification_report(y_test, y_test_pred, output_dict=True)
        with open(REPORTS_DIR / "classification_report.json", "w") as f:
            json.dump(report, f, indent=2)
    
    print("\nTraining pipeline complete!")

if __name__ == "__main__":
    main()