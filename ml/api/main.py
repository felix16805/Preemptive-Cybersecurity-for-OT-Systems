"""FastAPI inference service for SafeCut ML"""
import sys
import os
from pathlib import Path
from datetime import datetime
from typing import Optional, List
import joblib
import numpy as np
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.src.config import *

# ─── API Models ──────────────────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    """Request model for prediction"""
    features: dict = Field(..., description="Feature values for prediction")
    timestamp: Optional[str] = Field(None, description="Event timestamp")

class PredictionResponse(BaseModel):
    """Response model for prediction"""
    prediction: str = Field(..., description="normal or attack")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score")
    attack_type: Optional[str] = Field(None, description="Type of attack if detected")
    model_version: str = Field(..., description="Model version")
    timestamp: str = Field(..., description="Response timestamp")

class HealthResponse(BaseModel):
    """Health check response"""
    status: str = Field(..., description="Service status")
    model_loaded: bool = Field(..., description="Whether model is loaded")
    model_version: Optional[str] = Field(None, description="Loaded model version")

# ─── FastAPI App ─────────────────────────────────────────────────────────────

app = FastAPI(
    title=API_TITLE,
    version=API_VERSION,
    description="SafeCut ML Intrusion Detection API for OT/IoT Systems"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Model Loading ───────────────────────────────────────────────────────────

model = None
preprocessor = None
feature_names = None

def load_model():
    """Load trained model and preprocessor"""
    global model, preprocessor, feature_names
    
    if not MODEL_PATH.exists():
        print(f"WARNING: Model not found at {MODEL_PATH}")
        return False
    
    model = joblib.load(MODEL_PATH)
    preprocessor = joblib.load(PREPROCESSOR_PATH)
    feature_names = joblib.load(MODELS_DIR / "feature_names.joblib")
    
    print(f"Model loaded: {MODEL_VERSION}")
    return True

# Load on startup
load_model()

# ─── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
    status="ok" if model is not None else "error",
    model_loaded=model is not None,
    model_version=MODEL_VERSION if model is not None else None
)

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """Predict whether traffic is normal or an attack"""
    if model is None or preprocessor is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    try:
        # Prepare features in correct order
        features = request.features
        
        # Check for missing features
        missing = [f for f in feature_names if f not in features]
        if missing:
            raise HTTPException(
                status_code=400,
                detail=f"Missing features: {missing}"
            )
        
        # Build feature vector
        feature_vector = np.array([[features.get(f, 0) for f in feature_names]])
        
        # Preprocess
        processed = preprocessor.transform(feature_vector)
        
        # Predict
        prediction_label = model.predict(processed)[0]
        prediction_proba = model.predict_proba(processed)[0]
        
        # Determine prediction
        if hasattr(model, 'classes_'):
            classes = model.classes_
        else:
            classes = [0, 1]
        
        if len(classes) == 2:
            # Binary classification
            attack_idx = 1 if 1 in classes else list(classes).index(max(classes))
            normal_idx = 0 if 0 in classes else list(classes).index(min(classes))
            
            if prediction_label == classes[attack_idx]:
                prediction = "attack"
                confidence = float(prediction_proba[attack_idx])
            else:
                prediction = "normal"
                confidence = float(prediction_proba[normal_idx])
        else:
            # Multi-class
            pred_idx = list(classes).index(prediction_label)
            prediction = "attack" if prediction_label != 0 else "normal"
            confidence = float(prediction_proba[pred_idx])
        
        return PredictionResponse(
            prediction=prediction,
            confidence=confidence,
            attack_type=None,  # Could be extended for multi-class
            model_version=MODEL_VERSION,
            timestamp=datetime.utcnow().isoformat() + "Z"
        )
    
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.get("/features")
async def get_features():
    """Get list of expected features"""
    if feature_names is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    return {
        "features": feature_names,
        "count": len(feature_names)
    }

@app.get("/metrics")
async def get_metrics():
    """Get training metrics"""
    metrics_path = REPORTS_DIR / "training_metrics.json"
    if metrics_path.exists():
        import json
        with open(metrics_path) as f:
            return json.load(f)
    raise HTTPException(status_code=404, detail="Metrics not available")

@app.post("/reload")
async def reload_model():
    """Reload model from disk"""
    success = load_model()
    if success:
        return {"status": "ok", "message": "Model reloaded"}
    raise HTTPException(status_code=500, detail="Failed to reload model")

# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(
        "ml.api.main:app",
        host=API_HOST,
        port=API_PORT,
        reload=True,
        log_level=LOG_LEVEL.lower()
    )