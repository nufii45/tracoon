from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.recurring_expense import RecurringExpense
from app.models.household_member import MemberRole
from app.models.category import CategoryType
from app.repositories.recurring_expense_repository import RecurringExpenseRepository
from app.repositories.expense_repository import ExpenseRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository
from app.repositories.category_repository import CategoryRepository


def _advance_due_date(current: date, frequency: str) -> date:
    """Calculate the next due date based on frequency."""
    if frequency == "daily":
        return current + timedelta(days=1)
    elif frequency == "weekly":
        return current + timedelta(weeks=1)
    elif frequency == "biweekly":
        return current + timedelta(weeks=2)
    elif frequency == "monthly":
        month = current.month + 1
        year = current.year
        if month > 12:
            month = 1
            year += 1
        # Clamp day to max days in target month
        import calendar
        max_day = calendar.monthrange(year, month)[1]
        day = min(current.day, max_day)
        return date(year, month, day)
    elif frequency == "quarterly":
        month = current.month + 3
        year = current.year
        while month > 12:
            month -= 12
            year += 1
        import calendar
        max_day = calendar.monthrange(year, month)[1]
        day = min(current.day, max_day)
        return date(year, month, day)
    elif frequency == "yearly":
        import calendar
        year = current.year + 1
        max_day = calendar.monthrange(year, current.month)[1]
        day = min(current.day, max_day)
        return date(year, current.month, day)
    else:
        return current + timedelta(days=30)


