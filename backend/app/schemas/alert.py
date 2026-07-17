from pydantic import BaseModel, Field


class AlertCreate(BaseModel):
    alert_type: str = Field(pattern="^(price_drop|price_rise|goal_milestone)$")
    threshold_value: float | None = None


class AlertOut(BaseModel):
    id: str
    user_id: str
    alert_type: str
    threshold_value: float | None
    is_active: bool
    created_at: str

    class Config:
        from_attributes = True
