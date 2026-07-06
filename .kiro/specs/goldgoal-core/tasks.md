# Implementation Plan: GoldGoal Core (Phase 1)

## Overview

Convert the feature design into a series of prompts for a code-generation LLM that will implement each step with incremental progress. Make sure that each prompt builds on the previous prompts, and ends with wiring things together. There should be no hanging or orphaned code that isn't integrated into a previous step. Focus ONLY on tasks that involve writing, modifying, or testing code.

Implementation language: **Python 3.11+**. New backend lives entirely under `goldgoal/` at the repository root; `ml_models/`, `dashboard/`, `streamlit_app_final.py`, and `data/gold.csv` are read-only for this feature (the CSV is *read* to seed `gold_prices` but not modified). Tests live under `tests/`. Property-based tests use `hypothesis`; unit and integration tests use `pytest`.

Each property-based test sub-task references a single design Correctness Property and the requirement clauses it validates.

## Tasks

- [x] 1. Set up project scaffolding
  - [x] 1.1 Create the `goldgoal/` Python package skeleton and pin dependencies
    - Create empty `__init__.py` files for: `goldgoal/`, `goldgoal/db/`, `goldgoal/models/`, `goldgoal/schemas/`, `goldgoal/services/`, `goldgoal/api/`
    - Append pinned dependencies to `requirements.txt`: `fastapi`, `uvicorn[standard]`, `sqlalchemy>=2.0`, `alembic`, `pydantic>=2`, `pydantic[email]`, `passlib[bcrypt]`, `python-multipart`, `httpx`, `pytest`, `pytest-asyncio`, `hypothesis`
    - Do not modify `ml_models/`, `dashboard/`, `streamlit_app_final.py`, or `data/gold.csv`
    - _Requirements: none (scaffolding)_

  - [x] 1.2 Create the `tests/` directory skeleton
    - Create `tests/__init__.py`, `tests/unit/__init__.py`, `tests/properties/__init__.py`, `tests/integration/__init__.py`
    - Add a top-level `pytest.ini` or `pyproject.toml [tool.pytest.ini_options]` block registering the `perf` marker and `asyncio_mode = auto`
    - _Requirements: none (scaffolding)_

- [x] 2. Implement foundational modules
  - [x] 2.1 Implement `goldgoal/db/session.py`
    - Define the SQLAlchemy `Base = declarative_base()`, an `engine` (SQLite by default, driven by a `GOLDGOAL_DATABASE_URL` env var), `SessionLocal`, and a `get_db()` FastAPI dependency generator
    - _Requirements: none (infrastructure)_

  - [x] 2.2 Implement `goldgoal/errors.py` exception hierarchy
    - Define `GoldGoalError`, `ValidationError(field, message)`, `AuthenticationError` (with class-level constant `MESSAGE = "Invalid email or password"`), `UnauthorizedError` (`MESSAGE = "Authentication required"`), `ConflictError`, `NotFoundError`, `PriceUnavailableError`
    - Do not register FastAPI exception handlers here yet; that happens in the main app factory in task 15.2
    - _Requirements: 1.3, 2.2, 2.3, 2.5, 4.4, 6.8, 10.5_

  - [x] 2.3 Implement `goldgoal/security.py`
    - `hash_password(password: str) -> str` using `passlib.hash.bcrypt` (per-user salt embedded in the hash)
    - `verify_password(password: str, password_hash: str) -> bool`
    - `new_session_token() -> str` returning `secrets.token_urlsafe(32)`
    - `SESSION_TTL = timedelta(hours=24)` module constant
    - _Requirements: 1.2, 2.7_

