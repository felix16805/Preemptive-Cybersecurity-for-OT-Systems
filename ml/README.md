# SafeCut ML Pipeline

Machine Learning intrusion detection pipeline for OT/IoT cybersecurity.

## Overview

This pipeline implements a complete ML workflow for detecting cyberattacks in OT/IoT environments:

```
ToN_IoT Dataset
      │
      ▼
Data Preprocessing (ColumnTransformer + Pipeline)
      │
      ▼
Temporal Train/Val/Test Split (70/15/15)
      │
      ▼
Random Forest Classifier (200 trees, balanced class weights)
      │
      ▼
Evaluation (Accuracy, Precision, Recall, F1, ROC-AUC, FNR, FPR)
      │
      ▼
FastAPI Inference Service (port 8000)
      │
      ▼
Next.js Integration (ML Client → Threat Assessment → SafeCut)
```

## Directory Structure

```
ml/
├── api/
│   └── main.py              # FastAPI inference service
├── data/
│   ├── raw/
│   │   └── ton_iot/         # Raw CSV files (not in git)
│   └── processed/           # Generated .npy files (not in git)
├── models/
│   ├── intrusion_detector.joblib  # Trained model (not in git)
│   ├── preprocessor.joblib        # Preprocessing pipeline (not in git)
│   └── feature_names.joblib       # Feature names (not in git)
├── notebooks/
│   └── 01_exploration.ipynb       # Jupyter exploration
├── reports/
│   ├── training_metrics.json      # Training metrics
│   ├── evaluation_report.json     # Test evaluation
│   └── classification_report.json # Per-class metrics
├── src/
│   ├── __init__.py
│   ├── config.py              # Configuration constants
│   ├── preprocess.py          # Data preprocessing pipeline
│   ├── train.py               # Model training
│   ├── evaluate.py            # Model evaluation
│   └── predict.py             # Inference helpers
├── requirements.txt           # Python dependencies
└── README.md                  # This file
```

## Quick Start

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Place ToN_IoT CSV files in ml/data/raw/ton_iot/
# (See ml/data/README.md for download instructions)

# 3. Preprocess data
python -m ml.src.preprocess

# 4. Train model
python -m ml.src.train

# 5. Evaluate model
python -m ml.src.evaluate

# 6. Start API server
python -m uvicorn ml.api.main:app --reload --port 8000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Service health check |
| `/features` | GET | List expected feature names |
| `/predict` | POST | Make prediction |
| `/metrics` | GET | Training metrics |
| `/reload` | POST | Reload model from disk |

### Prediction Request
```json
{
  "features": {
    "duration": 1.5,
    "bytes": 1024,
    "packets": 10,
    ...
  },
  "timestamp": "2026-10-05T10:00:00Z"
}
```

### Prediction Response
```json
{
  "prediction": "attack",
  "confidence": 0.97,
  "attack_type": "DoS",
  "model_version": "rf-toniot-v1",
  "timestamp": "2026-10-05T10:00:00Z"
}
```

## Model Details

- **Algorithm**: RandomForestClassifier
- **Trees**: 200
- **Max Depth**: 15
- **Min Samples Leaf**: 2
- **Class Weight**: Balanced
- **Features**: All numeric + one-hot encoded categorical
- **Split Strategy**: Temporal (70/15/15) to prevent leakage

## Evaluation Metrics (Target)

| Metric | Target |
|--------|--------|
| Accuracy | >95% |
| Precision (Attack) | >90% |
| Recall (Attack) | >90% |
| F1 Score | >90% |
| ROC-AUC | >0.95 |
| False Negative Rate | <10% |
| False Positive Rate | <5% |

## Security Considerations

- Model artifacts not committed to git
- Raw dataset not committed to git
- Input validation on all API endpoints
- Timeout on prediction requests (5s default)
- CORS enabled for Next.js integration

## Integration with SafeCut

The ML pipeline integrates with SafeCut through:

1. **ML Client** (`lib/ml-client.ts`): Calls FastAPI `/predict`
2. **Threat Assessment** (`lib/threat-assessment.ts`): Combines ML confidence + node criticality + exposure
3. **Risk Score** (0-100): Determines severity (LOW/MEDIUM/HIGH/CRITICAL)
4. **Action Mapping**: CRITICAL → SafeCut invocation

## Configuration

Key settings in `ml/src/config.py`:
- `MODEL_VERSION`: "rf-toniot-v1"
- `N_ESTIMATORS`: 200
- `MAX_DEPTH`: 15
- `API_PORT`: 8000

## License

ISC License