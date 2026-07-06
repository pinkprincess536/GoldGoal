# Understanding YAML Files in DevOps — A Deep Dive

## What Is YAML, Really?

YAML stands for "YAML Ain't Markup Language" (a silly recursive acronym). 

### The problem it solves

Before YAML, engineers configured systems using:
- **INI files** — flat key=value, no nesting, terrible for complex configs
- **JSON** — machine-readable but painful for humans (quotes everywhere, no comments, commas after every line)
- **XML** — verbose, hard to read, easy to mess up closing tags

YAML was invented because **infrastructure config needs to be both human-readable and machine-parseable.** Devops engineers stare at these files for hours — they should feel like reading a document, not code.

### Core mental model

```
YAML = Key: Value pairs that can NEST
```

Everything is:
```yaml
key: value          # scalar
key:               # mapping (object)
  subkey1: val1
  subkey2: val2
key:               # sequence (list)
  - item1
  - item2
```

**The single most important rule:** Indentation IS the structure. Two spaces per level. Never tabs. In JSON you have `{}` and `[]` to know where things start and end. In YAML, the whitespace IS the delimiter. Get indentation wrong and everything silently breaks.

### Why it dominates DevOps

| Tool | Uses YAML For |
|------|---------------|
| Docker Compose | Service definitions |
| Kubernetes | Pods, deployments, services, everything |
| Ansible | Playbooks and inventory |
| GitHub Actions | CI/CD workflows |
| Prometheus | Scrape config and alerting rules |
| Terraform | (Uses HCL, not YAML, but same philosophy) |
| Helm | Kubernetes package manager |

YAML is the lingua franca of cloud-native tooling. Learning it deeply pays off across every tool.

---

## File 1: docker-compose.yml — Your Local Infrastructure Blueprint

### What is Docker Compose?

Imagine you need to start 5 programs (PostgreSQL, FastAPI, Streamlit, Prometheus, Grafana) that all need to talk to each other. Without Compose:

```
Terminal 1: pg_ctl start
Terminal 2: uvicorn app.main:app --port 8000
Terminal 3: streamlit run app.py --port 8501
Terminal 4: prometheus --config.file=prometheus.yml
Terminal 5: grafana-server
```

And you'd need to configure networking so they can find each other. Every time you restart your laptop, repeat. Every teammate does this manually. Every EC2 deployment does this manually.

**Docker Compose replaces all of that with one command:** `docker compose up`.

### The DevOps thought process when writing a compose file

You ask yourself these questions, in this order:

**1. "What services need to run?"**
- Database, API, frontend, monitoring tools
→ That's 5 `services:` blocks

**2. "What does each service need to start?"**
- PostgreSQL needs: image, credentials, persistent storage
- FastAPI needs: our code, the database URL, Python installed
- Prometheus needs: a config file telling it what to scrape

**3. "What order do they need to start?"**
- PostgreSQL must be READY before FastAPI connects
- Prometheus must be up before Grafana
→ That's `depends_on` with health checks

**4. "How do they find each other?"**
- They're all on the same Docker network
- Service names become DNS hostnames: `db`, `api`, `frontend`, `prometheus`
→ You never write IP addresses. Compose handles DNS.

**5. "What should survive a restart?"**
- Database data? Must survive.
- Prometheus metrics? Must survive.
- Grafana dashboards? Must survive.
→ That's named `volumes:`

**6. "What should NOT survive?"**
- Python code changes? Should reflect immediately during dev.
→ That's bind mounts (`./backend:/app`)

**7. "How do we handle environment differences?"**
- Dev: password is `goldgoal`, DB host is `db`
- Prod: password comes from AWS Secrets Manager, DB host is `rds.xxx.amazonaws.com`
→ That's `${VAR:-default}` variable substitution

### Line-by-line thought process

```yaml
version: "3.9"
```
Compose file format version. 3.9 is the latest for standalone Docker (3.8+ for swarm compatibility). In modern Compose v2, this is optional but explicit is better.

```yaml
services:
```
Top-level key. Everything inside is a "service" = a container (or group of containers).

```yaml
  db:
    image: postgres:16
```
We use an official image from Docker Hub (`postgres`), version 16. Why not `latest`? Because `latest` means "whatever the newest version is today," which means your teammate's build might get a different version than yours. Pinning the version (`16`) means everyone gets PostgreSQL 16.x — deterministic, reproducible.