- [ ] 3. Implement SQLAlchemy ORM models
  - [ ] 3.1 Implement `goldgoal/models/user.py`
    - `User` table with `id` (UUID PK), `email` (VARCHAR(320), unique, lowercased-on-insert via `@validates`), `password_hash` (VARCHAR(255) NOT NULL), `created_at` (TIMESTAMPTZ default now)
    - _Requirements: 1.1, 1.2, 1.3_

  - [ ] 3.2 Implement `goldgoal/models/session_token.py`
    - `SessionToken` table with `token` (VARCHAR(64) PK), `user_id` (FK users.id, indexed), `issued_at`, `expires_at`, `revoked_at` (nullable)
    - _Requirements: 2.1, 2.6, 2.7_

  - [ ] 3.3 Implement `goldgoal/models/purchase.py`
    - `Purchase` table with `id`, `user_id` (FK), `grams` (`Numeric(18, 4)`, CHECK > 0), `price_per_gram` (`Numeric(18, 2)`, CHECK >= 0), `purchase_date` (DATE), `source_notes` (VARCHAR(500) nullable), `created_at`, `updated_at`
    - Composite index `(user_id, purchase_date DESC, created_at DESC)`
    - _Requirements: 3.1, 3.6, 4.1_

  - [ ] 3.4 Implement `goldgoal/models/goal.py`
    - `Goal` table with `id`, `user_id` (FK), `target_grams` (Numeric(18,4), CHECK > 0), `target_date` (DATE), `current_holdings_grams` (Numeric(18,4), CHECK >= 0), `monthly_budget_inr` (Numeric(18,2), CHECK >= 0), `created_at`, `updated_at`
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ] 3.5 Implement `goldgoal/models/gold_price.py`
    - `GoldPrice` table with `id`, `price_date` (DATE), `price_per_gram` (Numeric(18,2), CHECK >= 0), `created_at`
    - Composite index `(price_date DESC, created_at DESC)`
    - _Requirements: 8.1, 8.3_

- [ ] 4. Implement Pydantic request/response schemas
  - [ ] 4.1 Implement `goldgoal/schemas/auth.py`
    - `RegisterRequest`, `LoginRequest`, `UserResponse` (id, email, created_at — no `password_hash`), `LoginResponse` (`token`, `expires_at`), `LogoutResponse`
    - Enforce `EmailStr` on `email` and `min_length=8` on `password`
    - _Requirements: 1.1, 1.4, 1.5, 1.6, 2.1_

  - [ ] 4.2 Implement `goldgoal/schemas/purchase.py`
    - `PurchaseCreate` (`grams > 0`, `price_per_gram >= 0`, `purchase_date: date`, `source_notes: str | None` with `max_length=500`), `PurchaseUpdate` (all fields optional, same bounds), `PurchaseResponse`
    - _Requirements: 3.1, 3.2, 3.3, 3.5, 4.2_

  - [ ] 4.3 Implement `goldgoal/schemas/goal.py`
    - `GoalCreate` (`target_grams > 0`, `target_date: date`, `current_holdings_grams >= 0`, `monthly_budget_inr >= 0`), `GoalUpdate`, `GoalResponse`, `GoalProgressResponse` (`goal_id`, `current_grams`, `progress_percent`, `remaining_grams`, `required_monthly_investment_inr`, `savings_sufficient`, `price_available`, `months_remaining`)
    - _Requirements: 6.1, 6.2, 6.4, 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ] 4.4 Implement `goldgoal/schemas/portfolio.py`
    - `PortfolioSummaryResponse` (`total_grams`, `total_invested`, `average_purchase_price` nullable, `current_portfolio_value` nullable, `price_available`)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_

  - [ ] 4.5 Implement `goldgoal/schemas/price.py`
    - `LatestPriceResponse` (`price_per_gram`, `price_date`, `price_available`) — allow all payload fields to be nullable when `price_available` is false
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ] 4.6 Implement `goldgoal/schemas/dashboard.py`
    - `DashboardResponse` composing `PortfolioSummaryResponse`, `list[GoalProgressResponse]`, `list[PurchaseResponse]` (recent), and `LatestPriceResponse`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 5. Build test infrastructure and schema-level checks
  - [ ] 5.1 Implement `tests/conftest.py`
    - `db_engine` (in-memory SQLite, `StaticPool`, `check_same_thread=False`), per-test `db_session` fixture that opens a nested transaction and rolls back on teardown
    - `app_client` fixture that builds the FastAPI app (once task 15.2 exists) with a `get_db` override pointing at the test session; use `httpx.AsyncClient` + `ASGITransport`
    - Factory fixtures: `make_user`, `make_purchase`, `make_goal`, `make_gold_price`
    - _Requirements: none (test infra)_

  - [ ] 5.2 Implement `tests/generators.py`
    - Hypothesis strategies: `valid_email()`, `valid_password()`, `positive_decimal(max)` (grams, 4 dp), `non_negative_inr(max)` (INR, 2 dp), `past_or_today_date()`, `future_date(min_offset_days=1)`, `notes(max_len=500)`, `overlong_notes()`, `malformed_email()`
    - Compose date strategies with `date.today()` cached at module import to keep runs deterministic
    - _Requirements: none (test infra)_

  - [ ]* 5.3 Write unit test for response-schema hygiene
    - `tests/unit/test_response_schemas.py`: introspect every Pydantic model in `goldgoal.schemas` and assert `"password_hash" not in Model.model_fields` for every response model
    - _Requirements: 1.6_

  - [ ]* 5.4 Write property test for password hashing
    - `tests/properties/test_auth_properties.py::test_password_hashing_property`
    - **Property 1: Password hashing is a verifying, non-identity, salted transform**
    - **Validates: Requirements 1.2**
    - Use `@settings(max_examples=100)`; assert `hash != password`, `verify(password, hash) is True`, `verify(password + suffix, hash) is False` for any non-empty suffix, and `hash_password(pw) != hash_password(pw)` (bcrypt salting)

