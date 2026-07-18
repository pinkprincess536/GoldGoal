from sqlalchemy.orm import Session

from app.models.purchase import Purchase
from app.schemas.purchase import PurchaseCreate, PortfolioSummary
from app.services.gold_price import get_latest_price


def add_purchase(db: Session, user_id: str, data: PurchaseCreate) -> Purchase:
    purchase = Purchase(
        user_id=user_id,
        purchase_date=data.purchase_date,
        grams=data.grams,
        price_per_gram=data.price_per_gram,
        total_amount=data.total_amount,
        purchase_type=data.purchase_type,
        notes=data.notes,
    )
    db.add(purchase)
    db.commit()
    db.refresh(purchase)
    return purchase


def get_purchases(db: Session, user_id: str) -> list[Purchase]:
    return db.query(Purchase).filter(Purchase.user_id == user_id).order_by(Purchase.purchase_date.desc()).all()


def get_summary(db: Session, user_id: str) -> PortfolioSummary:
    purchases = get_purchases(db, user_id)
    current_price = get_latest_price(db)

    total_grams = sum(p.grams for p in purchases)
    total_invested = sum(p.total_amount for p in purchases)
    avg_price = total_invested / total_grams if total_grams > 0 else 0.0
    current_value = total_grams * current_price
    profit_loss = current_value - total_invested

    return PortfolioSummary(
        total_grams=round(total_grams, 2),
        total_invested=round(total_invested, 2),
        avg_price_per_gram=round(avg_price, 2),
        current_price_per_gram=round(current_price, 2),
        current_value=round(current_value, 2),
        profit_loss=round(profit_loss, 2),
        purchase_count=len(purchases),
    )
