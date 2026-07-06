# GoldGoal Project Roadmap

End-to-end phased plan that runs from what the user touches down to how the app runs on AWS. Each phase produces something usable on its own; later phases build on earlier ones without forcing a rewrite.

- Companion documents: `plan.md` (product vision), `.kiro/specs/goldgoal-core/` (Phase 1 spec — requirements, design, tasks).
- Canonical units: INR for money, gold-equivalent grams for holdings.
- Read-only assets from the existing repo: `ml_models/` (prediction pipeline), `dashboard/` (Streamlit reference), `data/gold.csv` (bootstrap seed).

## Target Tech Stack

| Area | Technologies |
|---|---|
| Backend | FastAPI, PostgreSQL, JWT auth, REST APIs |
| Frontend | React (generated via Google AI Studio), hosted on S3 + CloudFront |
| Cloud (AWS) | IAM, VPC, RDS, ECS Fargate, Lambda, EventBridge, SNS, SES, CloudWatch, Secrets Manager, S3, CloudFront, ALB, Route 53, ACM |
| DevOps | Docker, Docker Compose, Nginx (dev only), Shell scripting, Terraform |
| Registry | GitHub Container Registry (ghcr.io) |
| CI/CD | GitHub Actions, automated testing, Docker build, ECS deployment, S3 sync for frontend |
| Monitoring | Prometheus, Grafana, CloudWatch |
| MLOps | Model serving, background workers, scheduled jobs, prediction pipeline |

## Target AWS Architecture

```
                   Route 53  ──▶  ACM (TLS)
                       │
              ┌────────┴────────┐
              ▼                 ▼
        CloudFront          Internet-facing ALB
        (React SPA)               │
        served from S3       ┌────┴────┐
              │               ▼        ▼
              │          ECS Fargate   S3 (static)
              │          goldgoal-api  ├─ model artefacts
              │          (FastAPI)     ├─ PDF reports
              │               │        └─ frontend build
              └───── calls ───┘
                    /api/v1/*

  RDS PostgreSQL (private subnets, Multi-AZ)
     ▲
     │
  EventBridge (schedules) ──▶ ┬─▶ Lambda: market-data-fetch     ─▶ RDS
                              ├─▶ Lambda: alert-evaluator       ─▶ SNS
                              └─▶ ECS RunTask: retrain / digest ─▶ RDS + S3

  SNS: notifications  ──▶  SES (email)  ──▶  users
                       └▶  mobile push (Phase 9)

  Secrets Manager  ──▶  DB creds, external API keys, SMTP creds
  Parameter Store  ──▶  non-sensitive config (Fetch_Cadence, feature flags)
  CloudWatch       ──▶  logs (awslogs driver), infra metrics, alarms
  Prometheus + Grafana  ──▶  app-level metrics (on ECS Fargate, scraping /metrics)
  ghcr.io          ──▶  container images for api / task
```

**Networking**: one VPC, two Availability Zones, public subnets for the ALB and NAT Gateway, private subnets for ECS tasks and RDS. Security groups scoped so the ALB is the only inbound path, and RDS accepts traffic only from the ECS security group.

---

## Phase 0 — Foundations

**Goal:** the project boots and tests run, even though no feature works yet.

**Scope**
- Create the `goldgoal/` Python package skeleton alongside `ml_models/` and `dashboard/`
- Pin dependencies (FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, `python-jose[cryptography]`, `passlib[bcrypt]`, `pytest`, `hypothesis`)
- SQLAlchemy `Base` + engine + `SessionLocal` + `get_db()` dependency
- Alembic scaffolding with one initial migration
- SQLite for local dev; PostgreSQL as the prod-shaped target (schema-identical)
- `tests/` layout with `unit/`, `properties/`, and `integration/` folders and a shared `conftest.py`

**Ships**
- App that starts, migrates an empty schema, and passes an empty test suite in CI