Why PostgreSQL 16 and not 15? The latest stable at time of writing. In a real company, you'd use whatever version your production RDS runs.

```yaml
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-goldgoal}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-goldgoal}
      POSTGRES_DB: ${POSTGRES_DB:-goldgoal}
```
The PostgreSQL image reads these env vars on first startup and creates the database + user. If they're not set in `.env`, it falls back to `goldgoal`.

Why `${VAR:-default}` and not hardcoded values? Because eventually you'll have a `.env` file with real production creds. The compose file works in both dev (with defaults) and prod (with env vars) without changes.

```yaml
    ports:
      - "5432:5432"
```
`"host_port:container_port"`. PostgreSQL inside the container listens on 5432 (standard). The host (your laptop) also maps 5432 to it. This lets you connect via `localhost:5432` from tools like DBeaver or `psql` on your host.

Why expose 5432? For development — you'll want to inspect the database directly. In production, you'd remove this line. The database port should NOT be exposed to the internet.

```yaml
    volumes:
      - pgdata:/var/lib/postgresql/data
```
`pgdata` is a named volume (declared at the bottom). It maps to `/var/lib/postgresql/data` inside the container — where PostgreSQL stores all its files.

Without this volume: `docker compose down` deletes all your data. With it: data persists across restarts.

Why a named volume and not a bind mount (`./data:/var/lib/...`)? Named volumes are managed by Docker — faster I/O, more portable, don't clutter your project directory with database files.

```yaml
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U goldgoal"]
      interval: 5s
      retries: 5
```
Docker runs `pg_isready -U goldgoal` every 5 seconds. If it fails 5 times in a row, the container is marked "unhealthy."

Why does this exist? Because `depends_on` without a health check only waits for the container process to start — NOT for PostgreSQL to accept connections. PostgreSQL takes 2-3 seconds to initialize its data directory and start listening. Without this health check, FastAPI crashes on startup because the database isn't ready yet.

This is one of the most common Docker Compose bugs and the #1 reason devs add `restart: always` as a hack. The health check is the correct solution.

```yaml
  api:
    build: ./backend
```
Instead of pulling a pre-made image, Compose builds one from `backend/Dockerfile`. The result is a local image.

Why build and not pull? Because our code changes constantly. There's no pre-built image of our app on Docker Hub. During CI/CD (Phase 8), we'll push built images to ECR and then switch this to `image:`.

```yaml
    ports:
      - "8000:8000"
```
FastAPI inside the container on 8000 → your laptop on 8000. Standard convention.

```yaml
    environment:
      DATABASE_URL: postgresql+psycopg2://${POSTGRES_USER:-goldgoal}:${POSTGRES_PASSWORD:-goldgoal}@db:5432/${POSTGRES_DB:-goldgoal}
```
This is the SQLAlchemy connection string. Notice the host is `db` — not `localhost`, not `127.0.0.1`. Docker Compose creates a private network where service names resolve to internal IPs. The API container reaches the database at `db:5432` because Compose DNS resolves `db` to PostgreSQL's IP.

This is why we don't need complex networking config. Compose's internal DNS is the entire networking layer.

```yaml
    depends_on:
      db:
        condition: service_healthy
```
"Don't start `api` until `db` is healthy." Without this, it's a race condition — FastAPI starts in 0.5 seconds, PostgreSQL takes 3 seconds. The connection fails, container crashes, Compose restarts it, connection fails again... you get a restart loop.

`condition: service_healthy` is the only one that actually waits. The default (no condition) just waits for the container to exist, not for it to be functional.

```yaml
    volumes:
      - ./backend:/app
```
Mounts your local `backend/` folder into `/app` inside the container. This is a bind mount. Edit `main.py` on your laptop → Uvicorn detects the change (via `--reload`) → restarts within 1 second.

Without bind mounts: every code change requires `docker compose build api` (reinstall dependencies, copy files), then `docker compose up`. That's 30-60 seconds per change. With bind mounts: save and refresh. 

In production you NEVER do this. The code is baked into the image. The host has no access to the container's filesystem.

```yaml
  frontend:
    build: ./frontend
    ports:
      - "8501:8501"
    environment:
      API_URL: http://api:8000
    depends_on:
      - api
    volumes:
      - ./frontend:/app
```
Same pattern. `API_URL` tells Streamlit where FastAPI lives. In Phase 3, Streamlit's Python code reads this env var and uses it for all API calls. This avoids hardcoding `localhost:8000` in the code.

