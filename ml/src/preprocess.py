"""Data preprocessing pipeline for ToN_IoT dataset"""
import pandas as pd
import numpy as np
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler, OneHotEncoder, LabelEncoder
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
import joblib
import os
import sys
from pathlib import Path

# Add parent to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from ml.src.config import *

def load_raw_data():
    """Load all CSV files from raw data directory"""
    csv_files = list(RAW_DATA_DIR.glob("*.csv"))
    if not csv_files:
        raise FileNotFoundError(f"No CSV files found in {RAW_DATA_DIR}")
    
    print(f"Found {len(csv_files)} CSV files")
    dfs = []
    for f in csv_files:
        print(f"  Loading {f.name}")
        df = pd.read_csv(f, low_memory=False)
        dfs.append(df)
    
    combined = pd.concat(dfs, ignore_index=True, sort=False)
    print(f"Combined shape: {combined.shape}")
    return combined

def inspect_columns(df):
    """Inspect and report on dataset columns"""
    print(f"\nDataset shape: {df.shape}")
    print(f"Columns ({len(df.columns)}):")
    for col in df.columns:
        dtype = df[col].dtype
        nulls = df[col].isnull().sum()
        unique = df[col].nunique()
        print(f"  {col}: dtype={dtype}, nulls={nulls}, unique={unique}")

def clean_data(df):
    """Clean the dataset"""
    # Drop rows with all NaN
    df = df.dropna(how='all')
    
    # Remove duplicate rows
    before = len(df)
    df = df.drop_duplicates()
    print(f"Dropped {before - len(df)} duplicate rows")
    
    # Convert timestamp if present
    if 'ts' in df.columns:
        df['ts'] = pd.to_numeric(df['ts'], errors='coerce')
    
    return df

def identify_features(df):
    """Identify numeric and categorical features"""
    # Exclude non-feature columns
    exclude = ['label', 'attack_cat', 'ts', 'src_ip', 'dst_ip', 'id']
    
    feature_cols = [c for c in df.columns if c not in exclude]
    
    numeric_cols = df[feature_cols].select_dtypes(include=[np.number]).columns.tolist()
    categorical_cols = df[feature_cols].select_dtypes(include=['object', 'category']).columns.tolist()
    
    print(f"\nNumeric features ({len(numeric_cols)}): {numeric_cols}")
    print(f"Categorical features ({len(categorical_cols)}): {categorical_cols}")
    
    return numeric_cols, categorical_cols

def create_preprocessor(numeric_cols, categorical_cols):
    """Create a scikit-learn preprocessing pipeline"""
    numeric_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler())
    ])
    
    categorical_transformer = Pipeline(steps=[
        ('imputer', SimpleImputer(strategy='constant', fill_value='unknown')),
        ('onehot', OneHotEncoder(handle_unknown='ignore', sparse_output=False))
    ])
    
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', numeric_transformer, numeric_cols),
            ('cat', categorical_transformer, categorical_cols)
        ],
        remainder='drop'
    )
    
    return preprocessor

def prepare_data(df, numeric_cols, categorical_cols):
    """Prepare features and labels"""
    # Features
    feature_cols = numeric_cols + categorical_cols
    X = df[feature_cols].copy()
    
    # Labels
    if LABEL_COLUMN in df.columns:
        y = df[LABEL_COLUMN].copy()
    else:
        raise ValueError(f"Label column '{LABEL_COLUMN}' not found")
    
    # Encode labels if needed
    if y.dtype == 'object':
        le = LabelEncoder()
        y = le.fit_transform(y)
        print(f"Label classes: {le.classes_}")
    
    return X, y

def temporal_split(X, y, df):
    """Time-aware split to prevent data leakage"""
    if 'ts' in df.columns:
        # Sort by timestamp
        sorted_idx = df['ts'].argsort()
        X = X.iloc[sorted_idx]
        y = y.iloc[sorted_idx]
    
    # Split: 70% train, 15% validation, 15% test
    train_size = int(len(X) * 0.7)
    val_size = int(len(X) * 0.15)
    
    X_train = X.iloc[:train_size]
    y_train = y.iloc[:train_size]
    
    X_val = X.iloc[train_size:train_size + val_size]
    y_val = y.iloc[train_size:train_size + val_size]
    
    X_test = X.iloc[train_size + val_size:]
    y_test = y.iloc[train_size + val_size:]
    
    print(f"\nTrain: {len(X_train)}, Val: {len(X_val)}, Test: {len(X_test)}")
    
    return X_train, X_val, X_test, y_train, y_val, y_test

def main():
    """Main preprocessing pipeline"""
    print("=" * 60)
    print("SafeCut ML Pipeline - Data Preprocessing")
    print("=" * 60)
    
    # Load
    df = load_raw_data()
    
    # Inspect
    inspect_columns(df)
    
    # Clean
    df = clean_data(df)
    
    # Identify features
    numeric_cols, categorical_cols = identify_features(df)
    
    if not numeric_cols and not categorical_cols:
        raise ValueError("No usable features found")
    
    # Prepare
    X, y = prepare_data(df, numeric_cols, categorical_cols)
    
    # Create preprocessor
    preprocessor = create_preprocessor(numeric_cols, categorical_cols)
    
    # Fit preprocessor on training data
    print("\nFitting preprocessor...")
    X_train, X_val, X_test, y_train, y_val, y_test = temporal_split(X, y, df)
    
    X_train_processed = preprocessor.fit_transform(X_train)
    print(f"Processed training shape: {X_train_processed.shape}")
    
    # Save preprocessor
    joblib.dump(preprocessor, PREPROCESSOR_PATH)
    print(f"\nPreprocessor saved to {PREPROCESSOR_PATH}")
    
    # Save processed data
    np.save(PROCESSED_DATA_DIR / "X_train.npy", X_train_processed)
    np.save(PROCESSED_DATA_DIR / "y_train.npy", y_train.values)
    
    if len(X_val) > 0:
        X_val_processed = preprocessor.transform(X_val)
        np.save(PROCESSED_DATA_DIR / "X_val.npy", X_val_processed)
        np.save(PROCESSED_DATA_DIR / "y_val.npy", y_val.values)
    
    if len(X_test) > 0:
        X_test_processed = preprocessor.transform(X_test)
        np.save(PROCESSED_DATA_DIR / "X_test.npy", X_test_processed)
        np.save(PROCESSED_DATA_DIR / "y_test.npy", y_test.values)
    
    print("Preprocessing complete!")
    
    # Save feature names for later use
    feature_names = numeric_cols + categorical_cols
    joblib.dump(feature_names, MODELS_DIR / "feature_names.joblib")
    print(f"Feature names saved: {len(feature_names)} features")

if __name__ == "__main__":
    main()