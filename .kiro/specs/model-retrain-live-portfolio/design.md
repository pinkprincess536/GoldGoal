# Design Document

## Overview

This feature adds scheduled background work and live-price-driven portfolio valuation to the GoldGoal FastAPI backend. It introduces an in-process APScheduler managed by the FastAPI lifespan, two scheduled jobs (a daily price fetch and a 30-day model retrain), and updates the portfolio service to value holdings against the latest cached gold price.

The design deliberately reuses existing infrastructure:

- The existing `gold_prices` table (`GoldPrice` model) is the price cache. Gold and silver rows are distinguished by the `source` column.
- The existing `predictions` table (`Prediction` model) receives new prediction rows from the retrain job.
- The existing `Portfolio_Service` (`backend/app/services/portfolio.py`) is modified to resolve the current gold price from the cache instead of the hardcoded `CURRENT_GOLD_PRICE`.
- The `Purchase` model is not changed.

New code is organized to match the current `backend/app` layout: configuration in `core/`, persistence-facing logic in `services/`, and lifecycle wiring in `main.py`.

## Architecture

```
                    FastAPI app (backend/app/main.py)
                                 |
                    lifespan(startup / shutdown)
                                 |
                 +---------------+----------------+
                 | start scheduler   stop scheduler|
                 v                                 v
        APScheduler (BackgroundScheduler, in-process)
                 |
     +-----------+------------------------------+
     |                                          |
  Price_Fetch_Job (interval=1 day)     Retrain_Job (interval=30 days)
     |                                          |
     v                                          v
  PriceFetchService                     RetrainService
     |  - calls Price_API (httpx)          |  - reads gold history from Price_Cache
     |  - parses gold + silver             |  - fits prediction model
     |  - writes Gold_Row / Silver_Row     |  - writes Prediction rows
     v                                     v
  gold_prices table  <---- read ----  gold_prices table
  (Price_Cache)                            predictions table (Prediction_Store)
        ^
        | read Latest_Gold_Price (max date, source=gold)
        |
  Portfolio_Service (services/portfolio.py)  -->  Portfolio_Summary
```

Key architectural decisions:

- **In-process scheduling with `BackgroundScheduler`.** APScheduler runs inside the same process as the FastAPI app. It is created once, started in the lifespan startup phase, and shut down in the lifespan shutdown phase. This satisfies the requirement that scheduling be started/stopped from the application lifespan without introducing a separate worker process or broker.
- **Jobs own their own DB sessions.** Scheduled jobs do not run inside a request, so they cannot use the `get_db` request dependency. Each job opens a `SessionLocal()` session, does its work in a `try/except`, and closes the session in `finally`. This keeps job failures isolated and guarantees rollback-on-error semantics.
- **Thin job callables, testable services.** The functions registered with the scheduler are thin wrappers. The real logic lives in service functions that accept an explicit `Session` (and, for fetch, an HTTP client), so they can be unit- and property-tested without the scheduler or a live network.
- **Cache reuse via `source`.** No schema change is required. `source` carries the semantic distinction: gold rows use `source="gold"`, silver rows use `source="silver"`. Legacy rows written with `source="api"` are treated as gold for backward compatibility (see Data Models).

## Components and Interfaces

### 1. Settings (`backend/app/core/config.py`)

Add configurable Price_API settings. All are overridable via environment / `.env`.

```python
class Settings(BaseSettings):
    # ... existing fields ...

    # Price API (external HTTP price source)
    PRICE_API_BASE_URL: str = "https://api.example-metals.com"
    PRICE_API_KEY: str = ""
    PRICE_API_GOLD_PATH: str = "/v1/gold"
    PRICE_API_SILVER_PATH: str = "/v1/silver"
    PRICE_API_TIMEOUT_SECONDS: float = 10.0

    # Scheduling intervals (kept configurable; defaults match requirements)
    PRICE_FETCH_INTERVAL_DAYS: int = 1
    RETRAIN_INTERVAL_DAYS: int = 30

    # Fallback used when no gold row is cached
    FALLBACK_GOLD_PRICE: float = 7500.0
```