**Exit criteria**
- `pytest` runs green with zero collected tests
- `uvicorn goldgoal.main:create_app --factory` starts without errors
- Alembic `upgrade head` succeeds on a fresh SQLite file

---

## Phase 1 — Core Backend MVP

**Goal:** the full backend surface described in the `goldgoal-core` spec.

**Auth choice (affects the spec)**: because the target stack lists JWT, this phase uses a **short-lived JWT access token + long-lived opaque refresh token** pattern. The refresh token is stored in the `session_tokens` table so that logout still revokes it immediately (preserving Requirement 2.6 from the spec). Access tokens are stateless, RS256-signed, with a 15-minute TTL; refresh tokens have a 24-hour TTL. Keys are stored in Secrets Manager once we hit Phase 7.

**Scope**
- Auth: register, login (issues access + refresh), refresh, logout (revokes refresh), session validation
- Purchases: multi-asset (physical gold, gold ETF, sovereign gold bond), append-only after creation, delete allowed
- Portfolio analytics: `total_grams`, `total_invested`, `average_purchase_price`, `current_portfolio_value`, `unrealized_profit_loss_inr`, `overall_portfolio_growth_percent`, `allocation_by_asset_type`
- Goals: CRUD, progress with `required_monthly_investment_inr` + `savings_sufficient`
- Latest gold price display
- Dashboard aggregation (portfolio summary + goal list + five most recent purchases + latest price) as a single coherent snapshot
- Multi-user data isolation on every service
- Automated market-data ingestion: local dev uses an in-process APScheduler; production path is Lambda + EventBridge (Phase 7) hitting an internal ingestion endpoint
- Prediction scaffold: `Prediction_Service` returns `projection_status ∈ {PROJECTED, INSUFFICIENT_HISTORY, UNREACHABLE, PRICE_UNAVAILABLE}` with a stub estimator; real ML lands in Phase 3

**Ships**
- JSON API under `/api/v1` that a client (Postman, Streamlit, future React app) can drive end-to-end

**Exit criteria**
- Every requirement in `.kiro/specs/goldgoal-core/requirements.md` has a passing test
- All Correctness Properties have hypothesis-based tests
- Dashboard p95 < 1 s with 1,000 purchases and 10 goals on the test rig

---

## Phase 2 — User-Facing Web App (React SPA)

**Goal:** a browser experience that mirrors the "End-to-End User Flow" in `plan.md`, built as a React SPA generated via Google AI Studio and served from S3 + CloudFront.

**Scope**
- Use Google AI Studio to scaffold and iterate on React components with the GoldGoal API contract as the source of truth — share the OpenAPI schema with AI Studio for accurate code generation
- The SPA calls `/api/v1/*` on the API domain; CloudFront routes `/api/*` to the ALB and `/*` to the S3 bucket (no CORS issues in prod)
- Pages / features:
  - Register / login / logout (stores the JWT access token in memory, refresh token in an `httpOnly` cookie)
  - Dashboard: totals, unrealized P/L, growth %, allocation donut, recent purchases table
  - Purchase entry: three specialised forms (physical / ETF / SGB) with per-type validation that mirrors the API rules
  - Goal list and detail: progress bar, `remaining_grams`, `required_monthly_investment_inr`, `savings_sufficient`, `projected_completion_date` + confidence badge
  - Price history chart driven by `gold_prices`
- OpenAPI docs served from FastAPI at `/docs` so AI Studio always has the latest schema
- Local dev: `npm run dev` (Vite) proxies `/api` to `localhost:8000`; no Nginx needed in dev

**Ships**
- Static build uploaded to the `goldgoal-frontend` S3 bucket and served via CloudFront (Phase 7 wires the full CloudFront distribution; for Phase 2 the app can run locally against a local API)

**Exit criteria**
- Manual smoke test walks through: register → add purchase per asset type → create goal → see projected completion date → delete a purchase → logout
- No feature in Phase 1 is unreachable from the UI
- React build is a single `dist/` folder with no server-side runtime dependency

---