- [ ] 6. Implement Auth_Service and its property tests
  - [ ] 6.1 Implement `goldgoal/services/auth_service.py::register`
    - Lowercase email, hash password, insert `User`, catch `IntegrityError` and re-raise as `ConflictError` (belt-and-suspenders on the DB unique index)
    - Raise `ValidationError(field="email")` for malformed email and `ValidationError(field="password")` for `len(password) < 8` — the router will surface Pydantic errors too, but the service must remain safe when called directly
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

  - [ ]* 6.2 Write property test for registration uniqueness
    - `tests/properties/test_auth_properties.py::test_registration_uniqueness_property`
    - **Property 2: Registration enforces email uniqueness**
    - **Validates: Requirements 1.1, 1.3**

  - [ ] 6.3 Implement `auth_service.login`
    - Lookup user by lowercased email; if missing OR `verify_password` fails, raise `AuthenticationError` with the same message in both branches; on success insert a `SessionToken` row with `issued_at=now`, `expires_at=now+SESSION_TTL`, `revoked_at=None`, and return it
    - _Requirements: 2.1, 2.2, 2.3, 2.7_

  - [ ]* 6.4 Write property test for login credential exactness
    - `tests/properties/test_auth_properties.py::test_login_credentials_property`
    - **Property 3: Login accepts exact credentials and produces a uniform error otherwise**
    - **Validates: Requirements 2.1, 2.2, 2.3**
    - Assert the exception's message string is byte-identical across "no such email" and "wrong password" branches

  - [ ] 6.5 Implement `auth_service.validate_session` and `auth_service.logout`
    - `validate_session(db, token)` selects the row and rejects with `UnauthorizedError` if missing, `revoked_at IS NOT NULL`, or `expires_at <= now`; otherwise returns the associated `User`
    - `logout(db, token)` sets `revoked_at = now` (idempotent if already revoked; still raises `UnauthorizedError` if the token was never issued)
    - _Requirements: 2.4, 2.5, 2.6_

  - [ ]* 6.6 Write property test for session token lifecycle
    - `tests/properties/test_auth_properties.py::test_session_lifecycle_property`
    - **Property 4: Session token lifecycle governs authorization**
    - **Validates: Requirements 2.4, 2.5, 2.6**
    - Cover: valid-and-not-expired ⇒ succeed; after logout ⇒ unauthorized; after `expires_at` passes ⇒ unauthorized (manipulate `expires_at` in DB to simulate); never-issued token ⇒ unauthorized

  - [ ]* 6.7 Write property test for session TTL bound
    - `tests/properties/test_auth_properties.py::test_session_ttl_property`
    - **Property 5: Session tokens expire within 24 hours**
    - **Validates: Requirements 2.7**

- [ ] 7. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Implement Price_Service and its property test
  - [ ] 8.1 Implement `goldgoal/services/price_service.py::latest`
    - `SELECT * FROM gold_prices ORDER BY price_date DESC, created_at DESC LIMIT 1`; return the row or `None` when the table is empty
    - _Requirements: 8.1, 8.2, 8.3_

  - [ ]* 8.2 Write property test for latest-price selection
    - `tests/properties/test_price_properties.py::test_latest_price_property`
    - **Property 12: Latest gold price is the maximum by (price_date, created_at)**
    - **Validates: Requirements 8.1, 8.3**

