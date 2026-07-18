# Requirements Document

## Introduction

This feature adds three capabilities to the GoldGoal FastAPI backend:

1. A scheduled job that retrains the price-prediction model every 30 days from stored historical prices and writes fresh prediction rows.
2. A scheduled job that fetches live gold and silver prices from an external HTTP price API on a daily interval and caches them in the existing `gold_prices` table.
3. On-demand portfolio valuation that replaces the hardcoded gold price with the most recent cached gold price.

Scheduling runs in-process using APScheduler started from the FastAPI application lifespan. The `gold_prices` table is reused as the price cache: the most-recent gold row is the cached latest gold price, and silver prices are stored as separate rows distinguished by the `source`/symbol value. Portfolio valuation remains gold-only; silver is cached for display purposes and is not used in portfolio calculations. The `Purchase` model is not changed.

## Glossary

- **Scheduler**: The APScheduler instance created and started within the FastAPI application lifespan in `backend/app/main.py`.
- **Price_Fetch_Job**: The scheduled job that retrieves live gold and silver prices from the Price_API and writes them to the Price_Cache.
- **Retrain_Job**: The scheduled job that retrains the prediction model from stored historical prices and writes new Prediction rows.
- **Price_API**: The external HTTP service that returns current gold and silver prices, configured via a base URL and API key in application settings.
- **Price_Cache**: The existing `gold_prices` database table, reused to store the latest fetched gold and silver prices as rows.
- **Latest_Gold_Price**: The `price_per_gram` value of the most-recent gold row in the Price_Cache, determined by the `date` column.
- **Gold_Row**: A `gold_prices` row whose `source`/symbol value identifies it as a gold price.
- **Silver_Row**: A `gold_prices` row whose `source`/symbol value identifies it as a silver price.
- **Prediction_Store**: The existing `predictions` database table holding Prediction rows.
- **Portfolio_Service**: The service in `backend/app/services/portfolio.py` that computes portfolio summaries.
- **Portfolio_Summary**: The computed result containing total grams, total invested, average price, current price per gram, current value, profit/loss, and purchase count for a user.
- **Settings**: The application configuration object in `backend/app/core/config.py`.

## Requirements

### Requirement 1

**User Story:** As a system operator, I want the prediction model to retrain automatically every 30 days, so that predictions stay current without manual intervention.

#### Acceptance Criteria

1. WHEN the FastAPI application starts, THE Scheduler SHALL register the Retrain_Job with an interval of 30 days.
2. WHEN the Retrain_Job runs, THE Retrain_Job SHALL train the prediction model using the historical gold prices stored in the Price_Cache.
3. WHEN the Retrain_Job completes training successfully, THE Retrain_Job SHALL write one or more new Prediction rows to the Prediction_Store.
4. IF the Retrain_Job raises an error during training or writing, THEN THE Retrain_Job SHALL log the error and leave the existing Prediction rows unchanged.

### Requirement 2

**User Story:** As a system operator, I want live gold and silver prices fetched daily and cached, so that the application uses recent market prices.

#### Acceptance Criteria

1. WHEN the FastAPI application starts, THE Scheduler SHALL register the Price_Fetch_Job with an interval of 1 day.
2. WHEN the Price_Fetch_Job runs, THE Price_Fetch_Job SHALL request the current gold price and the current silver price from the Price_API using the base URL and API key from Settings.
3. WHEN the Price_Fetch_Job receives a successful gold price response, THE Price_Fetch_Job SHALL write a Gold_Row to the Price_Cache with the fetched price and the current date.
4. WHEN the Price_Fetch_Job receives a successful silver price response, THE Price_Fetch_Job SHALL write a Silver_Row to the Price_Cache with the fetched price and the current date, distinguished from Gold_Rows by its source value.
5. IF the Price_API request fails or returns an unsuccessful response, THEN THE Price_Fetch_Job SHALL log the error and leave the existing Price_Cache rows unchanged.

### Requirement 3

**User Story:** As an investor, I want my portfolio's current value based on the latest cached gold price, so that I can see an up-to-date valuation instead of a fixed placeholder.

#### Acceptance Criteria

1. WHEN a user requests a Portfolio_Summary, THE Portfolio_Service SHALL read the Latest_Gold_Price from the Price_Cache.
2. WHEN the Portfolio_Service computes current value, THE Portfolio_Service SHALL multiply the user's total held grams by the Latest_Gold_Price.
3. WHEN the Portfolio_Service returns a Portfolio_Summary, THE Portfolio_Service SHALL set the current price per gram field to the Latest_Gold_Price.
4. IF no Gold_Row exists in the Price_Cache, THEN THE Portfolio_Service SHALL compute the Portfolio_Summary using the fallback gold price value of 7500.0.
5. THE Portfolio_Service SHALL exclude Silver_Rows from all Portfolio_Summary calculations.

### Requirement 4

**User Story:** As a developer, I want the scheduling and HTTP dependencies configured, so that the in-process jobs and external price fetch operate reliably.

#### Acceptance Criteria

1. THE backend requirements SHALL include the APScheduler package and an HTTP client package.
2. THE Settings SHALL define a configurable Price_API base URL and API key.
3. WHERE the FastAPI application lifespan runs on startup, THE Scheduler SHALL be started.
4. WHEN the FastAPI application shuts down, THE Scheduler SHALL be stopped.
