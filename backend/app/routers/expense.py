from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.expense import (
    CreateExpenseRequest,
    UpdateExpenseRequest,
    ExpenseResponse,
    ExpenseListResponse,
)
from app.services.expense_service import ExpenseService

router = APIRouter(
    prefix="/households/{household_id}/expenses",
    tags=["Expenses"],
)


def get_expense_service(db: Session = Depends(get_db)) -> ExpenseService:
    """Dependency that provides an ExpenseService instance."""
    return ExpenseService(db)


# --- Endpoints ---


@router.get("", response_model=ExpenseListResponse)
def list_expenses(
    household_id: UUID,
    category_id: UUID | None = Query(None, description="Filter by category"),
    created_by: UUID | None = Query(None, description="Filter by creator"),
    date_from: date | None = Query(None, description="Start date (inclusive)"),
    date_to: date | None = Query(None, description="End date (inclusive)"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user_id: UUID = Depends(get_current_user_id),
    service: ExpenseService = Depends(get_expense_service),
):
    """List expenses for a household with optional filters. Any member can view."""
    result = service.list_expenses(
        household_id=household_id,
        user_id=user_id,
        category_id=category_id,
        created_by=created_by,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return ExpenseListResponse(
        expenses=[ExpenseResponse.model_validate(e) for e in result["expenses"]],
        total_count=result["total_count"],
        total_amount=result["total_amount"],
    )


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    household_id: UUID,
    expense_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: ExpenseService = Depends(get_expense_service),
):
    """Get a single expense. Any member can view."""
    expense = service.get_expense(household_id, expense_id, user_id)
    return ExpenseResponse.model_validate(expense)


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    household_id: UUID,
    body: CreateExpenseRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: ExpenseService = Depends(get_expense_service),
):
    """Create a new expense. Any member (except viewer) can create."""
    expense = service.create_expense(
        household_id=household_id,
        user_id=user_id,
        title=body.title,
        amount=body.amount,
        expense_date=body.expense_date,
        category_id=body.category_id,
        description=body.description,
        payment_method=body.payment_method.value if body.payment_method else None,
        notes=body.notes,
        is_recurring=body.is_recurring,
    )
    return ExpenseResponse.model_validate(expense)


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    household_id: UUID,
    expense_id: UUID,
    body: UpdateExpenseRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: ExpenseService = Depends(get_expense_service),
):
    """Update an expense. Creator or owner/admin can update."""
    updates = body.model_dump(exclude_unset=True)
    # Convert payment_method enum to string value
    if "payment_method" in updates and updates["payment_method"] is not None:
        updates["payment_method"] = updates["payment_method"].value
    expense = service.update_expense(
        household_id=household_id,
        expense_id=expense_id,
        user_id=user_id,
        **updates,
    )
    return ExpenseResponse.model_validate(expense)


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    household_id: UUID,
    expense_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: ExpenseService = Depends(get_expense_service),
):
    """Delete an expense. Creator or owner/admin can delete."""
    service.delete_expense(household_id, expense_id, user_id)
    return None