`PRICE_API_KEY` defaults to empty; the fetch job logs and skips when it is unset so a misconfigured environment fails safe rather than issuing an unauthenticated request.

### 2. Scheduler wiring (`backend/app/core/scheduler.py`, new)

A small module that owns the scheduler singleton and job registration, keeping `main.py` clean.

```python
from apscheduler.schedulers.background import BackgroundScheduler

from app.core.config import settings
from app.services.price_fetch import run_price_fetch_job
from app.services.retrain import run_retrain_job

scheduler = BackgroundScheduler()

def start_scheduler() -> None:
    scheduler.add_job(
        run_price_fetch_job,
        trigger="interval",
        days=settings.PRICE_FETCH_INTERVAL_DAYS,
        id="Price_Fetch_Job",
        replace_existing=True,
    )
    scheduler.add_job(
        run_retrain_job,
        trigger="interval",
        days=settings.RETRAIN_INTERVAL_DAYS,
        id="Retrain_Job",
        replace_existing=True,
    )
    scheduler.start()

def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
```

### 3. Lifespan integration (`backend/app/main.py`)

The existing lifespan is extended to start and stop the scheduler around `yield`.

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    start_scheduler()
    try:
        yield
    finally:
        stop_scheduler()
```

### 4. Price fetch service (`backend/app/services/price_fetch.py`, new)

Responsible for retrieving live prices and caching them.

```python
GOLD_SOURCE = "gold"
SILVER_SOURCE = "silver"

def fetch_price(client: httpx.Client, path: str) -> float:
    """Call the Price_API for a single metal and return the parsed price_per_gram."""

def write_price_row(db: Session, price: float, source: str, at: datetime) -> GoldPrice:
    """Persist one Gold_Row or Silver_Row into the Price_Cache."""

def fetch_and_cache_prices(db: Session, client: httpx.Client, now: datetime) -> None:
    """
    Fetch gold and silver from the Price_API and write a Gold_Row and Silver_Row.
    Gold and silver are handled independently: a failure fetching one does not
    block writing the other. Any failure is logged; on error the affected write
    is rolled back so existing Price_Cache rows are left unchanged.
    """

def run_price_fetch_job() -> None:
    """Scheduler entrypoint: open a session + httpx client, call fetch_and_cache_prices."""
```

The service uses `settings.PRICE_API_BASE_URL` + the per-metal path and sends the API key (as a header, e.g. `Authorization: Bearer <key>`). The response price is parsed to a float `price_per_gram`.

### 5. Retrain service (`backend/app/services/retrain.py`, new)

Responsible for retraining the prediction model and writing predictions.

```python
MODEL_NAME = "linear_trend"  # simple, dependency-light regression over cached history

def load_gold_history(db: Session) -> list[tuple[datetime, float]]:
    """Return (date, price_per_gram) for gold rows only, ordered by date ascending."""

def train_model(history: list[tuple[datetime, float]]):
    """Fit a model over the historical series and return it. Pure function of history."""

def make_predictions(model, last_date: datetime) -> list[Prediction]:
    """Produce one or more forward Prediction rows (target_date > prediction_date)."""

def retrain_and_store(db: Session, now: datetime) -> None:
    """
    Load gold history, train, and write new Prediction rows in a single transaction.
    On any error, roll back and log; existing Prediction rows are left unchanged.
    """

def run_retrain_job() -> None:
    """Scheduler entrypoint: open a session, call retrain_and_store."""
```

Retraining uses only gold rows; silver rows are excluded from the training set. If there is insufficient history to train, the job logs and exits without writing rows (existing predictions unchanged).

### 6. Portfolio service changes (`backend/app/services/portfolio.py`)

Replace the module constant usage in `get_summary` with a lookup of the latest cached gold price.

```python
from app.core.config import settings
from app.models.gold_price import GoldPrice

GOLD_SOURCES = ("gold", "api")  # "api" retained for backward compatibility