## Phase 3 — Real Prediction Integration

**Goal:** replace the projection stub with the existing ML ensemble so `projected_completion_date` reflects a real forecast.

**Scope**
- Wire `ml_models/pipeline.py` into `Prediction_Service`
- Forecast horizon aligned with `Projection_Horizon` (30 years) but computed lazily and cached
- `projected_completion_confidence` derived from prediction-interval width (narrow = HIGH, wide = LOW)
- Scenario mode: optimistic / base / pessimistic price paths surfaced on the goal detail view
- Retraining runs as an EventBridge-scheduled ECS `RunTask` (Phase 7) that fires when N new `gold_prices` rows have arrived; a PostgreSQL advisory lock prevents concurrent retrains
- Model artefacts stored on disk in dev, on S3 in prod (Phase 7); the API loads them lazily on first prediction after boot

**Ships**
- Projections that actually reflect the model, not the scaffold; confidence values that mean something

**Exit criteria**
- Property test: two consecutive `progress` calls with no new inputs return identical projections
- Property test: adding a purchase equal to `remaining_grams` moves `projection_status` to `PROJECTED` with `projected_completion_date = today`

---

## Phase 4 — Notifications & Alerts

**Goal:** the app reaches out to the user instead of the other way round.

**Scope**
- Notification path: alert-evaluator Lambda (scheduled by EventBridge) reads alert rules from the DB, evaluates them, publishes matched events to SNS
- SNS fans out to SES for email in this phase; mobile push added in Phase 9
- User-configurable alert rules:
  - Price crosses a user-specified threshold
  - Goal reaches a milestone (25 / 50 / 75 / 100 %)
  - `projected_completion_date` shifts by more than a configurable delta
- Monthly digest generated by an EventBridge-scheduled ECS `RunTask` that iterates users, renders the digest, and posts to SNS (which fans out to SES)
- Notification history table for audit and idempotency (dedupe key per rule + evaluation window)

**Ships**
- Users receive proactive emails without opening the app

**Exit criteria**
- Alert rules can be created, listed, and deleted via API
- Duplicate alerts are suppressed by notification-history keying
- SES sandbox exit (verified sender domain) completed before production launch

---

## Phase 5 — Containerisation

**Goal:** repeatable local environment identical in shape to production, with images ready to push to `ghcr.io`.

**Scope**
- Two Dockerfiles (multi-stage, slim runtime):
  - `goldgoal-api` — FastAPI + uvicorn
  - `goldgoal-task` — one-shot entry point for retraining and digest generation, invoked as ECS `RunTask` in prod
- React build pipeline: `npm ci && npm run build` produces `dist/` which CI uploads to S3. No container needed for the frontend.
- Lambda functions packaged as zip artefacts via Terraform archive provider
- `docker-compose.yml` for local dev bundling api + PostgreSQL + a LocalStack container that simulates SNS/SES/S3
- `.env`-driven config; secrets never baked into images
- Healthcheck endpoints (`/health`, `/ready`) used by the ALB and by `docker-compose healthcheck` locally
- Named volumes for `postgres_data` and `models`
- Nginx sidecar image (optional) for local TLS or when running behind a legacy reverse proxy; production uses ALB so nginx is dev-only

**Ships**
- `docker compose up` gets a full working stack — API, UI, DB, LocalStack — on any dev laptop

**Exit criteria**
- The full test suite (including LocalStack-backed integration tests) passes inside the compose stack
- All three images build under an agreed size budget

---

## Phase 6 — CI/CD

**Goal:** every merge produces verified images in `ghcr.io` ready to promote to ECS.

