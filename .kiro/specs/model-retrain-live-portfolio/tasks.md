# Implementation Plan: model-retrain-live-portfolio

## Overview

This plan wires an in-process APScheduler into the FastAPI lifespan and adds two scheduled jobs plus live-price-driven portfolio valuation. Work is grounded in the existing `backend/app` layout: settings in `core/config.py`, a new `core/scheduler.py`, lifespan changes in `main.py`, two new services (`services/price_fetch.py`, `services/retrain.py`), changes to `services/portfolio.py`, and new deps in `requirements.txt`. Each step builds on the previous one and ends by wiring everything through the application lifespan. Property tests validate the 8 correctness properties from the design.

## Tasks

- [ ] 1. Add dependencies and settings
  - [ ] 1.1 Add scheduling and HTTP client dependencies
    - Add `apscheduler` and `httpx` to `backend/requirements.txt`
    - _Requirements: 4.1_

  - [ ] 1.2 Extend Settings with Price_API and scheduling configuration
    - In `backend/app/core/config.py`, add `PRICE_API_BASE_URL`, `PRICE_API_KEY`, `PRICE_API_GOLD_PATH`, `PRICE_API_SILVER_PATH`, `PRICE_API_TIMEOUT_SECONDS`
    - Add `PRICE_FETCH_INTERVAL_DAYS` (default 1), `RETRAIN_INTERVAL_DAYS` (default 30), `FALLBACK_GOLD_PRICE` (default 7500.0)
    - Keep all fields overridable via `.env`
    - _Requirements: 4.2_

  - [ ]* 1.3 Write smoke test for Settings fields and requirements
    - Assert new Settings fields exist with expected defaults
    - Assert `apscheduler` and `httpx` appear in `requirements.txt`
    - _Requirements: 4.1, 4.2_

- [ ] 2. Implement price fetch service
  - [ ] 2.1 Implement fetch and cache logic in `services/price_fetch.py`
    - Define `GOLD_SOURCE = "gold"`, `SILVER_SOURCE = "silver"`, and a module logger
    - Implement `fetch_price(client, path)` calling `settings.PRICE_API_BASE_URL + path` with the API key sent as an `Authorization: Bearer` header; parse and return `price_per_gram` as float
    - Implement `write_price_row(db, price, source, at)` persisting one `GoldPrice` row
    - Implement `fetch_and_cache_prices(db, client, now)` that fetches gold and silver independently, assigns distinct `date` timestamps to the two rows (to respect the unique-`date` constraint), commits on success, and on error logs + rolls back the affected metal only
    - Skip the network call with a warning when `PRICE_API_KEY` is empty
    - _Requirements: 2.2, 2.3, 2.4, 2.5_

  - [ ]* 2.2 Write property test for successful fetch persistence
    - **Property 4: Successful fetch persists a correctly-sourced row matching the response**
    - **Validates: Requirements 2.3, 2.4**

  - [ ]* 2.3 Write property test for fetch failure preserving cache
    - **Property 5: Fetch failure preserves the cache**
    - **Validates: Requirements 2.5**

  - [ ] 2.4 Implement the scheduler entrypoint `run_price_fetch_job`
    - Open `SessionLocal()` and an `httpx.Client`, call `fetch_and_cache_prices`, catch/log all exceptions, close resources in `finally`
    - _Requirements: 2.2_

  - [ ]* 2.5 Write integration test for Price_API request wiring
    - Use a mocked httpx transport to assert requests go to the configured base URL + path with the configured API key header
    - _Requirements: 2.2_

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 4. Implement retrain service
  - [ ] 4.1 Implement training and prediction logic in `services/retrain.py`
    - Define `MODEL_NAME = "linear_trend"` and a module logger
    - Implement `load_gold_history(db)` returning `(date, price_per_gram)` for gold rows only (sources gold + legacy `api`), ordered by date ascending
    - Implement `train_model(history)` as a pure function fitting a linear trend using the standard library
    - Implement `make_predictions(model, last_date)` producing one or more `Prediction` rows with `target_date > prediction_date` and finite `predicted_price`
    - Implement `retrain_and_store(db, now)` writing new predictions in a single transaction; on insufficient history or any error, log + rollback leaving existing predictions unchanged
    - _Requirements: 1.2, 1.3, 1.4_

  - [ ]* 4.2 Write property test for gold-only training input
    - **Property 1: Retrain trains only on gold history**
    - **Validates: Requirements 1.2**

  - [ ]* 4.3 Write property test for valid appended predictions
    - **Property 2: Successful retrain appends valid predictions**
    - **Validates: Requirements 1.3**

  - [ ]* 4.4 Write property test for retrain failure preserving predictions
    - **Property 3: Retrain failure preserves predictions**
    - **Validates: Requirements 1.4**

  - [ ] 4.5 Implement the scheduler entrypoint `run_retrain_job`
    - Open `SessionLocal()`, call `retrain_and_store`, catch/log all exceptions, close session in `finally`
    - _Requirements: 1.2_

