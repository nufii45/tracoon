from uuid import UUID
from datetime import date
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.expense import Expense
from app.models.household_member import MemberRole
from app.models.category import CategoryType
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository
from app.repositories.category_repository import CategoryRepository


class ExpenseService:
    """Business logic for household expense management."""

    def __init__(self, db: Session):
        self.db = db
        self.expense_repo = ExpenseRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)
        self.category_repo = CategoryRepository(db)

    # --- List Expenses ---

    def list_expenses(
        self,
        household_id: UUID,
        user_id: UUID,
        category_id: UUID | None = None,
        created_by: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Return filtered expenses for a household with totals.

        Any member can list expenses.
        """
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)

        expenses = self.expense_repo.get_by_household(
            household_id=household_id,
            category_id=category_id,
            created_by=created_by,
            date_from=date_from,
            date_to=date_to,
            limit=limit,
            offset=offset,
        )
        total_count, total_amount = self.expense_repo.count_and_sum(
            household_id=household_id,
            category_id=category_id,
            created_by=created_by,
            date_from=date_from,
            date_to=date_to,
        )

        return {
            "expenses": expenses,
            "total_count": total_count,
            "total_amount": total_amount,
        }

    # --- Get Single Expense ---

    def get_expense(
        self, household_id: UUID, expense_id: UUID, user_id: UUID
    ) -> Expense:
        """Fetch a single expense. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        expense = self._get_expense_or_404(expense_id)
        self._verify_expense_belongs_to_household(expense, household_id)
        return expense

    # --- Create Expense ---

    def create_expense(
        self,
        household_id: UUID,
        user_id: UUID,
        title: str,
        amount: Decimal,
        expense_date: date,
        category_id: UUID | None = None,
        description: str | None = None,
        payment_method: str | None = None,
        notes: str | None = None,
        is_recurring: bool = False,
    ) -> Expense:
        """Create a new expense. Any member (except viewers) can create."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(
            membership,
            [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
        )

        # Validate category if provided
        if category_id:
            self._validate_expense_category(category_id, household_id)

        expense = self.expense_repo.create(
            household_id=household_id,
            created_by=user_id,
            title=title,
            amount=amount,
            expense_date=expense_date,
            category_id=category_id,
            description=description,
            payment_method=payment_method,
            notes=notes,
            is_recurring=is_recurring,
        )
        self.db.commit()
        self.db.refresh(expense)
        return expense

    # --- Update Expense ---

    def update_expense(
        self,
        household_id: UUID,
        expense_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> Expense:
        """Update an expense.

        - Members can update their own expenses.
        - Owners/admins can update any expense.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        expense = self._get_expense_or_404(expense_id)
        self._verify_expense_belongs_to_household(expense, household_id)
        self._require_edit_permission(membership, expense, user_id)

        # Validate category if being updated
        if "category_id" in kwargs and kwargs["category_id"] is not None:
            self._validate_expense_category(kwargs["category_id"], household_id)

        updated = self.expense_repo.update(expense, **kwargs)
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Delete Expense ---

    def delete_expense(
        self, household_id: UUID, expense_id: UUID, user_id: UUID
    ) -> None:
        """Delete an expense.

        - Members can delete their own expenses.
        - Owners/admins can delete any expense.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        expense = self._get_expense_or_404(expense_id)
        self._verify_expense_belongs_to_household(expense, household_id)
        self._require_edit_permission(membership, expense, user_id)

        self.expense_repo.delete(expense)
        self.db.commit()

    # --- Private Helpers ---

    def _require_household_exists(self, household_id: UUID) -> None:
        """Verify the household exists. Raises 404 if not."""
        household = self.household_repo.get_by_id(household_id)
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Household not found",
            )

    def _require_membership(self, household_id: UUID, user_id: UUID):
        """Verify user is a member. Raises 403 if not."""
        membership = self.member_repo.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household",
            )
        return membership

    def _require_role(self, membership, allowed_roles: list[MemberRole]) -> None:
        """Verify the member has one of the allowed roles. Raises 403 if not."""
        allowed_values = [r.value for r in allowed_roles]
        if membership.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_values)}",
            )

    def _require_edit_permission(self, membership, expense: Expense, user_id: UUID) -> None:
        """Check if user can edit/delete this expense.

        Owners/admins can edit any. Members can edit only their own.
        """
        is_privileged = membership.role in (
            MemberRole.OWNER.value, MemberRole.ADMIN.value
        )
        is_creator = expense.created_by == user_id
        if not is_privileged and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify expenses you created",
            )

    def _get_expense_or_404(self, expense_id: UUID) -> Expense:
        """Fetch expense or raise 404."""
        expense = self.expense_repo.get_by_id(expense_id)
        if not expense:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found",
            )
        return expense

    def _verify_expense_belongs_to_household(
        self, expense: Expense, household_id: UUID
    ) -> None:
        """Verify the expense belongs to the given household."""
        if expense.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Expense not found in this household",
            )

    def _validate_expense_category(
        self, category_id: UUID, household_id: UUID
    ) -> None:
        """Verify the category exists, belongs to the household, and is an expense type."""
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
                detail=f"Category must be of type 'expense', got '{category.category_type}'",
            )
