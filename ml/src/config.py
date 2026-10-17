"""ML pipeline configuration"""
import os
from pathlib import Path

# Paths
ML_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = ML_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw" / "ton_iot"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
MODELS_DIR = ML_DIR / "models"
REPORTS_DIR = ML_DIR / "reports"
NOTEBOOKS_DIR = ML_DIR / "notebooks"

# Create directories
for d in [PROCESSED_DATA_DIR, MODELS_DIR, REPORTS_DIR, NOTEBOOKS_DIR]:
    d.mkdir(parents=True, exist_ok=True)

# Dataset configuration
DATASET_NAME = "ToN_IoT"
DATASET_URL = "https://research.unsw.edu.au/projects/toniot-datasets"

# Model configuration
MODEL_NAME = "random_forest"
MODEL_VERSION = "rf-toniot-v1"
MODEL_PATH = MODELS_DIR / "intrusion_detector.joblib"
PREPROCESSOR_PATH = MODELS_DIR / "preprocessor.joblib"

# Training configuration
TEST_SIZE = 0.2
VALIDATION_SIZE = 0.1
RANDOM_STATE = 42
N_ESTIMATORS = 200
MAX_DEPTH = 15
MIN_SAMPLES_LEAF = 2

# Features - ToN_IoT typical features (will be auto-detected)
# These are placeholders; actual features depend on dataset version
POSSIBLE_FEATURES = [
    "ts", "src_ip", "dst_ip", "src_port", "dst_port",
    "proto", "service", "duration", "bytes", "packets",
    "pkts_per_sec", "bytes_per_sec", "flow_duration",
    "tcp_flags", "ttl", "icmp_type", "dns_query"
]

# Target column(s)
LABEL_COLUMN = "label"
ATTACK_TYPE_COLUMN = "attack_cat"

# Safety thresholds
MAX_SAFE_TEMPERATURE = 400.0  # Kelvin
RUNAWAY_TEMPERATURE = 450.0  # Kelvin

# API configuration
API_HOST = "0.0.0.0"
API_PORT = 8000
API_TITLE = "SafeCut ML Detection API"
API_VERSION = "1.0.0"

# Logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")