- [ ] 9. Implement Purchase_Service and its property tests
  - [ ] 9.1 Implement `purchase_service.create_purchase`
    - Enforce `grams > 0`, `price_per_gram >= 0`, `purchase_date <= date.today()`, `len(source_notes or "") <= 500`, each raising `ValidationError(field=...)` naming exactly the offending field
    - Always set `user_id` from the session (never from request input), even if a `user_id` is supplied in the payload
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

  - [ ]* 9.2 Write property test for purchase-create round-trip
    - `tests/properties/test_purchase_properties.py::test_purchase_create_roundtrip_property`
    - **Property 6: Purchase create is a round-trip owned by the session user**
    - **Validates: Requirements 3.1, 3.6**

  - [ ] 9.3 Implement `purchase_service` list / get / update / delete
    - `list_purchases`: `ORDER BY purchase_date DESC, created_at DESC` and filter by `user_id`
    - `get_purchase`, `update_purchase`, `delete_purchase`: filter by `(id, user_id)`; return `NotFoundError` when the row does not exist OR is owned by a different user (indistinguishable to callers)
    - `update_purchase` re-runs the create-time validation rules; a validation failure leaves the row unchanged
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [ ]* 9.4 Write property test for invalid-purchase rejection
    - `tests/properties/test_purchase_properties.py::test_purchase_invalid_field_property`
    - **Property 7: Invalid purchase fields are rejected identifying the offending field, with no state change**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 4.5**

  - [ ]* 9.5 Write model-based property test for purchase CRUD
    - `tests/properties/test_purchase_properties.py::PurchaseStateMachine` using `hypothesis.stateful.RuleBasedStateMachine`
    - Rules: `rule_create`, `rule_update`, `rule_delete`; invariant: after every rule, `set(list_purchases(user)) == set(shadow.values())` sorted per Req 4.1
    - **Property 8: Purchase CRUD is equivalent to a shadow model**
    - **Validates: Requirements 4.1, 4.2, 4.3**

- [ ] 10. Implement Portfolio_Service and its property test
  - [ ] 10.1 Implement `portfolio_service.summary`
    - Single query for `SUM(grams)` and `SUM(grams * price_per_gram)` filtered by `user_id`
    - When sums are null, return `total_grams=0`, `total_invested=0`, `average_purchase_price=None`
    - When `total_grams > 0`, compute `average_purchase_price = total_invested / total_grams` with full-precision `Decimal`
    - Call `price_service.latest`; if `None`, set `current_portfolio_value=None`, `price_available=False`; else `current_portfolio_value = total_grams * price.price_per_gram`
    - Apply `.quantize(Decimal("0.0001"))` to grams and `.quantize(Decimal("0.01"), ROUND_HALF_UP)` to INR at the response boundary
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 10.3_

  - [ ]* 10.2 Write property test for portfolio analytics
    - `tests/properties/test_portfolio_properties.py::test_portfolio_analytics_property`
    - **Property 9: Portfolio analytics equal direct sums and preserve incremental deltas**
    - **Validates: Requirements 5.1, 5.2, 5.3, 5.5, 5.7**
    - Use `@settings(max_examples=200)`; check `total_invested == avg * total_grams` and the delta invariants for add/delete within 2 dp (INR) / 4 dp (grams) tolerance

- [ ] 11. Implement Goal_Service and its property tests
  - [ ] 11.1 Implement `goal_service` CRUD (`create_goal`, `list_goals`, `get_goal`, `update_goal`, `delete_goal`)
    - Enforce `target_grams > 0`, `target_date > date.today()`, `current_holdings_grams >= 0`, `monthly_budget_inr >= 0`, each raising `ValidationError(field=...)`
    - Ownership scoping mirrors `purchase_service`: `NotFoundError` when the row is missing or owned by another user
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 10.2_

  - [ ]* 11.2 Write property test for goal CRUD
    - `tests/properties/test_goal_properties.py::test_goal_crud_property`
    - **Property 10: Goal CRUD is a round-trip with per-field validation**
    - **Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7**

  - [ ] 11.3 Implement `goal_service.progress`
    - Compute `current_grams` by calling `portfolio_service.summary(db, user_id).total_grams` (this call is what makes Req 9.5 hold when the dashboard composes)
    - Implement `months_between(a, b) = (b.year - a.year) * 12 + (b.month - a.month) + 1` and `months_remaining = max(1, months_between(today, target_date))`
    - Branch precisely per Req 7:
      - `current_grams >= target_grams` ⇒ `progress_percent=100`, `remaining_grams=0`, `required_monthly_investment_inr=0`, `savings_sufficient=True`
      - Else if `today >= target_date` ⇒ `required_monthly_investment_inr=None`, `savings_sufficient=False`
      - Else if no latest price ⇒ `required_monthly_investment_inr=None`, `savings_sufficient=None`, `price_available=False`
      - Else compute `required_monthly_investment_inr = (remaining_grams * price.price_per_gram) / months_remaining` and `savings_sufficient = monthly_budget_inr >= required_monthly_investment_inr`
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_

  - [ ]* 11.4 Write property test for goal progress algebra
    - `tests/properties/test_goal_properties.py::test_goal_progress_property`
    - **Property 11: Goal progress obeys the specified algebra**
    - **Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7**
    - Cover all seven conjuncts (a)–(g) from the design, using `@settings(max_examples=200)`

