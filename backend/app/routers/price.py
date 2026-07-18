from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import gold_price

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/latest")
def latest_price(
    db: Session = Depends(get_db),
    purity: str = Query(default="24k", pattern="^(24k|22k|21k|20k|18k|16k|14k|10k)$"),
):
    """
    Get the latest gold price. Pass ?purity=22k to see price for 22-karat gold.
    The stored price is always 24k; we adjust by (purity / 24).
    """
    row = gold_price.get_latest(db)
    if not row:
        return {"date": None, "price_per_gram": 7500.0, "purity": purity}

    factor = gold_price._purity_factor(purity)
    return {
        "date": row.date.isoformat(),
        "price_per_gram_24k": round(row.price_per_gram, 2),
        "price_per_gram": round(row.price_per_gram * factor, 2),
        "purity": purity,
        "source": row.source,
    }


@router.get("/history")
def price_history(
    db: Session = Depends(get_db),
    days: int = Query(default=90, ge=1, le=3650),
    purity: str = Query(default="24k", pattern="^(24k|22k|21k|20k|18k|16k|14k|10k)$"),
):
    """Historical gold prices, adjusted to requested purity."""
    prices = gold_price.get_prices(db, limit=days)
    factor = gold_price._purity_factor(purity)
    return [
        {
            "date": p.date.isoformat(),
            "price_per_gram_24k": round(p.price_per_gram, 2),
            "price_per_gram": round(p.price_per_gram * factor, 2),
            "purity": purity,
            "source": p.source,
        }
        for p in reversed(prices)
    ]


@router.post("/update")
def trigger_daily_update(db: Session = Depends(get_db)):
    """
    Fetch today's live gold price and save it.
    Called daily by EventBridge → Lambda (Phase 7).
    Also checks all user alerts (Phase 5b — coming next).
    """
    new_price = gold_price.update_today_price(db)
    if new_price is None:
        return {"status": "skipped", "reason": "API unavailable"}

    return {
        "status": "updated",
        "date": new_price.date.isoformat(),
        "price_per_gram_24k": new_price.price_per_gram,
    }