```yaml
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - promdata:/prometheus
```
Two mounts here:
1. **Bind mount** (`./prometheus.yml`): Our scrape config. We edit it locally, Prometheus sees changes on restart.
2. **Named volume** (`promdata`): Where Prometheus stores its time-series database. Persisted across restarts so we don't lose historical metrics.

`prom/prometheus:latest` — we use `latest` here because Prometheus is a monitoring tool, not our application code. It's fine if it auto-updates.

```yaml
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
    volumes:
      - grafdata:/var/lib/grafana
```
Grafana stores dashboards, datasource connections, and user preferences in `/var/lib/grafana`. Named volume persists these so you don't rebuild dashboards every restart.

```yaml
volumes:
  pgdata:
  promdata:
  grafdata:
```
Declares the named volumes at the top level. If you reference a volume in a service but don't declare it here, Compose auto-creates it — but explicit declaration is better for readability. Anyone reading the file can see all volumes in one place.

---

## File 2: prometheus.yml — Teaching Prometheus What to Monitor

### What is Prometheus?

**Analogy:** Imagine you run a hospital. You need to know, every minute: how many patients are in the ER, what the average wait time is, whether any machines are failing. You could:
- Walk around and ask every nurse (inefficient, interrupts work)
- Install sensors that report automatically to a central dashboard

Prometheus is the central dashboard. It doesn't wait for alerts — it actively "scrapes" (pulls) data from every service on a schedule.

### The pull model vs push model

Most monitoring tools use **push** — services send data to the monitor. Prometheus uses **pull** — it reaches out and asks each service "how are you?" This is counterintuitive at first, but there's a good reason:

- **Push:** If the monitoring server goes down, data is lost. Services keep pushing into a void.
- **Pull:** Prometheus stores the data. If a service is down, Prometheus knows because the scrape fails. The absence of data IS data.

Pull is simpler and more reliable for infrastructure monitoring.

### How Prometheus discovers targets

```yaml
global:
  scrape_interval: 15s
```
Every 15 seconds, Prometheus reaches out to every target in `scrape_configs` and asks for `GET /metrics`. The service returns a plain-text list of numbers (not JSON — Prometheus has its own simple format).

Why 15 seconds? Because it's the default and fine for our scale. At 10,000+ targets, you might increase to 30s or 60s. High-frequency trading systems use 5s. For our gold tracking app, 15s is plenty.

```yaml
scrape_configs:
  - job_name: "fastapi"
    static_configs:
      - targets: ["api:8000"]
```

**`job_name`**: A label. All metrics from this target get tagged `job="fastapi"`. When you write a Grafana query later, you filter by `job="fastapi"` to only see API metrics. Think of it as a folder name.

**`static_configs`**: The simplest discovery method — a hardcoded list of IP:port pairs. Prometheus scrapes `api:8000/metrics` every 15 seconds.

In Kubernetes, you'd use `kubernetes_sd_configs` instead — Prometheus automatically discovers pods as they spin up and down. Static configs are for fixed infrastructure.

**Where does `/metrics` come from?** FastAPI doesn't expose metrics by default. We'll add the `prometheus_fastapi_instrumentator` package in Phase 6. It automatically creates `GET /metrics` with request counts, latencies, error rates, etc. Without the instrumentator, `api:8000/metrics` returns 404 and the scrape fails.

### What metrics look like

Prometheus metrics are just labeled timestamps:

```
http_requests_total{method="GET", endpoint="/health", status="200"} 142
http_request_duration_seconds{method="GET", endpoint="/health", quantile="0.95"} 0.003
```

Grafana reads these, groups by labels, and renders graphs.

---

## The YAML Landscape in Our Project

By the end of all phases, we'll have these YAML (and YAML-like) files:

| File | Phase | Purpose |
|------|-------|---------|
| `docker-compose.yml` | 1 | Local dev infrastructure |
| `prometheus.yml` | 1 | Scrape targets and alerting rules |
| `nginx/nginx.conf` | 6 | Reverse proxy rules (not YAML, but conf) |
| `.github/workflows/ci.yml` | 8 | CI/CD: lint → test → build → push to ECR |
| `terraform/*.tf` | 7 | IaC (HCL, not YAML, but same declarative philosophy) |

