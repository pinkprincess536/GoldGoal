from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.core.database import engine, Base
from app.routers import auth, portfolio


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(auth.router)
app.include_router(portfolio.router)


@app.get("/health")
def health_check():
    return {"status": "ok"}
