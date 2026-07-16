from datetime import date, datetime

from pydantic import BaseModel, Field


class GoalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    target_grams: float = Field(gt=0)
    target_date: date
    monthly_budget: float = Field(ge=0, default=0.0)
    notes: str | None = Field(default=None, max_length=500)


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    target_grams: float | None = Field(default=None, gt=0)
    target_date: date | None = None
    monthly_budget: float | None = Field(default=None, ge=0)
    notes: str | None = Field(default=None, max_length=500)


class GoalOut(BaseModel):
    id: str
    user_id: str
    name: str
    target_grams: float
    target_date: date
    monthly_budget: float
    notes: str | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class GoalProgress(BaseModel):
    goal: GoalOut
    acquired_grams: float
    remaining_grams: float
    completion_pct: float
    current_gold_price: float
    estimated_cost_remaining: float
    months_to_completion: float | None
    estimated_completion_date: date | None
