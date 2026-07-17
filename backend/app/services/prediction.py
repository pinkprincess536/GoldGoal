import os
from datetime import timezone

import joblib
import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from ml_models.config import OUTPUT_DIR, SILVER_CSV
from ml_models.feature_engineering import build_features
from ml_models.models.hmm_regime import predict_regimes
from ml_models.models.ridge_model import predict_ridge
from ml_models.models.lgbm_model import predict_lgbm
from ml_models.models.knn_model import predict_knn
from ml_models.models.svr_model import predict_svr
from ml_models.ensemble import inverse_rmse_weighted


def _load_silver_df() -> pd.DataFrame:
    """Load silver data from CSV for feature building (static reference data)."""
    df = pd.read_csv(SILVER_CSV, parse_dates=["Date"], dayfirst=True)
    df = df.sort_values("Date")
    df = df.set_index("Date")
    if "Close" not in df.columns:
        df["Close"] = df["Price"] if "Price" in df.columns else df.iloc[:, 0]
    return df


def _load_models():
    """Load persisted models from disk."""
    models_dir = os.path.join(OUTPUT_DIR, "models")

    required = [
        "ridge_model.pkl", "ridge_scaler.pkl", "lgbm_model.pkl",
        "knn_model.pkl", "knn_scaler.pkl", "svr_model.pkl",
        "svr_scaler.pkl", "svr_stats.pkl", "hmm_model.pkl",
        "feature_cols.pkl", "ensemble_weights.pkl",
    ]
    for fname in required:
        path = os.path.join(models_dir, fname)
        if not os.path.exists(path):
            return None

    return {
        "ridge_model": joblib.load(os.path.join(models_dir, "ridge_model.pkl")),
        "ridge_scaler": joblib.load(os.path.join(models_dir, "ridge_scaler.pkl")),
        "lgbm_model": joblib.load(os.path.join(models_dir, "lgbm_model.pkl")),
        "knn_model": joblib.load(os.path.join(models_dir, "knn_model.pkl")),
        "knn_scaler": joblib.load(os.path.join(models_dir, "knn_scaler.pkl")),
        "svr_model": joblib.load(os.path.join(models_dir, "svr_model.pkl")),
        "svr_scaler": joblib.load(os.path.join(models_dir, "svr_scaler.pkl")),
        "svr_stats": joblib.load(os.path.join(models_dir, "svr_stats.pkl")),
        "hmm_model": joblib.load(os.path.join(models_dir, "hmm_model.pkl")),
        "feature_cols": joblib.load(os.path.join(models_dir, "feature_cols.pkl")),
        "weights": joblib.load(os.path.join(models_dir, "ensemble_weights.pkl")),
    }


def _gold_df_from_db(db: Session) -> pd.DataFrame:
    """Build a gold price DataFrame from the gold_prices table."""
    from app.models.gold_price import GoldPrice
    rows = db.query(GoldPrice).order_by(GoldPrice.date.asc()).all()
    if not rows:
        return pd.DataFrame(columns=["Close"])

    dates = [r.date.replace(tzinfo=timezone.utc) for r in rows]
    prices = [r.price_per_gram for r in rows]
    df = pd.DataFrame({"Close": prices}, index=pd.DatetimeIndex(dates))
    return df


def _returns_to_prices(log_return_preds, current_prices):
    return current_prices * np.exp(log_return_preds)


def get_63day_prediction(db: Session) -> dict | None:
    """
    Generate a 63-day forward gold price prediction using saved ML models.

    Returns None if models aren't trained yet.
    """
    models = _load_models()
    if models is None:
        return None

    gold_db = _gold_df_from_db(db)
    if len(gold_db) < 252:
        return None

    silver_csv = _load_silver_df()

    # Align dates
    common = gold_db.index.intersection(silver_csv.index)
    if len(common) < 252:
        return None

    gold_aligned = gold_db.loc[common]
    silver_aligned = silver_csv.loc[common]

    # Build features
    features = build_features(gold_aligned, silver_aligned)

    # Add HMM regime predictions
    regime_labels = predict_regimes(models["hmm_model"], features)
    features["hmm_regime"] = regime_labels

    # Get the latest row
    latest = features.iloc[-1:]
    current_price = latest["gold_close"].values[0]

    X = latest[models["feature_cols"]].values.astype(float)

    # Predict returns with each model
    ridge_ret = predict_ridge(models["ridge_model"], models["ridge_scaler"], X)
    lgbm_ret = predict_lgbm(models["lgbm_model"], X)
    knn_ret = predict_knn(models["knn_model"], models["knn_scaler"], X)
    svr_mean, svr_std = models["svr_stats"]
    svr_ret = predict_svr(models["svr_model"], models["svr_scaler"], X, svr_mean, svr_std)

    # Convert returns to prices
    predictions = {
        "Ridge": _returns_to_prices(ridge_ret, np.array([current_price]))[0],
        "LightGBM": _returns_to_prices(lgbm_ret, np.array([current_price]))[0],
        "k-NN": _returns_to_prices(knn_ret, np.array([current_price]))[0],
        "SVR": _returns_to_prices(svr_ret, np.array([current_price]))[0],
    }

    # Ensemble
    ensemble_pred, _ = inverse_rmse_weighted(
        {k: np.array([v]) for k, v in predictions.items()},
        {k: 1.0 / models["weights"].get(k, 0.25) for k in predictions},
    )

    return {
        "current_price": round(float(current_price), 2),
        "predicted_63d_price": round(float(ensemble_pred[0]), 2),
        "predicted_change_pct": round(float((ensemble_pred[0] - current_price) / current_price * 100), 2),
        "individual": {k: round(float(v), 2) for k, v in predictions.items()},
    }