- [ ] 5. Update portfolio valuation to use the latest cached gold price
  - [ ] 5.1 Implement latest-gold-price lookup and update `get_summary`
    - In `backend/app/services/portfolio.py`, add `GOLD_SOURCES = ("gold", "api")` and `get_latest_gold_price(db)` returning the `price_per_gram` of the gold row with max `date`, or `settings.FALLBACK_GOLD_PRICE` when none exists
    - Update `get_summary` to compute `current_value` and `current_price_per_gram` from the latest gold price; remove reliance on the hardcoded `CURRENT_GOLD_PRICE`
    - Ensure silver rows are excluded via the source filter
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 5.2 Write property test for valuation using latest gold price
    - **Property 6: Valuation uses the latest gold price**
    - **Validates: Requirements 3.1, 3.2, 3.3**

  - [ ]* 5.3 Write property test for silver rows never affecting the summary
    - **Property 7: Silver rows never affect the summary**
    - **Validates: Requirements 3.5**

  - [ ]* 5.4 Write property test for fallback price when no gold row exists
    - **Property 8: Fallback price when no gold row exists**
    - **Validates: Requirements 3.4**

- [ ] 6. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Wire the scheduler into the application lifespan
  - [ ] 7.1 Create the scheduler module `core/scheduler.py`
    - Instantiate a `BackgroundScheduler` singleton
    - Implement `start_scheduler()` registering `run_price_fetch_job` (interval = `PRICE_FETCH_INTERVAL_DAYS`, id `Price_Fetch_Job`) and `run_retrain_job` (interval = `RETRAIN_INTERVAL_DAYS`, id `Retrain_Job`) with `replace_existing=True`, then start
    - Implement `stop_scheduler()` shutting down with `wait=False` when running
    - _Requirements: 1.1, 2.1, 4.3, 4.4_

  - [ ] 7.2 Integrate the scheduler into `main.py` lifespan
    - Call `start_scheduler()` after `Base.metadata.create_all` on startup and `stop_scheduler()` in a `finally` after `yield`
    - _Requirements: 4.3, 4.4_

  - [ ]* 7.3 Write smoke test for job registration and lifespan start/stop
    - Assert both jobs register with correct ids and interval days
    - Assert the scheduler starts and stops across the lifespan
    - _Requirements: 1.1, 2.1, 4.3, 4.4_

- [ ] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Property tests (min. 100 iterations) exercise services against a test DB session with the Price_API mocked; no live network is used.
- No schema changes are required; `gold_prices` is reused as the Price_Cache with `source` distinguishing gold from silver.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2"] },
    { "id": 1, "tasks": ["1.3", "2.1", "4.1", "5.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "2.4", "4.2", "4.3", "4.4", "4.5", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["2.5", "7.1"] },
    { "id": 4, "tasks": ["7.2"] },
    { "id": 5, "tasks": ["7.3"] }
  ]
}
```
