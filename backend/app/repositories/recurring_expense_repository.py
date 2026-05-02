from uuid import UUID
from datetime import date
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.recurring_expense import RecurringExpense, GeneratedExpenseLog


class RecurringExpenseRepository:
    """Data access layer for recurring_expenses and generated_expense_logs tables."""

    def __init__(self, db: Session):
        self.db = db

    # --- Recurring Expense CRUD ---

    def get_by_id(self, rule_id: UUID) -> RecurringExpense | None:
        """Fetch a recurring expense rule by ID."""
        return self.db.get(RecurringExpense, rule_id)

    def get_by_household(
        self,
        household_id: UUID,
        is_active: bool | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[RecurringExpense]:
        """Fetch recurring expense rules for a household."""
        stmt = (
            select(RecurringExpense)
            .where(RecurringExpense.household_id == household_id)
            .order_by(RecurringExpense.next_due_date.asc())
            .limit(limit)
            .offset(offset)
        )
        if is_active is not None:
            stmt = stmt.where(RecurringExpense.is_active == is_active)
        return list(self.db.scalars(stmt).all())

    def count_total(
        self,
        household_id: UUID,
        is_active: bool | None = None,
    ) -> int:
        """Count recurring expense rules for a household."""
        stmt = (
            select(func.count())
            .select_from(RecurringExpense)
            .where(RecurringExpense.household_id == household_id)
        )
        if is_active is not None:
            stmt = stmt.where(RecurringExpense.is_active == is_active)
        return self.db.scalar(stmt) or 0

    def get_due_rules(
        self, household_id: UUID, as_of: date
    ) -> list[RecurringExpense]:
        """Fetch active rules with next_due_date <= as_of."""
        stmt = (
            select(RecurringExpense)
            .where(
                RecurringExpense.household_id == household_id,
                RecurringExpense.is_active == True,
                RecurringExpense.next_due_date <= as_of,
            )
            .order_by(RecurringExpense.next_due_date.asc())
        )
        return list(self.db.scalars(stmt).all())

    def get_upcoming_rules(
        self, household_id: UUID, within_days: int = 30
    ) -> list[RecurringExpense]:
        """Fetch active rules due within the next N days."""
        from datetime import timedelta
        cutoff = date.today() + timedelta(days=within_days)
        stmt = (
            select(RecurringExpense)
            .where(
                RecurringExpense.household_id == household_id,
                RecurringExpense.is_active == True,
                RecurringExpense.next_due_date <= cutoff,
            )
            .order_by(RecurringExpense.next_due_date.asc())
        )
        return list(self.db.scalars(stmt).all())

    def create(self, **kwargs) -> RecurringExpense:
        """Create a new recurring expense rule."""
        rule = RecurringExpense(**kwargs)
        self.db.add(rule)
        self.db.flush()
        return rule

    def update(self, rule: RecurringExpense, **kwargs) -> RecurringExpense:
        """Update a recurring expense rule."""
        for key, value in kwargs.items():
            if hasattr(rule, key):
                setattr(rule, key, value)
        self.db.flush()
        return rule

    def delete(self, rule: RecurringExpense) -> None:
        """Delete a recurring expense rule (cascade deletes logs)."""
        self.db.delete(rule)
        self.db.flush()

    # --- Generated Expense Log ---

    def has_been_generated(
        self, recurring_expense_id: UUID, occurrence_date: date
    ) -> bool:
        """Check if an expense was already generated for this rule + date."""
        stmt = (
            select(func.count())
            .select_from(GeneratedExpenseLog)
            .where(
                GeneratedExpenseLog.recurring_expense_id == recurring_expense_id,
                GeneratedExpenseLog.occurrence_date == occurrence_date,
            )
        )
        return (self.db.scalar(stmt) or 0) > 0

    def create_log(self, **kwargs) -> GeneratedExpenseLog:
        """Create a generated expense log entry."""
        log = GeneratedExpenseLog(**kwargs)
        self.db.add(log)
        self.db.flush()
        return log
