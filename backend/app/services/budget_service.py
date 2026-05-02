from uuid import UUID
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.budget import Budget
from app.models.household_member import MemberRole
from app.models.category import CategoryType
from app.repositories.budget_repository import BudgetRepository
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository
from app.repositories.category_repository import CategoryRepository


class BudgetService:
    """Business logic for household budget management."""

    def __init__(self, db: Session):
        self.db = db
        self.budget_repo = BudgetRepository(db)
        self.expense_repo = ExpenseRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)
        self.category_repo = CategoryRepository(db)

    # --- List Budgets (with progress) ---

    def list_budgets(self, household_id: UUID, user_id: UUID) -> list[dict]:
        """Return all budgets for a household with spending progress.

        Any member can list budgets.
        """
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)

        budgets = self.budget_repo.get_by_household(household_id)
        return [self._enrich_with_progress(b) for b in budgets]

    # --- Get Single Budget (with progress) ---

    def get_budget(
        self, household_id: UUID, budget_id: UUID, user_id: UUID
    ) -> dict:
        """Fetch a single budget with spending progress. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        budget = self._get_budget_or_404(budget_id)
        self._verify_budget_belongs_to_household(budget, household_id)
        return self._enrich_with_progress(budget)

    # --- Create Budget ---

    def create_budget(
        self,
        household_id: UUID,
        user_id: UUID,
        name: str,
        amount: Decimal,
        period_start: date,
        period_end: date,
        category_id: UUID | None = None,
        description: str | None = None,
    ) -> dict:
        """Create a new budget. Only owners/admins can create."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        if category_id:
            self._validate_expense_category(category_id, household_id)

        budget = self.budget_repo.create(
            household_id=household_id,
            created_by=user_id,
            name=name,
            amount=amount,
            period_start=period_start,
            period_end=period_end,
            category_id=category_id,
            description=description,
        )
        self.db.commit()
        self.db.refresh(budget)
        return self._enrich_with_progress(budget)

    # --- Update Budget ---

    def update_budget(
        self,
        household_id: UUID,
        budget_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> dict:
        """Update a budget. Only owners/admins can update."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        budget = self._get_budget_or_404(budget_id)
        self._verify_budget_belongs_to_household(budget, household_id)

        # Validate category if being updated
        if "category_id" in kwargs and kwargs["category_id"] is not None:
            self._validate_expense_category(kwargs["category_id"], household_id)

        # Validate period if dates are changing
        new_start = kwargs.get("period_start") or budget.period_start
        new_end = kwargs.get("period_end") or budget.period_end
        if new_end < new_start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="period_end must be >= period_start",
            )

        updated = self.budget_repo.update(budget, **kwargs)
        self.db.commit()
        self.db.refresh(updated)
        return self._enrich_with_progress(updated)

    # --- Delete Budget ---

    def delete_budget(
        self, household_id: UUID, budget_id: UUID, user_id: UUID
    ) -> None:
        """Delete a budget. Only owners/admins can delete."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        budget = self._get_budget_or_404(budget_id)
        self._verify_budget_belongs_to_household(budget, household_id)

        self.budget_repo.delete(budget)
        self.db.commit()

    # --- Progress Calculation ---

    def _enrich_with_progress(self, budget: Budget) -> dict:
        """Calculate spending progress for a budget from actual expenses.

        - If budget has a category_id: sum expenses with that category in the period.
        - If no category_id: sum ALL expenses in the household for the period.
        """
        expense_count, spent = self.expense_repo.count_and_sum(
            household_id=budget.household_id,
            category_id=budget.category_id,
            date_from=budget.period_start,
            date_to=budget.period_end,
        )

        remaining = budget.amount - spent
        percentage = (
            float(spent / budget.amount * 100) if budget.amount > 0 else 0.0
        )

        return {
            "id": budget.id,
            "household_id": budget.household_id,
            "category_id": budget.category_id,
            "created_by": budget.created_by,
            "name": budget.name,
            "description": budget.description,
            "amount": budget.amount,
            "period_start": budget.period_start,
            "period_end": budget.period_end,
            "created_at": budget.created_at,
            "updated_at": budget.updated_at,
            "spent": spent,
            "remaining": remaining,
            "percentage_used": round(percentage, 2),
            "expense_count": expense_count,
        }

    # --- Private Helpers ---

    def _require_household_exists(self, household_id: UUID) -> None:
        household = self.household_repo.get_by_id(household_id)
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Household not found",
            )

    def _require_membership(self, household_id: UUID, user_id: UUID):
        membership = self.member_repo.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household",
            )
        return membership

    def _require_role(self, membership, allowed_roles: list[MemberRole]) -> None:
        allowed_values = [r.value for r in allowed_roles]
        if membership.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_values)}",
            )

    def _get_budget_or_404(self, budget_id: UUID) -> Budget:
        budget = self.budget_repo.get_by_id(budget_id)
        if not budget:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Budget not found",
            )
        return budget

    def _verify_budget_belongs_to_household(
        self, budget: Budget, household_id: UUID
    ) -> None:
        if budget.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Budget not found in this household",
            )

    def _validate_expense_category(
        self, category_id: UUID, household_id: UUID
    ) -> None:
        """Verify category exists, belongs to household, and is expense type."""
        category = self.category_repo.get_by_id(category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found",
            )
        if category.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category does not belong to this household",
            )
        if category.category_type != CategoryType.EXPENSE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Budget category must be of type 'expense', got '{category.category_type}'",
            )
