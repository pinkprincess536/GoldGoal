from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.purchase import PurchaseCreate, PurchaseOut, PortfolioSummary
from app.services import portfolio

router = APIRouter(prefix="/portfolio", tags=["portfolio"])


@router.post("/purchases", response_model=PurchaseOut, status_code=201)
def add_purchase(
    data: PurchaseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return portfolio.add_purchase(db, current_user.id, data)


@router.get("/purchases", response_model=list[PurchaseOut])
def list_purchases(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return portfolio.get_purchases(db, current_user.id)


@router.get("/summary", response_model=PortfolioSummary)
def get_summary(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return portfolio.get_summary(db, current_user.id)
