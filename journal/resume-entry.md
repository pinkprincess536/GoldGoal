# GoldGoal — Resume Entry

## Projects

**GoldGoal** — Full-Stack Gold Investment Tracker & Planning Platform
*Python, FastAPI, PostgreSQL, Docker, Streamlit, AWS, Prometheus, Grafana*

- Architected a **microservices-based investment platform** with containerized backend (FastAPI) and frontend (Streamlit), orchestrated via Docker Compose across 5 services
- Designed **7-table PostgreSQL schema** with UUID primary keys, foreign key relationships, and CASCADE rules; implemented SQLAlchemy ORM for type-safe database access
- Built **JWT-based authentication** with bcrypt password hashing, stateless session management, and protected API endpoints using FastAPI dependency injection
- Implemented **defense-in-depth security**: IDOR prevention via token-derived user identity, Pydantic schema validation, and UUID-based IDs to prevent enumeration attacks
- Developed **portfolio analytics engine** calculating total holdings, weighted average cost, unrealized P&L, and goal progress tracking with projection estimates
- Containerized entire stack with **Docker**; configured Prometheus metrics scraping and Grafana dashboards for API latency and health monitoring
- Established **CI/CD architecture** plan using GitHub Actions, AWS ECR, Terraform for infrastructure-as-code (EC2, RDS, S3, Lambda, EventBridge)

---

## Skills (Bulleted)

**Languages:** Python, SQL
**Frameworks:** FastAPI, Streamlit, SQLAlchemy
**Databases:** PostgreSQL
**DevOps:** Docker, Docker Compose, Prometheus, Grafana, Git, GitHub Actions (planned), Terraform (planned)
**Cloud:** AWS (EC2, RDS, S3, Lambda, EventBridge, SNS, SES, CloudWatch — planned)
**Tools:** JWT, bcrypt, Pydantic, Uvicorn, Alembic (planned)

---

## One-Liner (for Summary Section)

Built a production-style gold investment platform with JWT authentication, portfolio analytics, and containerized microservices deployed via Docker Compose with Prometheus/Grafana monitoring.

---

## Interview Talking Points

1. **"Tell me about GoldGoal."** -> It's a full-stack financial planning platform where users track gold purchases, set ownership goals, and get ML-based completion estimates. I built it from scratch — Docker Compose orchestration, FastAPI REST API, PostgreSQL schema design, JWT auth, and the devops pipeline plan.

2. **"What was your role?"** -> Solo developer. I designed the architecture, wrote every line of backend code, configured Docker networking across 5 containers, designed the database schema, and implemented security from scratch.

3. **"Biggest technical challenge?"** -> Race condition between FastAPI and PostgreSQL at startup — solved with Docker health checks and `depends_on` with `condition: service_healthy`. Also the IDOR vulnerability — prevented by deriving user identity from JWT tokens, never from request body.

4. **"What would you do differently?"** -> Add Alembic migrations from day one instead of `create_all` on startup. Add integration tests with a test database. Use httpOnly cookies instead of Bearer headers for JWT storage in production.
