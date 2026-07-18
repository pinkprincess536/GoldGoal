# GoldGoal — Complete Project Documentation

## What This Project Does

GoldGoal helps users track gold investments, set ownership goals, and estimate future costs using real-time gold prices. Users sign up, log purchases, create goals like "100g by 2030," and see P&L, progress, and estimates — all using real market data.

---

## The Folder Structure

```
proj/
├── docker-compose.yml        ← starts all 6 services with one command
├── prometheus.yml             ← tells Prometheus what to monitor
├── .env.example               ← template for secrets (copy to .env)
│
├── backend/                   ← our FastAPI app (the brain)
│   ├── Dockerfile             ← how to build the container
│   ├── requirements.txt       ← Python packages we need
│   └── app/
│       ├── main.py            ← starts the app, registers all routes
│       ├── core/              ← shared tools used by everything
│       │   ├── config.py      ← all settings in one place
│       │   ├── database.py    ← how Python talks to PostgreSQL
│       │   └── security.py    ← password hashing + JWT tokens
│       ├── models/            ← database table definitions
│       │   ├── user.py        ← users table
│       │   ├── purchase.py    ← purchases table
│       │   ├── goal.py        ← goals table
│       │   ├── gold_price.py  ← daily gold prices table
│       │   ├── prediction.py  ← ML predictions table
│       │   ├── alert.py       ← user alerts table
│       │   └── notification.py ← sent notifications log
│       ├── schemas/           ← validates data coming in/out
│       │   ├── user.py        ← signup/login validation
│       │   ├── purchase.py    ← purchase validation
│       │   └── goal.py        ← goal validation
│       ├── services/          ← business logic (the actual work)
│       │   ├── auth.py        ← signup + login
│       │   ├── portfolio.py   ← purchases + P&L
│       │   ├── goal.py        ← goals + progress
│       │   └── gold_price.py  ← live prices + CSV seeding
│       └── routers/           ← HTTP endpoints (web addresses)
│           ├── auth.py        ← POST /auth/signup, /auth/login
│           ├── portfolio.py   ← portfolio endpoints
│           ├── goal.py        ← goal endpoints
│           └── price.py       ← price endpoints
│
├── frontend/                  ← Streamlit dashboard
│   ├── Dockerfile
│   ├── requirements.txt
│   └── app.py                 ← placeholder dashboard
│
├── ml_models/                 ← gold price prediction pipeline
│   ├── pipeline.py            ← main orchestrator (run this)
│   ├── config.py              ← all ML parameters
│   ├── data_loader.py         ← reads CSV data
│   ├── feature_engineering.py ← builds 36 features
│   ├── ensemble.py            ← blends model predictions
│   ├── evaluation.py          ← performance metrics
│   └── models/               ← individual model code
│       ├── ridge_model.py
│       ├── lgbm_model.py
│       ├── knn_model.py
│       ├── svr_model.py
│       └── hmm_regime.py
│
├── data/                      ← CSV data files
│   ├── gold.csv               ← gold prices (₹/10g, 2014-2026)
│   └── silver.csv / silver_new.csv ← silver data
│
├── outputs/                   ← ML pipeline results
│   ├── predictions.csv
│   ├── metrics.csv
│   └── plots/
│
└── journal/                   ← learning notes
    ├── dockercompose.md
    ├── commandslearned.md
    ├── yml-deep-dive.md
    ├── phase2-revision.md
    ├── security-architecture.md
    ├── database-schema.md
    └── resume-entry.md
```

---

## The Architecture — 4 Layers

### Analogy: A Restaurant

| Layer | Folder | Restaurant Role | What It Does |
|-------|--------|-----------------|-------------|
| Store data | `models/` | Storage room layout | Defines what user/purchase/goal data looks like |
| Validate input | `schemas/` | Door security | Rejects bad data before it enters |
| Do the work | `services/` | Kitchen (chef) | The actual business logic |
| Handle requests | `routers/` | Waiters | Takes HTTP requests, delegates to services |

Plus one shared folder:
| Shared tools | `core/` | Electricity & plumbing | Database connection, password hashing, JWT — used by all |
| Entry point | `main.py` | Restaurant manager | Starts everything, registers all waiters |

---

## Request Flow Example — User Signs Up