class RecurringExpenseService:
    """Business logic for recurring expense rules and generation."""

    def __init__(self, db: Session):
        self.db = db
        self.recurring_repo = RecurringExpenseRepository(db)
        self.expense_repo = ExpenseRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)
        self.category_repo = CategoryRepository(db)

    # --- List Rules ---

    def list_rules(
        self,
        household_id: UUID,
        user_id: UUID,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Return recurring expense rules for a household. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)

        rules = self.recurring_repo.get_by_household(
            household_id=household_id,
            is_active=is_active,
            limit=limit,
            offset=offset,
        )
        total_count = self.recurring_repo.count_total(
            household_id=household_id,
            is_active=is_active,
        )
        return {"rules": rules, "total_count": total_count}

    # --- Get Single Rule ---

    def get_rule(
        self, household_id: UUID, rule_id: UUID, user_id: UUID
    ) -> RecurringExpense:
        """Fetch a single recurring rule. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        rule = self._get_rule_or_404(rule_id)
        self._verify_rule_belongs_to_household(rule, household_id)
        return rule

    # --- Create Rule ---

    def create_rule(
        self,
        household_id: UUID,
        user_id: UUID,
        title: str,
        amount: Decimal,
        frequency: str,
        next_due_date: date,
        category_id: UUID | None = None,
        description: str | None = None,
        payment_method: str | None = None,
        notes: str | None = None,
    ) -> RecurringExpense:
        """Create a new recurring expense rule. Members/admins/owners can create."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(
            membership,
            [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
        )

        if category_id:
            self._validate_expense_category(category_id, household_id)

        rule = self.recurring_repo.create(
            household_id=household_id,
            created_by=user_id,
            title=title,
            amount=amount,
            frequency=frequency,
            next_due_date=next_due_date,
            category_id=category_id,
            description=description,
            payment_method=payment_method,
            notes=notes,
        )
        self.db.commit()
        self.db.refresh(rule)
        return rule

    # --- Update Rule ---

    def update_rule(
        self,
        household_id: UUID,
        rule_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> RecurringExpense:
        """Update a recurring expense rule. Creator or owner/admin can update."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        rule = self._get_rule_or_404(rule_id)
        self._verify_rule_belongs_to_household(rule, household_id)
        self._require_edit_permission(membership, rule, user_id)

        if "category_id" in kwargs and kwargs["category_id"] is not None:
            self._validate_expense_category(kwargs["category_id"], household_id)

        updated = self.recurring_repo.update(rule, **kwargs)
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Delete Rule ---

    def delete_rule(
        self, household_id: UUID, rule_id: UUID, user_id: UUID
    ) -> None:
        """Delete a recurring expense rule. Creator or owner/admin can delete."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        rule = self._get_rule_or_404(rule_id)
        self._verify_rule_belongs_to_household(rule, household_id)
        self._require_edit_permission(membership, rule, user_id)

        self.recurring_repo.delete(rule)
        self.db.commit()

    # --- Generate Due Expenses ---

    def generate_due_expenses(
        self,
        household_id: UUID,
        user_id: UUID,
        as_of: date | None = None,
    ) -> dict:
        """Generate normal expenses from all due recurring rules.

        For each due rule whose next_due_date <= as_of:
        1. Check if already generated (via log table) — skip if so
        2. Create a normal expense record
        3. Log the generation
        4. Advance the rule's next_due_date

        Returns counts and generated expense IDs.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(
            membership,
            [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
        )

        if as_of is None:
            as_of = date.today()

        due_rules = self.recurring_repo.get_due_rules(household_id, as_of)

        generated_count = 0
        skipped_count = 0
        generated_ids: list[UUID] = []

        for rule in due_rules:
            # Process all due occurrences (rule may be multiple periods behind)
            while rule.next_due_date <= as_of:
                occurrence_date = rule.next_due_date

                # Duplicate check
                if self.recurring_repo.has_been_generated(rule.id, occurrence_date):
                    skipped_count += 1
                    rule.next_due_date = _advance_due_date(occurrence_date, rule.frequency)
                    continue

                # Create the actual expense
                expense = self.expense_repo.create(
                    household_id=household_id,
                    created_by=rule.created_by or user_id,
                    title=rule.title,
                    amount=rule.amount,
                    expense_date=occurrence_date,
                    category_id=rule.category_id,
                    description=rule.description,
                    payment_method=rule.payment_method,
                    notes=f"Auto-generated from recurring rule: {rule.title}",
                    is_recurring=True,
                )

                # Log the generation
                self.recurring_repo.create_log(
                    recurring_expense_id=rule.id,
                    expense_id=expense.id,
                    occurrence_date=occurrence_date,
                )

                generated_count += 1
                generated_ids.append(expense.id)

                # Advance due date
                rule.next_due_date = _advance_due_date(occurrence_date, rule.frequency)

        self.db.commit()

        return {
            "generated_count": generated_count,
            "skipped_count": skipped_count,
            "generated_expense_ids": generated_ids,
        }

    # --- Upcoming Expenses ---

    def get_upcoming(
        self,
        household_id: UUID,
        user_id: UUID,
        within_days: int = 30,
    ) -> list[dict]:
        """Return upcoming recurring expenses within N days."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)

        rules = self.recurring_repo.get_upcoming_rules(household_id, within_days)
        today = date.today()

        return [
            {
                "recurring_expense_id": r.id,
                "title": r.title,
                "amount": r.amount,
                "frequency": r.frequency,
                "next_due_date": r.next_due_date,
                "category_id": r.category_id,
                "payment_method": r.payment_method,
                "days_until_due": (r.next_due_date - today).days,
            }
            for r in rules
        ]

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

    def _require_edit_permission(
        self, membership, rule: RecurringExpense, user_id: UUID
    ) -> None:
        is_privileged = membership.role in (
            MemberRole.OWNER.value, MemberRole.ADMIN.value
        )
        is_creator = rule.created_by == user_id
        if not is_privileged and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify recurring rules you created",
            )

    def _get_rule_or_404(self, rule_id: UUID) -> RecurringExpense:
        rule = self.recurring_repo.get_by_id(rule_id)
        if not rule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recurring expense rule not found",
            )
        return rule

    def _verify_rule_belongs_to_household(
        self, rule: RecurringExpense, household_id: UUID
    ) -> None:
        if rule.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Recurring expense rule not found in this household",
            )

    def _validate_expense_category(
        self, category_id: UUID, household_id: UUID
    ) -> None:
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
