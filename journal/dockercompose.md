# Docker Compose — Phase 1 Foundation

## Why Docker Compose First?

### Analogy: Building a House
You don't start by painting walls. You clear the land, lay the foundation, frame the structure, run plumbing and electrical. Docker Compose is our foundation — every line of code we write later has nowhere to live without it.

### Technical Reasons

- **No "works on my machine" bugs:** Docker Compose creates the same environment everywhere — local dev laptop, CI runner, EC2 server.
- **Service discovery:** Containers talk to each other by hostname (e.g., `db:5432`) instead of hardcoded IPs. Consistent across local and production.
- **One command to rule them all:** `docker compose up` starts Postgres, FastAPI, Streamlit, Prometheus, Grafana simultaneously. No manual process management.
- **Production parity:** The same `docker-compose.yml` works locally and on EC2. You only swap the DB connection string (container → RDS).

---

## Q&A: Questions Asked During Phase 1 Planning

### Q: "Why are we not jumping straight to FastAPI?"

**My initial thought:** I didn't understand why we'd spend time on Docker stuff instead of writing code.

**The answer (House Analogy):**
You don't start building a house by painting the walls. You clear the land, lay the foundation, frame the structure, run plumbing and electrical. Only then do you install the kitchen.

Phase 1 is our foundation. Without it:
- Every line of code has nowhere to live
- No way to connect to a database
- No way to test with other services running alongside
- We'd hit "works on my machine" bugs when deploying to EC2
- We'd install PostgreSQL locally on Windows with paths and configs that only work on one machine

**What changed in my thinking:** Phase 1 isn't "delaying real work." It is real work — it's the shared infrastructure every feature depends on. Skip it and you pay interest in debugging time later.

---

### Q: "Why separate Dockerfiles and requirements.txt per service instead of one shared file?"

**My initial answer:** "Because it's more modular."

**Follow-up explanation — three reasons, not just one:**

1. **Modularity:** Each service is independently defined. Swap Streamlit for React? Delete `frontend/`, add `react-app/`. Backend stays untouched. Good design means components can be replaced without surgery.

2. **Dependency Isolation:** FastAPI and Streamlit run in separate containers with separate Python environments. FastAPI needs `fastapi`, `uvicorn`, `sqlalchemy`, `psycopg2`. Streamlit needs `streamlit`, `pandas`, `plotly`. If Streamlit has a `numpy` version conflict, it cannot break FastAPI. Think of it like two kitchens — Italian chef and Thai chef don't share ingredients, so they can't contaminate each other's dishes.

3. **Independent Scaling:** In production, you might run 3 replicas of FastAPI (handling API traffic) but only 1 replica of Streamlit (low-traffic dashboard). Separate Docker images make this trivial. If they shared one Dockerfile, you'd be forced to scale everything together — wasteful for CPU and memory.

**What changed in my thinking:** I had an instinct that modularity was the answer, but depdendency isolation and independent scaling are equally important reasons I hadn't considered.

---

## What Phase 1 Delivers

```
docker compose up
    │
    ├── fastapi      → http://localhost:8000/health → {"status": "ok"}
    ├── streamlit    → http://localhost:8501          → blank dashboard
    ├── postgres     → running on 5432, ready for connections
    ├── prometheus   → http://localhost:9090          → scraping targets
    └── grafana      → http://localhost:3000          → connected to Prometheus
```

---

## Phase 1 Structure

```
proj/
├── backend/
│   ├── app/
│   │   └── main.py          # FastAPI entrypoint
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/
│   ├── app.py               # Streamlit entrypoint
│   ├── Dockerfile
│   └── requirements.txt
│
├── docker-compose.yml        # Orchestrates all services
├── prometheus.yml            # Prometheus config (what to scrape)
└── .env.example              # Document env vars
```

---

## Data Flow (Simplified)

```
User → Nginx (Phase 6) → FastAPI (port 8000)
                       → Streamlit (port 8501)
                                     ↓
                              PostgreSQL (port 5432)

Prometheus (9090) ← scrapes metrics from FastAPI
                        ↓
                  Grafana (3000) ← visualizes metrics
```

---

## Edge Cases to Consider

| Edge Case | Mitigation |
|-----------|------------|
| PostgreSQL starts slower than FastAPI | FastAPI needs retry logic or `depends_on` with health check |
| Ports already in use (8000, 8501, 5432, 9090, 3000) | Check via `netstat` / use different ports in `.env` |
| `.env` file is missing | `.env.example` documents required vars; add validation |
| Container restart loops | Set `restart: unless-stopped` + health checks |

---

## Q: "What will the project look like after all phases are complete?"

### Architecture Diagram

```
                     User's Browser
                           │
                    https://goldgoal.com
                           │
                    ┌──────┴──────┐
                    │    Nginx     │  (reverse proxy + SSL)
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            │
       Streamlit      FastAPI           │
       (dashboard)    (REST API)        │
       :8501          :8000             │
              │            │            │
              └─────┬──────┘            │
                    │                   │
              ┌─────┴─────┐             │
              │  RDS       │            │
              │ PostgreSQL │            │
              └───────────┘            │
                    │                   │
      ┌─────────────┼─────────────┐     │
      ▼             ▼             ▼     │
   EventBridge  Lambda(1)    Lambda(2)  │
   (cron)       (price       (alerts)   │
                 fetcher)               │
      │             │             │     │
      ▼             ▼             ▼     │
   S3           SNS/SES      CloudWatch │
   (reports)    (emails/sms) (logs)     │
```

### Monitoring (for engineers, not users)
```
Prometheus (9090) ← scrapes metrics from FastAPI, Nginx, EC2
    │
    ▼
Grafana (3000) ← API latency, error rate, prediction accuracy
```

### What Users Experience
- Sign up/login → JWT-based auth
- Dashboard: total grams, total invested, avg buy price, current value, P&L
- Add purchases: "bought 20g at 6500/g on Jan 15"
- Create goals: "100g by 2035, investing 10,000/month"
- Goal tracker: acquired / remaining, completion %, estimated completion date
- Price charts with purchase markers overlaid
- Alerts: email when gold drops below target price or goal milestones reached

### Automation
| Trigger | Action |
|---------|--------|
| Every day 8AM | Lambda fetches latest gold price → RDS |
| Every Monday | Prediction pipeline retrains → stores in S3 |
| Price drops below alert | SNS/SES notification |
| Goal milestone (50%/75%/100%) | Email |

### Project Structure (Final)
```
goldgoal/
├── .github/workflows/ci.yml
├── backend/          # FastAPI
├── frontend/         # Streamlit
├── lambda/           # Price fetcher + alert handler
├── ml_models/        # Prediction pipeline
├── terraform/        # All AWS infra as code
│   ├── main.tf, rds.tf, ec2.tf, s3.tf, lambda.tf, iam.tf
├── docker-compose.yml
├── prometheus.yml
├── nginx/nginx.conf
└── tests/
```

---

## Key Takeaway

Phase 1 is boring on purpose. No business logic, no database schemas, no auth. Just the bones — a reproducible, isolated, multi-service development environment. Everything else depends on this.