```
Browser: POST /auth/signup {"email": "a@b.com", "password": "123", "full_name": "Alice"}

  ↓ main.py — receives request, routes to auth router

  ↓ routers/auth.py — Pydantic checks against schemas/user.py (valid email? password given?)

  ↓ routers/auth.py — checks models/user.py (email already exists?)

  ↓ services/auth.py — hashes password via core/security.py

  ↓ services/auth.py — saves user via core/database.py → PostgreSQL

  ↓ services/auth.py — returns User object

  ↓ routers/auth.py — Pydantic converts to UserOut (strips hashed_password)

  ↓ Browser receives: {"id": "abc-123", "email": "a@b.com", "full_name": "Alice"}
```

---

## All API Endpoints

### Auth (Phase 2)
| Method | Path | Auth? | What |
|--------|------|-------|------|
| POST | `/auth/signup` | No | Create account |
| POST | `/auth/login` | No | Get JWT token |

### Portfolio (Phase 3)
| Method | Path | Auth? | What |
|--------|------|-------|------|
| POST | `/portfolio/purchases` | Yes | Log a gold purchase |
| GET | `/portfolio/purchases` | Yes | List all purchases |
| GET | `/portfolio/summary` | Yes | Total grams, invested, avg price, P&L |

### Goals (Phase 4)
| Method | Path | Auth? | What |
|--------|------|-------|------|
| POST | `/goals/` | Yes | Create a goal |
| GET | `/goals/` | Yes | List all goals |
| GET | `/goals/{id}` | Yes | Get one goal |
| PUT | `/goals/{id}` | Yes | Update a goal |
| DELETE | `/goals/{id}` | Yes | Delete a goal |
| GET | `/goals/{id}/progress` | Yes | Completion %, estimated date |

### Prices (Phase 5)
| Method | Path | Auth? | What |
|--------|------|-------|------|
| GET | `/prices/latest?purity=22k` | No | Latest gold price, supports purity |
| GET | `/prices/history?days=90` | No | Price history |
| POST | `/prices/update` | No | Fetch + save today's live price |
| GET | `/health` | No | App alive check |

---

## Database — 7 Tables

### `users`
| Column | Why |
|--------|-----|
| id (UUID) | Unpredictable IDs prevent user enumeration attacks |
| email (unique, indexed) | Searched on every login — index makes it fast |
| hashed_password | bcrypt hash, never raw password |
| full_name | Display name |
| created_at / updated_at | Auto timestamps |

### `purchases`
| Column | Why |
|--------|-----|
| user_id (FK → users) | Links to owner, CASCADE delete |
| purchase_date | When gold was actually bought |
| grams, price_per_gram, total_amount | Stored total_amount captures real amount paid (making charges, GST) |
| purchase_type | physical / etf / bond |
| notes | Optional user note |

### `goals`
| Column | Why |
|--------|-----|
| user_id (FK → users) | Links to owner |
| name, target_grams, target_date | What and when |
| monthly_budget | Used to estimate completion timeline |

### `gold_prices`
| Column | Why |
|--------|-----|
| date (unique, indexed) | One price per day |
| price_per_gram | 24k price in ₹/gram |
| source | csv / api |

### `predictions`
| Column | Why |
|--------|-----|
| prediction_date, target_date | When predicted and for when |
| predicted_price, model | Which model predicted what |
| Each model stored separately — compare accuracy over time |

### `alerts`
| Column | Why |
|--------|-----|
| alert_type | price_drop, price_rise, goal_milestone |
| threshold_value | Trigger value |
| is_active | Can pause without deleting |

### `notification_history`
| Column | Why |
|--------|-----|
| user_id (no FK) | Audit trail survives user deletion |
| notification_type, subject, status | email/sms, what, sent/failed |

---

## Security — Defense in Depth

```
Request arrives
  ↓
Layer 1: No Authorization header?   → 403 Forbidden
Layer 2: Token fake or expired?      → 401 Unauthorized
Layer 3: Token decoded, user deleted? → 401 Unauthorized
Layer 4: Schema validation fails?    → 422 Invalid data
Layer 5: user_id from JWT, not body  → IDOR prevention
  ↓
Request reaches service function
```

### Key Security Decisions