- [ ] 12. Implement Dashboard_Service and its property test
  - [ ] 12.1 Implement `dashboard_service.dashboard`
    - In one DB session/transaction: call `portfolio_service.summary`, `goal_service.list_goals` + `goal_service.progress` per goal, `purchase_service.list_purchases(...)[:5]`, and `price_service.latest`
    - Return the composed `DashboardResponse`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.4_

  - [ ]* 12.2 Write property test for dashboard composition
    - `tests/properties/test_dashboard_properties.py::test_dashboard_composition_property`
    - **Property 13: Dashboard is a coherent composition of the underlying services**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [ ] 13. Checkpoint - Ensure all tests pass, ask the user if questions arise.

- [ ] 14. Implement the FastAPI API layer
  - [ ] 14.1 Implement `goldgoal/api/deps.py`
    - `get_current_user(request, db)` reads `Authorization: Bearer <token>`, calls `auth_service.validate_session`, and returns the `User`; missing/malformed header ⇒ `UnauthorizedError`
    - _Requirements: 2.4, 2.5, 10.5_

  - [ ] 14.2 Implement `goldgoal/api/auth.py` router
    - `POST /api/v1/auth/register` (unauthenticated), `POST /api/v1/auth/login` (unauthenticated), `POST /api/v1/auth/logout` (authenticated) — thin translation between HTTP and service calls
    - _Requirements: 1.1, 2.1, 2.6_

  - [ ] 14.3 Implement `goldgoal/api/purchases.py` router
    - `GET /api/v1/purchases`, `POST /api/v1/purchases`, `PATCH /api/v1/purchases/{id}`, `DELETE /api/v1/purchases/{id}` — all authenticated; `user_id` always taken from `get_current_user`
    - _Requirements: 3.1, 3.6, 4.1, 4.2, 4.3, 4.4, 10.1_

  - [ ] 14.4 Implement `goldgoal/api/goals.py` router
    - `GET /api/v1/goals`, `POST /api/v1/goals`, `PATCH /api/v1/goals/{id}`, `DELETE /api/v1/goals/{id}`, `GET /api/v1/goals/{id}/progress`
    - _Requirements: 6.1, 6.5, 6.6, 6.7, 6.8, 7.1, 10.2_

  - [ ] 14.5 Implement `goldgoal/api/portfolio.py` router
    - `GET /api/v1/portfolio/summary`
    - _Requirements: 5.1, 10.3_

  - [ ] 14.6 Implement `goldgoal/api/price.py` router
    - `GET /api/v1/price/latest`
    - _Requirements: 8.1, 8.2_

  - [ ] 14.7 Implement `goldgoal/api/dashboard.py` router
    - `GET /api/v1/dashboard`
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 10.4_

- [ ] 15. Wire the application together
  - [ ] 15.1 Implement `goldgoal/db/seed.py`
    - Read `data/gold.csv` with a small stdlib CSV loader (no import from `ml_models`); parse the `Date` column and the `Price` (per-10g INR) column; insert one `GoldPrice` row per date with `price_per_gram = Price / Decimal("10")` (document the divisor in the module docstring)
    - Idempotent: no-op when the `gold_prices` table already has rows
    - _Requirements: 8.1_

  - [ ] 15.2 Implement `goldgoal/main.py` app factory
    - `create_app()` builds a `FastAPI` instance, registers all routers under `/api/v1`, installs exception handlers mapping the domain exceptions to the status codes and envelopes defined in the design's Error Handling table, and calls `Base.metadata.create_all(engine)` + `seed.load_if_empty(db)` on startup
    - Also reshape `RequestValidationError` into the domain `{"error": "validation", "field": ..., "message": ...}` envelope so field errors are consistent whether they came from Pydantic or a service
    - _Requirements: 1.3, 1.4, 1.5, 2.2, 2.3, 2.5, 3.2, 3.3, 3.4, 3.5, 4.4, 6.2, 6.3, 6.4, 6.8, 10.5_

