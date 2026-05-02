from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.budget import (
    CreateBudgetRequest,
    UpdateBudgetRequest,
    BudgetProgressResponse,
)
from app.services.budget_service import BudgetService

router = APIRouter(
    prefix="/households/{household_id}/budgets",
    tags=["Budgets"],
)


def get_budget_service(db: Session = Depends(get_db)) -> BudgetService:
    """Dependency that provides a BudgetService instance."""
    return BudgetService(db)


# --- Endpoints ---


@router.get("", response_model=list[BudgetProgressResponse])
def list_budgets(
    household_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: BudgetService = Depends(get_budget_service),
):
    """List all budgets for a household with spending progress. Any member can view."""
    budgets = service.list_budgets(household_id, user_id)
    return [BudgetProgressResponse(**b) for b in budgets]


@router.get("/{budget_id}", response_model=BudgetProgressResponse)
def get_budget(
    household_id: UUID,
    budget_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: BudgetService = Depends(get_budget_service),
):
    """Get a single budget with spending progress. Any member can view."""
    budget = service.get_budget(household_id, budget_id, user_id)
    return BudgetProgressResponse(**budget)


@router.post("", response_model=BudgetProgressResponse, status_code=status.HTTP_201_CREATED)
def create_budget(
    household_id: UUID,
    body: CreateBudgetRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: BudgetService = Depends(get_budget_service),
):
    """Create a new budget. Requires owner or admin role."""
    budget = service.create_budget(
        household_id=household_id,
        user_id=user_id,
        name=body.name,
        amount=body.amount,
        period_start=body.period_start,
        period_end=body.period_end,
        category_id=body.category_id,
        description=body.description,
    )
    return BudgetProgressResponse(**budget)


@router.patch("/{budget_id}", response_model=BudgetProgressResponse)
def update_budget(
    household_id: UUID,
    budget_id: UUID,
    body: UpdateBudgetRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: BudgetService = Depends(get_budget_service),
):
    """Update a budget. Requires owner or admin role."""
    updates = body.model_dump(exclude_unset=True)
    budget = service.update_budget(
        household_id=household_id,
        budget_id=budget_id,
        user_id=user_id,
        **updates,
    )
    return BudgetProgressResponse(**budget)


@router.delete("/{budget_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_budget(
    household_id: UUID,
    budget_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: BudgetService = Depends(get_budget_service),
):
    """Delete a budget. Requires owner or admin role."""
    service.delete_budget(household_id, budget_id, user_id)
    return None
