from datetime import datetime

from pydantic import BaseModel, Field


class PurchaseCreate(BaseModel):
    grams: float = Field(gt=0)
    price_per_gram: float = Field(gt=0)
    total_amount: float = Field(gt=0)
    purchase_date: datetime
    purchase_type: str = Field(pattern="^(physical|etf|bond)$")
    notes: str | None = Field(default=None, max_length=500)


class PurchaseOut(BaseModel):
    id: str
    user_id: str
    purchase_date: datetime
    grams: float
    price_per_gram: float
    total_amount: float
    purchase_type: str
    notes: str | None
    created_at: datetime

    class Config:
        from_attributes = True


class PortfolioSummary(BaseModel):
    total_grams: float
    total_invested: float
    avg_price_per_gram: float
    current_price_per_gram: float
    current_value: float
    profit_loss: float
    purchase_count: int