**Scope**
- GitHub Actions pipeline stages:
  1. Lint (ruff, black --check)
  2. Type check (mypy)
  3. Unit + property tests (with coverage gate)
  4. Integration tests (spins up compose with LocalStack)
  5. Docker build for api / ui / task
  6. Push tagged images to `ghcr.io` using the built-in `GITHUB_TOKEN` (no static registry credentials to manage)
  7. OIDC federation to AWS (no long-lived AWS keys in Actions) for the deploy step
  8. Alembic migration check against a scratch RDS-flavoured PostgreSQL
  9. Terraform plan on the infra repo (informational for feature branches, applied for main)
  10. ECS deployment: `aws ecs update-service --force-new-deployment` for each service on merge to main → staging; manual promotion action for staging → prod. ECS task definitions reference the `ghcr.io` image with an image-pull secret stored in Secrets Manager
- PRs blocked on failing checks
- Rollback strategy: keep the previous task-definition revision; rollback is a one-click switch back to that revision

**Ships**
- Green main = deployable images in `ghcr.io`; a merge lands in staging automatically

**Exit criteria**
- End-to-end pipeline runs in under an agreed budget (e.g., 10 minutes)
- A red build never reaches staging
- Rollback drill executed at least once against staging

---

## Phase 7 — Cloud Deployment on AWS

**Goal:** a real URL, HTTPS, and multi-tenant capacity, running entirely on AWS-native services.

**Scope — service map**

- **Networking**
  - VPC with two AZs
  - Public subnets: ALB, NAT Gateway
  - Private subnets: ECS tasks, RDS, Lambda (attached to VPC for RDS access)
  - Security groups: least-privilege, no direct RDS exposure
  - Route 53 hosted zone + records for the domain
  - ACM certificate attached to the ALB

- **Compute**
  - `goldgoal-api` — ECS Fargate service, target group behind ALB, auto-scaling on CPU + request count
  - `goldgoal-ui` — ECS Fargate service (Streamlit); when the React build lands, swap for S3 + CloudFront
  - `market-data-fetch` — Lambda, triggered by EventBridge on the configured Fetch_Cadence
  - `alert-evaluator` — Lambda, triggered by EventBridge, publishes matched events to SNS
  - `retrain` and `digest` — ECS `RunTask` invocations of the `goldgoal-task` image, triggered by EventBridge schedules; long-running work with full Python dependencies that would blow past Lambda's 15-minute limit lives here

- **Data**
  - RDS PostgreSQL Multi-AZ, automated backups, private subnets, credentials in Secrets Manager
  - S3 buckets: `goldgoal-models`, `goldgoal-reports`, `goldgoal-frontend` (each with lifecycle rules and versioning)

- **Messaging**
  - SNS topics: `goldgoal-notifications-email` (SES-subscribed), `goldgoal-notifications-mobile` (Phase 9)
  - Coordination between components uses direct SNS publish or DB rows; no queue in this iteration

- **Config and secrets**
  - Secrets Manager: DB credentials, JWT signing key, external gold-price API keys, SMTP / SES credentials, `ghcr.io` image-pull token
  - Parameter Store: `Fetch_Cadence`, feature flags, model version pointers

- **Identity and access**
  - Per-service IAM task roles (API, UI, each Lambda, the `goldgoal-task` task role)
  - GitHub Actions OIDC role for deploys
  - No shared credentials, no root-account usage after bootstrap

- **Delivery**
  - Images live in GitHub Container Registry (`ghcr.io/<org>/goldgoal-api`, `-ui`, `-task`)
  - ECS pulls with a repository-credentials secret (the `ghcr.io` PAT stored in Secrets Manager)
  - ECS blue/green via CodeDeploy or rolling deploys via `update-service` (chosen by risk appetite; blue/green preferred for API)

- **IaC**
  - Terraform modules: `network`, `data`, `compute`, `messaging`, `iam`, `observability`
  - Two workspaces / environments: `staging` and `prod`
  - Terraform state in S3 with DynamoDB state-lock table

- **Nginx**
  - Not used in front of ECS (ALB handles TLS and routing)
  - Retained in dev-compose for parity and as a fallback if a customer install runs off-AWS

**Ships**
- Public HTTPS URL for the app
- Model persistence across restarts via S3
- Scheduled jobs running via Lambda instead of an in-process scheduler

