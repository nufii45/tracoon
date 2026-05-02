from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.expense import Expense


class ExpenseRepository:
    """Data access layer for the expenses table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, expense_id: UUID) -> Expense | None:
        """Fetch an expense by its UUID."""
        return self.db.get(Expense, expense_id)

    def get_by_household(
        self,
        household_id: UUID,
        category_id: UUID | None = None,
        created_by: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Expense]:
        """Fetch expenses for a household with optional filters."""
        stmt = select(Expense).where(Expense.household_id == household_id)
        stmt = self._apply_filters(stmt, category_id, created_by, date_from, date_to)
        stmt = stmt.order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        stmt = stmt.limit(limit).offset(offset)
        return list(self.db.execute(stmt).scalars().all())

    def count_and_sum(
        self,
        household_id: UUID,
        category_id: UUID | None = None,
        created_by: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        uncategorized_only: bool = False,
    ) -> tuple[int, Decimal]:
        """Return (count, total_amount) for filtered expenses.

        If uncategorized_only is True, only expenses with category_id IS NULL
        are included — used by general budgets to avoid double-counting.
        """
        count_stmt = select(func.count(Expense.id)).where(
            Expense.household_id == household_id
        )
        sum_stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.household_id == household_id
        )

        if uncategorized_only:
            count_stmt = count_stmt.where(Expense.category_id.is_(None))
            sum_stmt = sum_stmt.where(Expense.category_id.is_(None))

        count_stmt = self._apply_filters(count_stmt, category_id, created_by, date_from, date_to)
        sum_stmt = self._apply_filters(sum_stmt, category_id, created_by, date_from, date_to)

        total_count = self.db.execute(count_stmt).scalar() or 0
        total_amount = self.db.execute(sum_stmt).scalar() or Decimal("0")
        return total_count, total_amount

    def count_and_sum_excluding_categories(
        self,
        household_id: UUID,
        exclude_category_ids: list[UUID],
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> tuple[int, Decimal]:
        """Return (count, total_amount) for expenses NOT in the given categories.

        Used by general (uncategorized) budgets to avoid double-counting
        expenses that belong to category-specific budgets.
        """
        count_stmt = select(func.count(Expense.id)).where(
            Expense.household_id == household_id
        )
        sum_stmt = select(func.coalesce(func.sum(Expense.amount), 0)).where(
            Expense.household_id == household_id
        )

        # Exclude expenses that belong to another budget's category
        if exclude_category_ids:
            count_stmt = count_stmt.where(
                (Expense.category_id == None) | (~Expense.category_id.in_(exclude_category_ids))
            )
            sum_stmt = sum_stmt.where(
                (Expense.category_id == None) | (~Expense.category_id.in_(exclude_category_ids))
            )

        if date_from is not None:
            count_stmt = count_stmt.where(Expense.expense_date >= date_from)
            sum_stmt = sum_stmt.where(Expense.expense_date >= date_from)
        if date_to is not None:
            count_stmt = count_stmt.where(Expense.expense_date <= date_to)
            sum_stmt = sum_stmt.where(Expense.expense_date <= date_to)

        total_count = self.db.execute(count_stmt).scalar() or 0
        total_amount = self.db.execute(sum_stmt).scalar() or Decimal("0")
        return total_count, total_amount

    def create(
        self,
        household_id: UUID,
        created_by: UUID,
        title: str,
        amount: Decimal,
        expense_date: date,
        category_id: UUID | None = None,
        description: str | None = None,
        payment_method: str | None = None,
        notes: str | None = None,
        is_recurring: bool = False,
    ) -> Expense:
        """Insert a new expense and flush to get the generated ID."""
        expense = Expense(
            household_id=household_id,
            created_by=created_by,
            title=title,
            amount=amount,
            expense_date=expense_date,
            category_id=category_id,
            description=description,
            payment_method=payment_method,
            notes=notes,
            is_recurring=is_recurring,
        )
        self.db.add(expense)
        self.db.flush()
        return expense

    def update(self, expense: Expense, **kwargs) -> Expense:
        """Update expense fields. Only sets provided non-None values.

        Special handling: category_id can be explicitly set to None
        via a sentinel value to clear the category.
        """
        for key, value in kwargs.items():
            if value is not None and hasattr(expense, key):
                setattr(expense, key, value)
        self.db.flush()
        return expense

    def update_with_nulls(self, expense: Expense, updates: dict) -> Expense:
        """Update expense fields, allowing explicit None values for nullable fields."""
        nullable_fields = {"category_id", "description", "payment_method", "notes"}
        for key, value in updates.items():
            if not hasattr(expense, key):
                continue
            if value is None and key not in nullable_fields:
                continue
            if value is not None or key in nullable_fields:
                setattr(expense, key, value)
        self.db.flush()
        return expense

    def delete(self, expense: Expense) -> None:
        """Delete an expense."""
        self.db.delete(expense)
        self.db.flush()

    # --- Private ---

    def _apply_filters(self, stmt, category_id, created_by, date_from, date_to):
        """Apply optional filters to a query statement."""
        if category_id is not None:
            stmt = stmt.where(Expense.category_id == category_id)
        if created_by is not None:
            stmt = stmt.where(Expense.created_by == created_by)
        if date_from is not None:
            stmt = stmt.where(Expense.expense_date >= date_from)
        if date_to is not None:
            stmt = stmt.where(Expense.expense_date <= date_to)
        return stmt
