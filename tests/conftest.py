"""
Shared pytest fixtures for the GoldGoal test suite.

What is a fixture?
    A fixture is a function pytest runs before a test to set up
    something the test needs — a database session, an HTTP client,
    a pre-created user, etc. Tests declare what they need by name
    in their function arguments.

What is StaticPool?
    Normally SQLite creates a new file (or in-memory DB) per connection.
    StaticPool forces all connections to share ONE in-memory database,
    so fixtures and the code under test see the same data.

What is a nested transaction?
    Each test opens a transaction, runs, then rolls back.
    This means tests are fully isolated — one test's data never
    leaks into the next test, and the database stays clean.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from goldgoal.db.session import Base, get_db
from goldgoal.main import create_app


# ── In-memory database shared across all test connections ────────────────────
TEST_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,          # one shared connection = consistent in-memory state
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="session", autouse=True)
def create_tables():
    """Create all tables once for the entire test session."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture()
def db():
    """
    Per-test database session with automatic rollback.

    Each test gets a clean slate:
    1. Open a connection and begin a transaction.
    2. Yield the session to the test.
    3. Roll back everything the test did — no data persists.

    This is much faster than recreating the database for every test.
    """
    connection = engine.connect()
    transaction = connection.begin()
    session = TestingSessionLocal(bind=connection)

    yield session

    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture()
def client(db):
    """
    HTTP test client for the FastAPI app.

    Overrides the get_db dependency so every request the test client
    makes uses the same rolled-back test session (not the real DB).

    Usage:
        def test_register(client):
            response = client.post("/api/v1/auth/register", json={...})
            assert response.status_code == 201
    """
    app = create_app()

    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db

    # starlette.testclient.TestClient wraps the ASGI app synchronously —
    # no real HTTP server needed, tests run in-process.
    from starlette.testclient import TestClient
    with TestClient(app) as c:
        yield c
