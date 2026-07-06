"""
Database engine, session factory, and FastAPI dependency.

How it works:
- SQLAlchemy Base: all ORM table classes inherit from this.
- engine: the connection to the database file/server.
- SessionLocal: a factory that creates individual database sessions.
- get_db(): a FastAPI dependency — each HTTP request gets its own
  session, which is closed automatically when the request finishes.

DATABASE_URL env var:
  Not set  → SQLite file at repo root (local dev, zero setup)
  Set      → use that URL (PostgreSQL on AWS RDS in prod)

The same Python code works for both. SQLAlchemy handles the dialect.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

# Default to a local SQLite file for zero-setup development.
# In production (Phase 7) this will be a PostgreSQL URL from Secrets Manager.
DATABASE_URL = os.getenv(
    "GOLDGOAL_DATABASE_URL",
    "sqlite:///./goldgoal.db",
)

# connect_args is SQLite-only: allows the same connection to be used
# across threads (needed because FastAPI uses a thread pool).
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)

# Each call to SessionLocal() creates a new database session.
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# All ORM model classes inherit from Base so SQLAlchemy knows about them.
Base = declarative_base()


def get_db():
    """
    FastAPI dependency: yields a database session per request.

    Usage in a router:
        @router.get("/example")
        def example(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