- [ ] 16. Cross-cutting tests
  - [ ]* 16.1 Write property test for per-user data isolation
    - `tests/properties/test_isolation_properties.py::test_data_isolation_property`
    - **Property 14: Per-user data isolation across every service**
    - **Validates: Requirements 3.6, 4.4, 6.8, 10.1, 10.2, 10.3, 10.4, 10.5**

  - [ ]* 16.2 Write HTTP contract tests
    - `tests/unit/test_http_contracts.py`: one test per row of the Error Handling table (validation ⇒ 400, authentication ⇒ 401, unauthorized ⇒ 401, conflict ⇒ 409, not-found ⇒ 404, internal ⇒ 500)
    - Assert both HTTP status code and JSON envelope shape
    - _Requirements: 1.3, 1.4, 1.5, 2.2, 2.3, 2.5, 4.4, 6.8, 10.5_

  - [ ]* 16.3 Write empty-state unit tests
    - `tests/unit/test_empty_states.py`: user with zero purchases returns `total_grams=0, total_invested=0, average_purchase_price=None`; database with zero gold prices returns `current_portfolio_value=None, price_available=False` on portfolio, `required_monthly_investment_inr=None, savings_sufficient=None, price_available=False` on goal progress, and empty result with `price_available=False` on `/price/latest`
    - _Requirements: 5.4, 5.6, 7.8, 8.2_

  - [ ]* 16.4 Write malformed-email unit tests
    - `tests/unit/test_malformed_email.py`: curated list of malformed patterns (missing `@`, missing domain, leading/trailing whitespace, empty local part, invalid Unicode) each returning a validation error naming `email`
    - _Requirements: 1.5_

- [ ] 17. Performance tests
  - [ ]* 17.1 Write dashboard performance test
    - `tests/integration/test_dashboard_perf.py` (marked `@pytest.mark.perf`): seed one user with 1,000 randomly generated purchases and 10 goals, invoke `GET /api/v1/dashboard` 100 times via in-process ASGI transport, assert p95 latency < 1,000 ms
    - _Requirements: 11.1_

  - [ ]* 17.2 Write portfolio and goal-progress performance test
    - `tests/integration/test_analytics_perf.py` (marked `@pytest.mark.perf`): same dataset, hit `GET /api/v1/portfolio/summary` and each `GET /api/v1/goals/{id}/progress` 100 times, assert p95 < 500 ms on each
    - _Requirements: 11.2_

- [ ] 18. Final checkpoint - Ensure all tests pass, ask the user if questions arise.

## Notes

- Sub-tasks marked with `*` are optional and can be skipped for a faster MVP; they cover property-based tests, unit tests, and integration/performance tests.
- Every property-based test sub-task references exactly one design Correctness Property (Property 1–14) and lists the requirement clauses it validates, so traceability runs in both directions.
- Property tests live close to their implementation task so drift is caught early.
- No task modifies `ml_models/`, `dashboard/`, or `streamlit_app_final.py`; the new backend is self-contained under `goldgoal/` and reads `data/gold.csv` in a read-only fashion at first startup only.
- Two mid-flight checkpoints (tasks 7 and 13) plus a final checkpoint (task 18) give clean rollback points.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["1.2", "2.1", "2.2", "2.3"] },
    { "id": 2, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5"] },
    { "id": 3, "tasks": ["4.1", "4.2", "4.3", "4.4", "4.5", "4.6"] },
    { "id": 4, "tasks": ["5.1", "5.2", "5.3"] },
    { "id": 5, "tasks": ["5.4", "6.1", "8.1", "9.1", "11.1"] },
    { "id": 6, "tasks": ["6.2", "6.3", "8.2", "9.2", "9.3", "10.1", "11.2"] },
    { "id": 7, "tasks": ["6.4", "6.5", "9.4", "10.2", "11.3"] },
    { "id": 8, "tasks": ["6.6", "9.5", "11.4", "12.1"] },
    { "id": 9, "tasks": ["6.7", "12.2"] },
    { "id": 10, "tasks": ["14.1"] },
    { "id": 11, "tasks": ["14.2", "14.3", "14.4", "14.5", "14.6", "14.7", "15.1"] },
    { "id": 12, "tasks": ["15.2"] },
    { "id": 13, "tasks": ["16.1", "16.2", "16.3", "16.4"] },
    { "id": 14, "tasks": ["17.1", "17.2"] }
  ]
}
```
