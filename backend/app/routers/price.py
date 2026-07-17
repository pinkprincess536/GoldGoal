from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.services import gold_price, alert, prediction

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("/latest")
def latest_price(db: Session = Depends(get_db)):
    result = gold_price.get_latest(db)
    if not result:
        return {"date": None, "price_per_gram": 7500.0}
    return {"date": result.date.isoformat(), "price_per_gram": result.price_per_gram, "source": result.source}


@router.get("/history")
def price_history(db: Session = Depends(get_db), days: int = Query(default=90, ge=1, le=3650)):
    prices = gold_price.get_prices(db, limit=days)
    return [
        {"date": p.date.isoformat(), "price_per_gram": p.price_per_gram, "source": p.source}
        for p in reversed(prices)
    ]


@router.post("/update")
def trigger_daily_update(db: Session = Depends(get_db)):
    """
    Fetch today's live gold price, save it, and check all active alerts.
    Called daily by EventBridge → Lambda (Phase 7).
    """
    new_price = gold_price.update_today_price(db)
    if new_price is None:
        return {"status": "skipped", "reason": "API unavailable or no price returned"}

    triggered = alert.check_alerts(db, new_price.price_per_gram)
    for a in triggered:
        gold_price.log_notification(db, a.user_id, "email",
            f"Gold price alert: ₹{new_price.price_per_gram}/g", "sent")

    return {
        "status": "updated",
        "price": new_price.price_per_gram,
        "date": new_price.date.isoformat(),
        "alerts_triggered": len(triggered),
    }


@router.get("/predict")
def predict_price(db: Session = Depends(get_db)):
    """63-day forward gold price prediction using ML ensemble."""
    result = prediction.get_63day_prediction(db)
    if result is None:
        return {"status": "unavailable", "reason": "Models not trained yet. Run python -m ml_models.pipeline first."}
    return {"status": "ok", **result}
