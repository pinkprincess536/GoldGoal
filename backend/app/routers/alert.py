from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.alert import AlertCreate, AlertOut
from app.services import alert

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.post("/", response_model=AlertOut, status_code=status.HTTP_201_CREATED)
def create_alert(
    data: AlertCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert.create_alert(db, current_user.id, data)


@router.get("/", response_model=list[AlertOut])
def list_alerts(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert.get_alerts(db, current_user.id)


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_alert(
    alert_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = alert.delete_alert(db, current_user.id, alert_id)
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
