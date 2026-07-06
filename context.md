# Gold Prices Prediction Project - Context Document

> **Last Updated:** January 2, 2026  
> **Project Status:** Complete ML forecasting pipeline with interactive dashboards

---

## 📋 Table of Contents

1. [Project Overview](#project-overview)
2. [Project Structure](#project-structure)
3. [Data Sources](#data-sources)
4. [Core Features](#core-features)
5. [ML Models](#ml-models)
6. [Key Technical Decisions](#key-technical-decisions)
7. [How to Run](#how-to-run)
8. [Output Files](#output-files)
9. [Performance Metrics](#performance-metrics)
10. [Technical Stack](#technical-stack)

---

## 🎯 Project Overview

This project provides a **quantitative analysis of Gold and Silver price behavior** using historical time-series data from 2014-2026 (INR currency). It combines:

- **Statistical price band analysis** (Z-score & rolling volatility)
- **3-month forward ML forecasting** (regime-aware)
- **Two interactive Streamlit dashboards**
- **Risk-aware allocation insights**

### Key Objectives

1. Build a **regime-aware 3-month forward ML forecasting pipeline**
2. Translate statistical outputs into **risk-aware investment observations**
3. Move beyond narrative opinions to **quantify trend, volatility, deviation regimes, and forward risk**

---

## 📁 Project Structure

```
gold_prices_prediction-main/
├── data/                          # CSV data files
│   ├── gold.csv                  # Gold prices (₹/10g)
│   ├── silver.csv                # Silver prices (₹/kg) - original
│   └── silver_new.csv            # Silver prices - cleaned version
│
├── ml_models/                     # ML forecasting pipeline
│   ├── models/                   # Individual model implementations
│   │   ├── ridge_model.py       # Linear regression baseline
│   │   ├── lgbm_model.py        # Gradient boosting trees
│   │   ├── knn_model.py         # Instance-based learning
│   │   ├── svr_model.py         # Support Vector Regression
│   │   └── hmm_regime.py        # Hidden Markov Model for regime detection
│   ├── config.py                # Central configuration & hyperparameters
│   ├── pipeline.py              # Main orchestrator (run this!)
│   ├── data_loader.py           # Data loading & cleaning
│   ├── feature_engineering.py   # 36 feature construction
│   ├── ensemble.py              # Model blending strategies
│   └── evaluation.py            # Performance metrics
│
├── dashboard/
│   └── ml_dashboard.py          # ML forecasting dashboard (Streamlit)
│
├── outputs/                      # Generated results
│   ├── predictions.csv          # Model predictions & actual values
│   ├── metrics.csv              # Performance comparison
│   ├── ensemble_weights.csv     # Model contribution weights
│   └── plots/                   # Visualization outputs
│       ├── regime_visualization.png
│       ├── ensemble_comparison.png
│       ├── metrics_comparison.png
│       └── [model]_predictions.png
│
├── streamlit_app_final.py        # Price band analysis dashboard
├── assignment_finsharpe_final.ipynb  # Jupyter notebook analysis
├── requirements.txt              # Python dependencies
├── README.md                     # Project documentation
├── ML_Forecasting_Documentation.md  # Detailed ML methodology
└── Gold-Silver-Analysis.pdf      # Final report

```

---

## 📊 Data Sources

### Gold Data (`gold.csv`)
- **Frequency:** Daily
- **Period:** 2014-01-01 to 2026-01-02 (~3,104 rows)
- **Unit:** ₹/10g
- **Columns:** Date, Price (Close), Open, High, Low, Volume, Chg%

### Silver Data (`silver_new.csv`)
- **Frequency:** Daily  
- **Period:** 2014-01-01 to 2026-01-02 (~3,120 rows)
- **Unit:** ₹/kg
- **Columns:** Date, Open, High, Low, Close, Volume, Change %
- **Note:** Contains commas and "K" suffixes that require cleaning

### Data Cleaning Steps
1. Date parsing (different formats between gold/silver)
2. Sort to chronological order (CSVs are reverse-chronological)
3. Numeric conversion (remove commas, parse "K" in volume)
4. Alignment to overlapping date range
5. Forward-fill minor gaps (different holiday calendars)

---

## 🔧 Core Features

The project implements **36 engineered features** across 7 categories:

### 1. Returns (Momentum)
- **1d, 5d, 21d, 63d log returns** for gold and silver
- Log returns used for time-additivity and better normality

### 2. Rolling Volatility (Regime Detection)
- **21d, 63d, 252d annualized volatility**
- Captures volatility clustering and regime shifts
- Formula: `std(daily_returns) × √252`

### 3. Moving Averages (Trend)
- **20d, 50d, 200d SMAs**
- **Price-to-SMA ratios** (normalized signals across price levels)

### 4. Momentum Indicators
- **RSI-14:** Relative Strength Index (overbought/oversold)
- **MACD (12/26/9):** Moving Average Convergence Divergence
- **Rate of Change (21d, 63d):** Simple momentum measure

### 5. Z-Score (Mean Reversion)
- **200d rolling z-score:** Standard deviations from long-term mean
- Used in price band visualizations

### 6. Gold-Silver Ratio (Cross-Asset)
- **Ratio + 50d MA + 200d z-score**
- High ratio = risk-off (gold outperforming)
- Low ratio = risk-on (silver outperforming)

### 7. Calendar Features
- Day of week, month (captures settlement effects & seasonality)

---

## 🤖 ML Models

### Target Variable: **63-day Forward LOG RETURN**

**Critical Design Choice:**
```
target[t] = log(price[t+63] / price[t])
predicted_price = current_price × exp(predicted_return)
```

**Why log returns instead of raw prices?**
- Returns are **stationary** (a 5% return looks the same at ₹30k or ₹70k)
- Tree/instance models **cannot extrapolate** beyond training price range
- Predicting raw prices fails when test prices exceed all training values
- Better statistical properties (additivity, approximate normality)

### 5 Models + Ensemble

#### 1. **Ridge Regression** (Linear Baseline)
- **Purpose:** Extrapolation capability, interpretable coefficients
- **Config:** alpha=1.0 (L2 regularization for multicollinearity)
- **Pros:** Fast, handles correlated features
- **Cons:** Cannot capture non-linear patterns

#### 2. **LightGBM** (Gradient Boosting)
- **Purpose:** Non-linear interactions, feature importance
- **Config:** 
  - n_estimators=2000, learning_rate=0.005
  - max_depth=4, num_leaves=15
  - Early stopping at 100 rounds
- **Pros:** Captures complex patterns, handles mixed feature types
- **Cons:** Can overfit small datasets

#### 3. **k-Nearest Neighbors** (Instance-Based)
- **Purpose:** Historical analogy matching
- **Config:** k=10, distance-weighted
- **Pros:** No assumptions about functional form
- **Cons:** Cannot extrapolate, curse of dimensionality

#### 4. **Support Vector Regression** (Kernel Method)
- **Purpose:** Global smooth function with noise robustness
- **Config:** 
  - kernel='rbf', C=1.0
  - epsilon=0.001 (tuned for return scale)
- **Pros:** Epsilon-insensitive loss ignores noise
- **Cons:** Slow training (O(n²))

#### 5. **Gaussian HMM** (Regime Detection)
- **Purpose:** NOT direct prediction - labels market regimes
- **Config:** 3 states (low-vol / high-vol / crisis)
- **Output:** Regime labels become categorical features for other models

### Ensemble Strategy: **Inverse-RMSE Weighting**

```
weight_i = (1/RMSE_i) / Σ(1/RMSE_j)
```

Models with lower validation RMSE get higher weights. This:
- Reduces correlated prediction errors
- Improves stability across volatility regimes
- Tracks model disagreement as uncertainty proxy

---

## 🧠 Key Technical Decisions

### 1. **Return-Based Prediction** (Most Important!)
- **Problem:** Tree models can't predict prices beyond training range
- **Solution:** Predict log returns → convert to prices
- **Impact:** Robust performance across all price regimes

### 2. **Chronological Split** (No Shuffling)
- Train: 70% | Validation: 15% | Test: 15%
- Prevents look-ahead bias in time series

### 3. **Feature Warmup Period**
- ~252 rows lost to rolling window calculations
- Necessary for 252-day volatility and z-scores

### 4. **Z-Score Bands Over Raw Std Dev**
- Normalizes deviation relative to volatility
- Enables cross-asset comparison
- Adapts to regime shifts better than fixed bands

### 5. **Multiple Volatility Windows**
- 21d: Intramonth regime
- 63d: Quarterly volatility
- 252d: Annual baseline

---

## 🚀 How to Run

### 1. **Install Dependencies**
```bash
pip install -r requirements.txt
```

**Key packages:**
- streamlit, pandas, numpy, plotly, matplotlib
- scikit-learn, lightgbm, hmmlearn, joblib, babel

### 2. **Run ML Pipeline**
```bash
python -m ml_models.pipeline
```

**What it does:**
1. Loads & cleans data
2. Engineers 36 features
3. Detects regimes with HMM
4. Trains 5 models
5. Generates ensemble predictions
6. Saves outputs to `outputs/`

**Runtime:** ~2-5 minutes

### 3. **Launch Dashboards**

**ML Forecasting Dashboard:**
```bash
streamlit run dashboard/ml_dashboard.py
```

**Price Band Analysis Dashboard:**
```bash
streamlit run streamlit_app_final.py
```

---

## 📈 Output Files

### `outputs/predictions.csv`
Columns:
- `Date` - Test set dates
- `Actual` - Real 3-month forward price
- `Current_Price` - Price at prediction time
- `Ridge`, `LightGBM`, `KNN`, `SVR` - Individual model predictions
- `Ensemble` - Weighted blend
- `Model_Disagreement` - Std dev across models (uncertainty proxy)

### `outputs/metrics.csv`
Performance comparison:
- **MAE** - Mean Absolute Error (₹)
- **RMSE** - Root Mean Squared Error (₹)
- **MAPE** - Mean Absolute Percentage Error (%)
- **Dir_Accuracy** - Directional accuracy (%)

### `outputs/ensemble_weights.csv`
Inverse-RMSE weights for each model

### `outputs/plots/`
- `regime_visualization.png` - HMM regime overlay
- `ensemble_comparison.png` - All models vs actual
- `metrics_comparison.png` - Bar chart comparison
- Individual model prediction plots

---

## 📊 Performance Metrics (Latest Test Run)

### Model Comparison

| Model | MAE (₹) | RMSE (₹) | MAPE (%) | Dir Accuracy (%) |
|-------|---------|----------|----------|------------------|
| **Ridge** | 3,258 | 4,138 | 4.98 | 65.6 |
| **LightGBM** | 2,765 | 3,495 | 4.22 | 70.2 |
| **k-NN** | 2,841 | 3,687 | 4.40 | 64.7 |
| **SVR** | 2,413 | 2,991 | 3.71 | 70.0 |
| **Ensemble** | **2,418** | **3,101** | **3.69** | **76.0** |

### Key Insights

- **Ensemble outperforms** all individual models on directional accuracy
- **SVR** has lowest MAPE (best percentage error)
- **LightGBM** captures non-linear patterns well
- **Ridge** serves as solid linear baseline
- Mean model disagreement: ~₹3,200 (uncertainty metric)

---

## 🛠 Technical Stack

### Languages & Frameworks
- **Python 3.8+**
- **Streamlit** - Interactive dashboards
- **Jupyter** - Exploratory analysis

### Data Science Libraries
- **pandas** - Data manipulation
- **numpy** - Numerical computing
- **matplotlib, plotly** - Visualization

### Machine Learning
- **scikit-learn** - Ridge, KNN, SVR, preprocessing
- **lightgbm** - Gradient boosting
- **hmmlearn** - Hidden Markov Models

### Utilities
- **babel** - Indian number formatting (lakhs/crores)
- **joblib** - Model serialization (if needed)

---

## 📝 Important Files to Review

### For Understanding ML Approach:
1. `ML_Forecasting_Documentation.md` - Detailed methodology
2. `ml_models/config.py` - All hyperparameters with justification
3. `ml_models/pipeline.py` - Main orchestration logic

### For Understanding Analysis:
1. `README.md` - Project overview & objectives
2. `streamlit_app_final.py` - Price band analysis code
3. `Gold-Silver-Analysis.pdf` - Final report

### For Quick Results:
1. `outputs/predictions.csv` - Latest model outputs
2. `outputs/metrics.csv` - Performance summary
3. `outputs/plots/ensemble_comparison.png` - Visual comparison

---

## 🔄 Data Flow Summary

```
Raw CSVs (gold.csv, silver_new.csv)
    ↓
[Data Loader] - Clean, parse, align dates
    ↓
[Feature Engineering] - 36 features across 7 categories
    ↓
[HMM Regime Detection] - Add regime labels as features
    ↓
[Target Construction] - 63-day forward log return
    ↓
[Train/Val/Test Split] - Chronological 70/15/15
    ↓
[Train 5 Models] - Predict log returns
    ↓
[Convert Returns → Prices] - exp(return_pred) × current_price
    ↓
[Ensemble Blending] - Inverse-RMSE weighted average
    ↓
[Evaluation] - MAE, RMSE, MAPE, Directional Accuracy
    ↓
[Save Outputs] - CSV + plots
    ↓
[Interactive Dashboards] - Streamlit apps
```

---

## 🎓 Key Learnings

### What Works Well:
✅ Return-based prediction solves extrapolation problem  
✅ Ensemble reduces error and improves directional accuracy  
✅ HMM regime detection captures market state changes  
✅ Multiple volatility windows distinguish transient vs structural shifts  
✅ Z-score bands provide disciplined deviation framework  

### Limitations:
⚠️ Backward-looking analysis  
⚠️ Limited macro variables (no interest rates, USD/INR, crude oil)  
⚠️ Fixed 63-day horizon  
⚠️ Small dataset (~2,000 training samples after warmup)  
⚠️ No walk-forward cross-validation  
⚠️ Extreme structural breaks may reduce reliability  

---

## 🔮 Future Enhancements

1. **Add Macro Features:**
   - USD/INR exchange rate
   - Interest rates (RBI repo rate)
   - Crude oil prices
   - Inflation data (CPI)

2. **Walk-Forward Validation:**
   - Expanding or sliding window CV
   - More robust performance estimates

3. **Multi-Horizon Forecasts:**
   - 1-week, 1-month, 3-month, 6-month
   - Different models may excel at different horizons

4. **Uncertainty Quantification:**
   - Prediction intervals (e.g., quantile regression)
   - Conformal prediction

5. **Real-Time Updates:**
   - API integration for live data
   - Automated daily retraining

6. **Deep Learning Experiments:**
   - LSTM, Transformer models
   - Compare against traditional ML

---

## 📞 Contact & Attribution

**Author:** Aswathi Pillai  
**GitHub:** [https://github.com/pinkprincess536](https://github.com/pinkprincess536)

---

## 📜 License & Usage

This project is for **educational and research purposes**. The analysis provides **risk-aware observations**, not investment advice.

> ⚠️ **Disclaimer:** All insights are data-backed and qualitative. Past performance does not guarantee future results. Always conduct your own research before making investment decisions.

---

**Last Context Update:** January 2026  
**Project Version:** 1.0 (Complete)
