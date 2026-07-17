from contextlib import asynccontextmanager

from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator

from app.core.database import engine, Base, SessionLocal
from app.routers import auth, portfolio, goal, price, alert
from app.services.gold_price import seed_prices


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_prices(db)
    finally:
        db.close()
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(auth.router)
app.include_router(portfolio.router)
app.include_router(goal.router)
app.include_router(price.router)
app.include_router(alert.router)

Instrumentator().instrument(app).expose(app)


@app.get("/health")
def health_check():
    return {"status": "ok"}
