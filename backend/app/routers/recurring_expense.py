from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.recurring_expense import (
    CreateRecurringExpenseRequest,
    UpdateRecurringExpenseRequest,
    RecurringExpenseResponse,
    RecurringExpenseListResponse,
    GenerateResult,
    UpcomingExpense,
)
from app.services.recurring_expense_service import RecurringExpenseService

router = APIRouter(
    prefix="/households/{household_id}/recurring-expenses",
    tags=["Recurring Expenses"],
)


def get_service(db: Session = Depends(get_db)) -> RecurringExpenseService:
    """Dependency that provides a RecurringExpenseService instance."""
    return RecurringExpenseService(db)


# --- CRUD Endpoints ---


@router.get("", response_model=RecurringExpenseListResponse)
def list_recurring_expenses(
    household_id: UUID,
    is_active: bool | None = Query(None, description="Filter by active status"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """List recurring expense rules for a household. Any member can view."""
    result = service.list_rules(
        household_id=household_id,
        user_id=user_id,
        is_active=is_active,
        limit=limit,
        offset=offset,
    )
    return RecurringExpenseListResponse(
        rules=[RecurringExpenseResponse.model_validate(r) for r in result["rules"]],
        total_count=result["total_count"],
    )


@router.get("/upcoming", response_model=list[UpcomingExpense])
def get_upcoming_expenses(
    household_id: UUID,
    within_days: int = Query(30, ge=1, le=365, description="Days to look ahead"),
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """Get upcoming recurring expenses within N days. Any member can view."""
    return [
        UpcomingExpense(**item)
        for item in service.get_upcoming(household_id, user_id, within_days)
    ]


@router.get("/{rule_id}", response_model=RecurringExpenseResponse)
def get_recurring_expense(
    household_id: UUID,
    rule_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """Get a single recurring expense rule. Any member can view."""
    rule = service.get_rule(household_id, rule_id, user_id)
    return RecurringExpenseResponse.model_validate(rule)


@router.post("", response_model=RecurringExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_recurring_expense(
    household_id: UUID,
    body: CreateRecurringExpenseRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """Create a new recurring expense rule. Members/admins/owners can create."""
    rule = service.create_rule(
        household_id=household_id,
        user_id=user_id,
        title=body.title,
        amount=body.amount,
        frequency=body.frequency.value,
        next_due_date=body.next_due_date,
        category_id=body.category_id,
        description=body.description,
        payment_method=body.payment_method.value if body.payment_method else None,
        notes=body.notes,
    )
    return RecurringExpenseResponse.model_validate(rule)


@router.patch("/{rule_id}", response_model=RecurringExpenseResponse)
def update_recurring_expense(
    household_id: UUID,
    rule_id: UUID,
    body: UpdateRecurringExpenseRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """Update a recurring expense rule. Creator or owner/admin can update."""
    updates = body.model_dump(exclude_unset=True)
    if "frequency" in updates and updates["frequency"] is not None:
        updates["frequency"] = updates["frequency"].value
    if "payment_method" in updates and updates["payment_method"] is not None:
        updates["payment_method"] = updates["payment_method"].value
    rule = service.update_rule(
        household_id=household_id,
        rule_id=rule_id,
        user_id=user_id,
        **updates,
    )
    return RecurringExpenseResponse.model_validate(rule)


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_recurring_expense(
    household_id: UUID,
    rule_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """Delete a recurring expense rule. Creator or owner/admin can delete."""
    service.delete_rule(household_id, rule_id, user_id)
    return None


# --- Generation Endpoint ---


@router.post("/generate", response_model=GenerateResult)
def generate_due_expenses(
    household_id: UUID,
    as_of: date | None = Query(None, description="Generate up to this date (defaults to today)"),
    user_id: UUID = Depends(get_current_user_id),
    service: RecurringExpenseService = Depends(get_service),
):
    """Manually generate expenses from all due recurring rules.

    For each active rule with next_due_date <= as_of:
    - Creates a normal expense record (appears in expenses list)
    - Logs the generation to prevent duplicates
    - Advances the rule's next_due_date
    """
    result = service.generate_due_expenses(household_id, user_id, as_of)
    return GenerateResult(**result)