def get_latest_gold_price(db: Session) -> float:
    row = (
        db.query(GoldPrice)
        .filter(GoldPrice.source.in_(GOLD_SOURCES))
        .order_by(GoldPrice.date.desc())
        .first()
    )
    return row.price_per_gram if row is not None else settings.FALLBACK_GOLD_PRICE

def get_summary(db: Session, user_id: str) -> PortfolioSummary:
    purchases = get_purchases(db, user_id)
    current_price = get_latest_gold_price(db)

    total_grams = sum(p.grams for p in purchases)
    total_invested = sum(p.total_amount for p in purchases)
    avg_price = total_invested / total_grams if total_grams > 0 else 0.0
    current_value = total_grams * current_price
    profit_loss = current_value - total_invested

    return PortfolioSummary(
        total_grams=round(total_grams, 2),
        total_invested=round(total_invested, 2),
        avg_price_per_gram=round(avg_price, 2),
        current_price_per_gram=current_price,
        current_value=round(current_value, 2),
        profit_loss=round(profit_loss, 2),
        purchase_count=len(purchases),
    )
```

Silver rows are excluded because the query filters `source` to gold sources only. The `PortfolioSummary` schema and the router are unchanged. The hardcoded `CURRENT_GOLD_PRICE` is superseded by `settings.FALLBACK_GOLD_PRICE`.

### 7. Dependencies (`backend/requirements.txt`)

Add:

```
apscheduler
httpx
```

`httpx` is the HTTP client (synchronous `httpx.Client` is used inside the background job). `scikit-learn`/`numpy` are only required if `train_model` uses them; the default `linear_trend` model can be implemented with the standard library to avoid new heavy dependencies. If a richer model is chosen during implementation, add the corresponding package here.

## Data Models

No schema changes. The existing tables are used as-is.

### `gold_prices` (Price_Cache) — existing `GoldPrice`

| Column | Type | Role in this feature |
|---|---|---|
| `id` | str (uuid) | primary key |
| `date` | datetime (unique, indexed) | write time of the fetched price; used to order and find the latest gold row |
| `price_per_gram` | float | the fetched price |
| `source` | str | `"gold"` for Gold_Row, `"silver"` for Silver_Row, legacy `"api"` treated as gold |
| `created_at` | datetime | server default |

**Unique-`date` constraint consideration.** The `date` column has a `unique=True` constraint across the whole table. Because a single daily run writes both a gold and a silver row, the two rows must not share an identical `date` value or the second insert will violate the constraint. The fetch service therefore assigns distinct timestamps to the gold and silver rows within a run (e.g. gold at `now`, silver at `now` offset by a small delta, or by writing them with their individual fetch completion times). This keeps both rows insertable while preserving "most-recent gold row by `date`" semantics for valuation. No migration is needed since `date` is a full `DateTime` and already carries time precision.

### `predictions` (Prediction_Store) — existing `Prediction`

| Column | Type | Role in this feature |
|---|---|---|
| `id` | str (uuid) | primary key |
| `prediction_date` | datetime | when the retrain ran |
| `target_date` | datetime | future date the prediction is for (`> prediction_date`) |
| `predicted_price` | float | model output |
| `model` | str | model identifier, e.g. `"linear_trend"` |
| `created_at` | datetime | server default |

### Session lifecycle for jobs

Both jobs use `SessionLocal()` directly:

```python
def run_*_job() -> None:
    db = SessionLocal()
    try:
        # ... service call that commits on success ...
    except Exception:
        logger.exception(...)
        db.rollback()
    finally:
        db.close()
