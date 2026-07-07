# Phase 2 Revision — Concepts & Commands Learned

## Concepts

### 1. Docker Compose
A file (`docker-compose.yml`) that defines multiple containers and how they talk to each other. One command starts everything. No manual setup.

### 2. Container vs Image
- **Image** = a blueprint (like a recipe). Created from a Dockerfile.
- **Container** = a running instance of an image (like a cooked dish). You can run multiple containers from one image.

### 3. Port Mapping (`"8000:8000"`)
- Left side = port on your laptop (host)
- Right side = port inside the container
- Without it, nothing outside the container can reach in.

### 4. Bind Mount vs Named Volume
- **Bind mount** (`./backend:/app`) = your local folder linked to container. Edit code → instant update. Used for development.
- **Named volume** (`pgdata:/var/lib/...`) = Docker-managed storage. Survives container restarts. Used for database data.

### 5. depends_on with health check
`depends_on` alone waits for the container process to start. `condition: service_healthy` waits until the service is actually functional (e.g., PostgreSQL accepting connections). Prevents race conditions on startup.

### 6. Service Discovery
Docker Compose creates an internal network. Service names (`db`, `api`) become DNS hostnames. No IP addresses needed.

### 7. Environment Variables with Fallback
`${POSTGRES_USER:-goldgoal}` means "use POSTGRES_USER env var, or default to 'goldgoal' if not set." Works without a .env file.

### 8. Backend Architecture — 5 Folders

| Folder | Job | Analogy |
|--------|-----|---------|
| `core/` | Shared tools (config, database connection, security) | Electricity and plumbing |
| `models/` | Database table definitions | Storage room layout |
| `schemas/` | Validates request/response data | Door security (bouncer) |
| `services/` | Business logic (the actual work) | Kitchen (chef) |
| `routers/` | HTTP endpoints (routes requests) | Waiters |

### 9. Models vs Schemas
- **Model** = what's stored in the database (all fields, permanent). e.g., User has id, email, hashed_password, full_name, created_at, updated_at.
- **Schema** = what comes in/out of a specific API request (subset of fields, temporary). e.g., Signup only needs email, password, full_name.

### 10. Password Hashing (bcrypt)
- Never store raw passwords. Hash them into unreadable strings.
- Hashing is one-way — you can't reverse it.
- `verify_password("hello", stored_hash)` → True or False.
- bcrypt is deliberately slow to resist brute-force attacks.

### 11. JWT (JSON Web Token)
- After login, user gets a signed token containing their user_id and expiry.
- Sent with every request in the `Authorization: Bearer ...` header.
- `get_current_user` automatically decodes it, verifies it, and loads the user from DB.
- Self-contained — no session table needed in database.

### 12. Dependency Injection (Depends)
FastAPI feature: `db: Session = Depends(get_db)` means "run get_db() and pass the result as `db` before this function executes." Keeps route functions clean.

### 13. Startup Sequence
```
docker compose up
  → PostgreSQL starts → health check passes
  → FastAPI starts → creates tables via Base.metadata.create_all()
  → Prometheus starts scraping /metrics
  → Grafana starts
```

---

## Commands Learned

### Docker

| Command | What it does |
|---------|-------------|
| `docker compose up` | Start all services (build if needed, or use existing images) |
| `docker compose up --build` | Rebuild images, then start. Use when Dockerfile or requirements.txt changed. |
| `docker compose down` | Stop and remove containers. Volumes survive. |
| `docker compose build --no-cache` | Rebuild images from scratch. Use when cache is corrupted. |
| `docker ps` | List running containers. Empty = nothing running. |
| `docker compose logs` | Show logs from all services. |
| `docker compose logs api` | Show logs from only the api service. |
| `docker pull python:3.11-slim` | Download a pre-built image manually. |

### Git

| Command | What it does |
|---------|-------------|
| `git status` | Show changed/untracked files |
| `git add -A` | Stage all changes |
| `git commit -m "msg"` | Save staged changes with a message |
| `git push` | Upload commits to GitHub |
| `git pull` | Download commits (only on different machine) |

### Testing API (PowerShell)

| Command | What it does |
|---------|-------------|
| `Invoke-RestMethod -Uri url -Method Post -ContentType "application/json" -Body '...'` | Send a POST request with JSON body |
| `Invoke-RestMethod -Uri url -Method Get` | Send a GET request |

### Testing API (Git Bash / Linux)

| Command | What it does |
|---------|-------------|
| `curl http://localhost:8000/health` | Check if API is alive |
| `curl -X POST url -H "Content-Type: application/json" -d '...'` | Send POST with JSON |

---

## Command Choice Guide

| Situation | Command |
|-----------|---------|
| Starting fresh | `docker compose up --build` |
| Restarting after code change | `docker compose up` (bind mounts handle it) |
| Changed requirements.txt | `docker compose up --build` |
| Cache corrupted / weird errors | `docker compose build --no-cache` then `docker compose up` |
| Checking if containers are running | `docker ps` |
| Debugging errors | `docker compose logs api` |
| Saving work to GitHub | `git add -A` → `git commit -m "msg"` → `git push` |
| Getting latest from GitHub | `git pull` (different machine only) |
