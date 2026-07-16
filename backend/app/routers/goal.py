from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.goal import GoalCreate, GoalUpdate, GoalOut, GoalProgress
from app.services import goal

router = APIRouter(prefix="/goals", tags=["goals"])


@router.post("/", response_model=GoalOut, status_code=status.HTTP_201_CREATED)
def create_goal(
    data: GoalCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return goal.create_goal(db, current_user.id, data)


@router.get("/", response_model=list[GoalOut])
def list_goals(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return goal.get_goals(db, current_user.id)


@router.get("/{goal_id}", response_model=GoalOut)
def get_goal(
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = goal.get_goal(db, current_user.id, goal_id)
    if not result:
        raise HTTPException(status_code=404, detail="Goal not found")
    return result


@router.put("/{goal_id}", response_model=GoalOut)
def update_goal(
    goal_id: str,
    data: GoalUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = goal.update_goal(db, current_user.id, goal_id, data)
    if not result:
        raise HTTPException(status_code=404, detail="Goal not found")
    return result


@router.delete("/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_goal(
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    success = goal.delete_goal(db, current_user.id, goal_id)
    if not success:
        raise HTTPException(status_code=404, detail="Goal not found")


@router.get("/{goal_id}/progress", response_model=GoalProgress)
def get_progress(
    goal_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = goal.get_progress(db, current_user.id, goal_id)
    if not result:
        raise HTTPException(status_code=404, detail="Goal not found")
    return result