```

## Error Handling

- **Price fetch failure (Req 2.5).** If the Price_API is unreachable, times out, or returns a non-success status, `fetch_and_cache_prices` logs the error via the module logger and does not write the affected row. Gold and silver are attempted independently so one failure does not suppress the other. The session is rolled back before close so the Price_Cache is left unchanged for the failed metal.
- **Retrain failure (Req 1.4).** Any exception during history load, model training, or prediction writing is caught, logged, and followed by `db.rollback()`. Because prediction rows are written in a single transaction that only commits on success, existing Prediction rows are never partially modified.
- **Missing configuration.** If `PRICE_API_KEY` is empty, the fetch job logs a warning and skips the network call (fail-safe, no unauthenticated request).
- **Insufficient history.** If there are too few gold rows to train, the retrain job logs and exits without writing, leaving predictions unchanged.
- **No gold row for valuation (Req 3.4).** `get_latest_gold_price` returns `settings.FALLBACK_GOLD_PRICE` (7500.0) when no gold row exists, so `get_summary` always returns a valid summary.
- **Scheduler robustness.** Jobs never raise out of their entrypoints (all exceptions are caught), so a failing run does not stop the scheduler or crash the app. Shutdown uses `wait=False` so app shutdown is not blocked by an in-flight job.

## Testing Strategy

Dual approach: property-based tests for input-varying logic, plus example/integration/smoke tests for wiring and external calls.

- **Property tests** (min. 100 iterations each) target: training-input selection (gold-only), successful-fetch persistence, error-handling invariants, latest-gold-price valuation, silver exclusion, and the no-gold fallback. Jobs are exercised against an in-memory / test DB session, and the Price_API is mocked so no live network is used.
- **Integration test** verifies the fetch job issues requests to the configured base URL with the configured API key (mocked transport).
- **Smoke tests** verify job registration (ids + intervals), scheduler start/stop across the lifespan, Settings fields exist, and requirements list the new packages.

Each property test is tagged `Feature: model-retrain-live-portfolio, Property {number}: {property_text}` and references the design property it validates.

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Retrain trains only on gold history

For any Price_Cache containing an arbitrary mix of gold and silver rows, the training input selected by the Retrain_Job SHALL consist of exactly the gold rows (ordered by date ascending) and SHALL contain no silver rows.

**Validates: Requirements 1.2**

### Property 2: Successful retrain appends valid predictions

For any gold price history sufficient to train, running the Retrain_Job SHALL increase the Prediction_Store row count by at least one, and every new Prediction row SHALL have a finite `predicted_price` and a `target_date` strictly after its `prediction_date`.

**Validates: Requirements 1.3**

### Property 3: Retrain failure preserves predictions

For any pre-existing set of Prediction rows and any error induced during training or writing, after the Retrain_Job completes the Prediction_Store SHALL be identical to its pre-run contents.

**Validates: Requirements 1.4**

### Property 4: Successful fetch persists a correctly-sourced row matching the response

For any successful Price_API response, the Price_Fetch_Job SHALL write exactly one new row whose `price_per_gram` equals the parsed response price, whose `date` is the current run time, and whose `source` marks it as gold for a gold response or as silver (distinct from the gold source) for a silver response.

**Validates: Requirements 2.3, 2.4**

### Property 5: Fetch failure preserves the cache

For any pre-existing Price_Cache contents and any Price_API failure or unsuccessful response for a metal, after the Price_Fetch_Job completes the Price_Cache SHALL contain no new or modified row for that metal.

**Validates: Requirements 2.5**

### Property 6: Valuation uses the latest gold price

For any Price_Cache containing at least one gold row and any set of user purchases, the Portfolio_Summary SHALL set `current_price_per_gram` to the `price_per_gram` of the gold row with the maximum `date`, and SHALL set `current_value` to the user's total held grams multiplied by that price.

**Validates: Requirements 3.1, 3.2, 3.3**

### Property 7: Silver rows never affect the summary

For any Price_Cache and any set of user purchases, adding or removing arbitrary silver rows SHALL NOT change the resulting Portfolio_Summary.

**Validates: Requirements 3.5**

### Property 8: Fallback price when no gold row exists

For any Price_Cache containing no gold rows (empty or silver-only) and any set of user purchases, the Portfolio_Summary SHALL use the fallback gold price of 7500.0 for `current_price_per_gram` and for computing `current_value`.

**Validates: Requirements 3.4**