**Exit criteria**
- A commit to main lands in staging automatically and can be promoted to prod with one click
- Disaster-recovery run-book exists and has been executed at least once against staging
- Cost baseline documented (target: single-digit USD/day for staging, agreed budget for prod)

---

## Phase 8 — Observability & Operations

**Goal:** anyone on-call can diagnose an incident from dashboards + logs alone.

**Scope**
- Structured JSON logging with request IDs and user IDs (never emails or tokens)
- CloudWatch Logs via the `awslogs` driver on every ECS task and every Lambda
- CloudWatch Metrics for infra (CPU, memory, RDS connections, Lambda duration, ECS RunTask duration)
- Prometheus + Grafana:
  - Prometheus runs as an ECS Fargate service scraping `/metrics` on the API, UI, and worker via service discovery
  - Grafana runs as an ECS Fargate service backed by an EBS volume, fronted by a private ALB or Cognito-authed public route
- Dashboards:
  - API health (p50 / p95 / p99 latency, error rate)
  - Market-data freshness (age of `Latest_Gold_Price`)
  - Prediction service (call count, failure rate, projection status distribution)
  - RDS (connections, CPU, IOPS)
  - Scheduled-task runs (success rate, duration for retrain and digest tasks)
- CloudWatch Alarms + SNS → PagerDuty (or email) for:
  - API 5xx rate above threshold
  - Dashboard p95 latency above SLO
  - `Latest_Gold_Price` older than 2 × Fetch_Cadence
  - Any scheduled ECS RunTask exits non-zero
  - Any Lambda invocation fails after retries
- Uptime probes hitting `/health` and `/ready` (Route 53 health checks or an external synthetic)
- Scheduled RDS backups + a documented, tested restore drill
- Log retention policy in CloudWatch (30 days hot, 1 year archive to S3)
- Optional: X-Ray tracing for the API + worker to correlate DB / SNS / SES latency

**Ships**
- SLOs (availability, dashboard latency) defined, measured, and alerted on
- Restore drill from RDS snapshot completes within an agreed RTO

---

## Phase 9 — Post-Launch Enhancements

Each item becomes its own feature spec when picked up. They are independent of one another and sit outside the core roadmap.

- Silver support (mirrors gold across the stack)
- PDF investment reports (generated by an EventBridge-scheduled ECS `RunTask`, stored in the `goldgoal-reports` S3 bucket, linked in email)
- Mobile client (native or React Native) against the same API; SNS mobile push topic wired up
- Natural-language portfolio assistant (LLM over the user's own data, with strict per-user isolation)
- Historical price CSV export
- Two-factor authentication (TOTP + WebAuthn)

---

## Dependency Overview

```
Phase 0  ──▶  Phase 1  ──▶  Phase 2  ──▶  Phase 3
                       ╲                       ╲
                        Phase 5  ──▶  Phase 6  ──▶  Phase 7  ──▶  Phase 8
                                                 ╲
                                                  Phase 4 (needs 1; SES in 7)
                                                  ╲
                                                   Phase 9 (any time after 2)
```

**Parallelisation notes**
- Phase 2 (UI) and Phase 5 (containerisation) can start the moment Phase 1 lands.
- Phase 3 (real prediction) and Phase 4 (notifications) touch different services and can proceed in parallel.
- Phase 9 items are opt-in and never block the roadmap.

---

## Milestones by Deliverable

| Milestone | Phases required | User-visible outcome |
|---|---|---|
| Backend alpha | 0, 1 | API demoable via Postman |
| Product alpha | 0, 1, 2 | Full UI walkthrough on localhost |
| Product beta | 0, 1, 2, 3 | Real projections in the UI |
| Engaged product | 0–4 | Alerts + digests |
| Deployable product | 0–7 | Public HTTPS URL on AWS |
| Production-grade | 0–8 | Observability + on-call playbook |
| Platform expansion | 9 | Silver, mobile, reports, assistant |
