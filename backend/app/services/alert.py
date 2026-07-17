from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.schemas.alert import AlertCreate


def create_alert(db: Session, user_id: str, data: AlertCreate) -> Alert:
    alert = Alert(
        user_id=user_id,
        alert_type=data.alert_type,
        threshold_value=data.threshold_value,
    )
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def get_alerts(db: Session, user_id: str) -> list[Alert]:
    return db.query(Alert).filter(Alert.user_id == user_id).order_by(Alert.created_at.desc()).all()


def delete_alert(db: Session, user_id: str, alert_id: str) -> bool:
    alert = db.query(Alert).filter(Alert.id == alert_id, Alert.user_id == user_id).first()
    if not alert:
        return False
    db.delete(alert)
    db.commit()
    return True


def check_alerts(db: Session, current_price: float) -> list[Alert]:
    """Find all active alerts triggered by the current price."""
    triggered = []

    price_drops = db.query(Alert).filter(
        Alert.alert_type == "price_drop",
        Alert.is_active == True,
        Alert.threshold_value >= current_price,
    ).all()
    triggered.extend(price_drops)

    price_rises = db.query(Alert).filter(
        Alert.alert_type == "price_rise",
        Alert.is_active == True,
        Alert.threshold_value <= current_price,
    ).all()
    triggered.extend(price_rises)

    return triggered
