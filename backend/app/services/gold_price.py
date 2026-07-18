import csv
from datetime import datetime, timezone, date
from pathlib import Path

import requests
from sqlalchemy.orm import Session

from app.models.gold_price import GoldPrice

CSV_PATH = Path(__file__).resolve().parents[4] / "data" / "gold.csv"

# Supported gold purities (karats). 24k = pure gold.
PURITIES = {"24k": 24, "22k": 22, "21k": 21, "20k": 20, "18k": 18, "16k": 16, "14k": 14, "10k": 10}


def _purity_factor(purity: str) -> float:
    """Convert karat string like '22k' to a multiplier (22/24 = 0.9167)."""
    k = PURITIES.get(purity, 24)
    return k / 24.0


def seed_prices(db: Session) -> int:
    """Load historical prices from CSV into gold_prices table. One-time operation."""
    if db.query(GoldPrice).first():
        return 0

    count = 0
    try:
        with open(CSV_PATH) as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    dt = datetime.strptime(row["Date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    price_10g = float(row["Price"])  # CSV is ₹/10g
                except (ValueError, KeyError):
                    continue

                db.add(GoldPrice(date=dt, price_per_gram=price_10g / 10, source="csv"))
                count += 1
    except FileNotFoundError:
        pass

    db.commit()
    return count


def fetch_live_price() -> float | None:
    """
    Fetch current 24k gold price from external API. Returns INR per gram or None on failure.

    Your API should support INR currency. Example response fields used:
      - price_gram_24k: price in the requested currency
      - If currency=INR not supported, we fetch USD and convert (approx ₹83/USD).
    """
    # TODO: Replace with your actual API URL that supports INR
    API_URL = "https://api.gold-api.com/price/XAU/INR"  # placeholder — adjust this

    try:
        resp = requests.get(API_URL, timeout=10)
        if resp.status_code != 200:
            return None

        data = resp.json()

        # Try direct INR price first
        if "price_gram_24k" in data:
            return round(float(data["price_gram_24k"]), 2)

        # Fallback: USD price, convert to INR
        if "price" in data:
            usd_price = float(data["price"])  # per troy ounce
            usd_per_gram = usd_price / 31.1035
            inr_per_gram = round(usd_per_gram * 83.0, 2)  # approx USD/INR
            return inr_per_gram

        return None
    except Exception:
        return None


def update_today_price(db: Session) -> GoldPrice | None:
    """Fetch live price and upsert it for today's date."""
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
    """Return the latest 24k price per gram, or fallback to ₹7,500."""
    row = db.query(GoldPrice).order_by(GoldPrice.date.desc()).first()
    return row.price_per_gram if row else 7500.0


def get_latest(db: Session) -> GoldPrice | None:
    """Return the latest GoldPrice row (includes date, source)."""
    return db.query(GoldPrice).order_by(GoldPrice.date.desc()).first()


def get_prices(db: Session, limit: int = 365) -> list[GoldPrice]:
    """Return recent prices, newest first."""
    return db.query(GoldPrice).order_by(GoldPrice.date.desc()).limit(limit).all()
