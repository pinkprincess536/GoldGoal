import csv
from datetime import datetime, timezone, date

import requests
from sqlalchemy.orm import Session

from app.models.gold_price import GoldPrice
from app.models.notification import NotificationHistory


def _csv_path():
    from pathlib import Path
    return Path(__file__).resolve().parents[4] / "data" / "gold.csv"


def seed_prices(db: Session) -> int:
    if db.query(GoldPrice).first():
        return 0

    count = 0
    try:
        with open(_csv_path()) as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    price_date = datetime.strptime(row["Date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    price_val = float(row["Price"])
                except (ValueError, KeyError):
                    continue

                db.add(GoldPrice(date=price_date, price_per_gram=price_val / 10))
                count += 1
    except FileNotFoundError:
        pass

    db.commit()
    return count


def fetch_live_price() -> float | None:
    """Fetch current gold price from an external API. Returns price per gram in INR, or None."""
    try:
        resp = requests.get(
            "https://api.metals.live/v1/spot/gold",
            timeout=10,
        )
        if resp.status_code == 200:
            data = resp.json()
            if isinstance(data, list) and len(data) > 0:
                usd_per_oz = float(data[0].get("price", 0))
                usd_per_gram = usd_per_oz / 31.1035
                return round(usd_per_gram, 2)
    except Exception:
        pass

    return None


def update_today_price(db: Session) -> GoldPrice | None:
    """Fetch live price and save it for today. Returns the new GoldPrice or None."""
    price = fetch_live_price()
    if price is None:
        return None

    today = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    existing = db.query(GoldPrice).filter(GoldPrice.date == today).first()
    if existing:
        existing.price_per_gram = price
        existing.source = "api"
    else:
        existing = GoldPrice(date=today, price_per_gram=price, source="api")
        db.add(existing)

    db.commit()
    db.refresh(existing)
    return existing


def get_latest_price(db: Session) -> float:
    result = db.query(GoldPrice).order_by(GoldPrice.date.desc()).first()
    if result:
        return result.price_per_gram
    return 7500.0


def get_latest(db: Session) -> GoldPrice | None:
    return db.query(GoldPrice).order_by(GoldPrice.date.desc()).first()


def get_prices(db: Session, limit: int = 365) -> list[GoldPrice]:
    return db.query(GoldPrice).order_by(GoldPrice.date.desc()).limit(limit).all()


def log_notification(db: Session, user_id: str, notif_type: str, subject: str, status: str) -> None:
    db.add(NotificationHistory(
        user_id=user_id,
        notification_type=notif_type,
        subject=subject,
        status=status,
    ))
    db.commit()