---

## DevOps Thought Process: How Senior Engineers Think About Config Files

### 1. Declarative over imperative

**Imperative:** "Install PostgreSQL. Then create user goldgoal. Then set password to goldgoal. Then start the service."
**Declarative:** "I want a PostgreSQL container with user=goldgoal, password=goldgoal, db=goldgoal."

YAML files are declarative. You describe the DESIRED STATE, not the steps to get there. Docker Compose, Prometheus, and Terraform all figure out how to make reality match your declaration.

Why? Because the same config works on a fresh machine, a broken machine, or an updated machine. The tool computes the delta and only applies what changed.

### 2. Idempotency

Running `docker compose up` twice should produce the same result as running it once. If the services are already running, Compose does nothing. Idempotency means "doing it 100 times is the same as doing it once."

Every YAML config should be idempotent. If your config creates something on first run but errors on second run, it's wrong.

### 3. The "cattle, not pets" mentality

Old-style ops: servers have names (Zeus, Apollo), you SSH in, you hand-configure them, you panic when they die.

DevOps: servers are cattle. You don't name them. You don't nurture them. If one dies, you replace it from the same config. The config IS the server. This is why everything must be in YAML — the file is the source of truth, not the running system.

### 4. Environment parity

The Docker Compose file that works on your laptop should work on EC2 with minimal changes. The only difference: production swaps `image: postgres:16` for an RDS connection string. This is the 12-factor app philosophy (factor 10: dev/prod parity).

### 5. Configuration as documentation

A well-written docker-compose.yml tells you:
- What services exist
- What ports they use
- How they connect to each other
- What data persists
- What environment variables they need

A new team member should be able to read the compose file and understand the entire system without reading any README.

---

## Common YAML Pitfalls

### 1. Indentation errors
```yaml
# WRONG
services:
    api:
      ports:
        - "8000:8000"
     frontend:    # 5 spaces instead of 4 - broken
      ports:
        - "8501:8501"
```

### 2. Tabs vs spaces
YAML forbids tabs. Use 2 spaces per level. Your editor must convert tabs to spaces.

### 3. The Norway problem
```yaml
# Norway: no
# YAML interprets "no" as boolean false
countries:
  - Norway   # becomes [false] not ["Norway"]
  - yes      # becomes [true]
```
Words like `yes`, `no`, `on`, `off`, `true`, `false` are booleans in YAML. Quote them: `"Norway"`, `"yes"`.

### 4. Colons in values
```yaml
# BROKEN
DATABASE_URL: postgresql://user:pass@host:5432/db

# FIXED - quote it
DATABASE_URL: "postgresql://user:pass@host:5432/db"
```
YAML sees the first `:` and thinks it's a new key-value pair. Quote strings that contain colons.

### 5. Missing final newline
Always end YAML files with a blank line. Some parsers silently ignore the last line if there's no newline.

---

## Interview Questions This Topic Covers

1. **"What's the difference between a bind mount and a named volume in Docker?"**
   Bind mount = your local folder → container folder. Named volume = Docker-managed persistent storage.

2. **"How does service discovery work in Docker Compose?"**
   Service names become DNS hostnames on the internal network. No IP addresses needed.

3. **"Why use a health check in depends_on instead of just depends_on?"**
   depends_on waits for the container process. Health check waits for the service to be functional. Prevents race conditions at startup.

4. **"Explain Prometheus's pull model vs push model."**
   Prometheus pulls metrics from targets on a schedule. Pros: simpler, knows when targets are down, no data loss if monitor restarts. Cons: can't monitor short-lived jobs easily, requires exposing /metrics endpoint.

5. **"What's idempotency and why does it matter in infrastructure?"**
   Running the same config twice produces the same state. Essential for automation — CI/CD pipelines, auto-scaling, disaster recovery all depend on it.

6. **"Why YAML instead of JSON for config files?"**
   Comments, no quotes required for keys, no trailing commas, more human-readable for nested structures. JSON is for machine-to-machine (APIs), YAML is for human-to-machine (configs).

7. **"What are the 12-factor app principles?"**
   A methodology for building cloud-native apps. Key factors: codebase (one repo per app), dependencies (explicitly declared), config (env vars, not hardcoded), backing services (attached resources), dev/prod parity (same everywhere), logs (event streams), admin processes (one-off tasks run as part of the app).
