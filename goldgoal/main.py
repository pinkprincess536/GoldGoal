"""
GoldGoal FastAPI application factory.

create_app() builds and returns the FastAPI instance.
Run locally with:
    uvicorn goldgoal.main:app --reload

The app is intentionally minimal in Phase 0 — no routes yet.
Routes are registered in Phase 1 as each service is implemented.
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from goldgoal.db.session import engine, Base


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Startup / shutdown lifecycle handler.

    Startup: create all database tables that don't exist yet (dev convenience).
    In production, Alembic migrations handle schema changes instead.
    """
    Base.metadata.create_all(bind=engine)
    yield
    # Nothing to clean up on shutdown in Phase 0.


def create_app() -> FastAPI:
    """Build the FastAPI application."""
    app = FastAPI(
        title="GoldGoal API",
        description="Personal gold investment tracker and goal planning platform.",
        version="0.1.0",
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # ── Health endpoints ─────────────────────────────────────────────────
    # Used by Docker Compose healthcheck and later by the AWS ALB.
    @app.get("/health", tags=["ops"])
    def health():
        """Liveness probe — returns 200 if the process is running."""
        return {"status": "ok"}

    @app.get("/ready", tags=["ops"])
    def ready():
        """Readiness probe — returns 200 if the app is ready to serve traffic."""
        return {"status": "ready"}

    # Phase 1: routers and exception handlers will be registered here.

    return app


# Module-level app instance so uvicorn can find it with:
#   uvicorn goldgoal.main:app
app = create_app()
