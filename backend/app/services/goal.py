from datetime import date, datetime, timezone

from sqlalchemy.orm import Session

from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalUpdate, GoalOut, GoalProgress
from app.services.portfolio import get_purchases, CURRENT_GOLD_PRICE


def create_goal(db: Session, user_id: str, data: GoalCreate) -> Goal:
    goal = Goal(
        user_id=user_id,
        name=data.name,
        target_grams=data.target_grams,
        target_date=data.target_date,
        monthly_budget=data.monthly_budget,
        notes=data.notes,
    )
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return goal


def get_goals(db: Session, user_id: str) -> list[Goal]:
    return db.query(Goal).filter(Goal.user_id == user_id).order_by(Goal.created_at.desc()).all()


def get_goal(db: Session, user_id: str, goal_id: str) -> Goal | None:
    return db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user_id).first()


def update_goal(db: Session, user_id: str, goal_id: str, data: GoalUpdate) -> Goal | None:
    goal = get_goal(db, user_id, goal_id)
    if not goal:
        return None

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(goal, field, value)

    db.commit()
    db.refresh(goal)
    return goal


def delete_goal(db: Session, user_id: str, goal_id: str) -> bool:
    goal = get_goal(db, user_id, goal_id)
    if not goal:
        return False
    db.delete(goal)
    db.commit()
    return True


def get_progress(db: Session, user_id: str, goal_id: str) -> GoalProgress | None:
    goal = get_goal(db, user_id, goal_id)
    if not goal:
        return None

    purchases = get_purchases(db, user_id)
    acquired_grams = sum(p.grams for p in purchases)
    remaining_grams = max(goal.target_grams - acquired_grams, 0)
    completion_pct = round((acquired_grams / goal.target_grams) * 100, 1) if goal.target_grams > 0 else 0.0
    estimated_cost_remaining = remaining_grams * CURRENT_GOLD_PRICE

    if goal.monthly_budget > 0:
        grams_per_month = goal.monthly_budget / CURRENT_GOLD_PRICE
        months_to_completion = remaining_grams / grams_per_month
        from datetime import timedelta
        estimated_date = datetime.now(timezone.utc).date() + timedelta(days=int(months_to_completion * 30))
        months_val = round(months_to_completion, 1)
    else:
        months_to_completion = None
        estimated_date = None
        months_val = None

    return GoalProgress(
        goal=GoalOut.model_validate(goal),
        acquired_grams=round(acquired_grams, 2),
        remaining_grams=round(remaining_grams, 2),
        completion_pct=round(completion_pct, 1),
        current_gold_price=CURRENT_GOLD_PRICE,
        estimated_cost_remaining=round(estimated_cost_remaining, 2),
        months_to_completion=months_val,
        estimated_completion_date=estimated_date,
    )