- **bcrypt** for passwords — deliberately slow, one-way, auto-salted
- **JWT** for sessions — signed tokens, no session table needed
- **UUIDs** for IDs — prevent enumeration attacks (can't guess `/users/2`)
- **ORMs** prevent SQL injection — no raw string formatting for queries
- **IDOR protection** — `user_id` always comes from verified JWT, never from request body

---

## Gold Price System (Phase 5)

### How Prices Flow

```
App Startup:
  → main.py lifespan() calls seed_prices(db)
  → Reads data/gold.csv (₹/10g)
  → Converts to ₹/gram (÷ 10)
  → Inserts into gold_prices table
  → Skips if data already exists

Daily (Phase 7 via Lambda):
  → EventBridge triggers at 8 AM
  → Lambda calls POST /prices/update
  → fetch_live_price() calls external API
  → Upserts today's price into gold_prices

Any user request:
  → portfolio summary calls get_latest_price(db)
  → goal progress calls get_latest_price(db)
  → Returns real market price, not hardcoded
```

### Purity System

```
DB stores 24k price (pure gold, highest quality)
User requests: GET /prices/latest?purity=22k
Calculation:   24k_price × (22 ÷ 24) = adjusted price
Result:        "1 gram of 22k gold = ₹X"

Supported: 24k, 22k, 21k, 20k, 18k, 16k, 14k, 10k
```

---

## Docker Compose Services

```
docker compose up
    │
    ├── db (PostgreSQL:16)      — starts first, health check runs
    ├── api (FastAPI)           — waits for db healthy, creates tables, seeds prices
    ├── frontend (Streamlit)    — waits for api
    ├── prometheus              — scrapes api:8000/metrics every 15s
    └── grafana                 — dashboard at localhost:3000
```

Ports:
- `localhost:8000` — FastAPI (direct)
- `localhost:8501` — Streamlit (direct)
- `localhost:5432` — PostgreSQL
- `localhost:9090` — Prometheus
- `localhost:3000` — Grafana

---

## Commands Reference

### Docker
| Command | When to use |
|---------|-------------|
| `docker compose up` | Start all services |
| `docker compose up --build` | Rebuild images + start (after changing Dockerfile or requirements.txt) |
| `docker compose down` | Stop all containers (data survives) |
| `docker compose build --no-cache` | Rebuild from scratch (when cache is corrupted) |
| `docker ps` | Check what's running |
| `docker compose logs api` | See FastAPI logs |

### Git
| Command | When to use |
|---------|-------------|
| `git add -A` | Stage all changes |
| `git commit -m "msg"` | Save staged changes |
| `git push` | Upload to GitHub |
| `git pull` | Download from GitHub (different machine only) |

### API Testing (PowerShell)
```powershell
# Signup
Invoke-RestMethod -Uri http://localhost:8000/auth/signup -Method Post -ContentType "application/json" -Body '{"email":"test@test.com","password":"test123","full_name":"Test"}'

# Login + save token
$token = (Invoke-RestMethod -Uri http://localhost:8000/auth/login -Method Post -ContentType "application/json" -Body '{"email":"test@test.com","password":"test123"}').access_token

# Add purchase
Invoke-RestMethod -Uri http://localhost:8000/portfolio/purchases -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"grams":10,"price_per_gram":6500,"total_amount":65000,"purchase_date":"2024-01-15T00:00:00","purchase_type":"physical"}'

# Portfolio summary
Invoke-RestMethod -Uri http://localhost:8000/portfolio/summary -Method Get -Headers @{Authorization="Bearer $token"}

# Create goal
Invoke-RestMethod -Uri http://localhost:8000/goals/ -Method Post -ContentType "application/json" -Headers @{Authorization="Bearer $token"} -Body '{"name":"Wedding 2030","target_grams":100,"target_date":"2030-12-31","monthly_budget":10000}'

# Goal progress
Invoke-RestMethod -Uri http://localhost:8000/goals/GOAL_ID/progress -Method Get -Headers @{Authorization="Bearer $token"}

# Latest gold price (24k)
Invoke-RestMethod -Uri http://localhost:8000/prices/latest

# Latest gold price (22k)
Invoke-RestMethod -Uri http://localhost:8000/prices/latest?purity=22k

# Trigger daily price update
Invoke-RestMethod -Uri http://localhost:8000/prices/update -Method Post
```

---

## Phase Progress

| Phase | Status | What We Built |
|-------|--------|---------------|
| 1 | Done | Docker Compose — 5 services running together |
| 2 | Done | Auth — signup, login, JWT, protected routes |
| 3 | Done | Portfolio — add purchases, list, P&L summary |
| 4 | Done | Goals — create, track progress, estimated completion |
| 5 | Done | Live prices — CSV seeding, live API, purity selection |
| 6 | Next | DevOps — Nginx, Prometheus metrics, Grafana dashboards |
| 7 | | Terraform — Infrastructure as Code for AWS |
| 8 | | CI/CD — GitHub Actions, automated deploy |
