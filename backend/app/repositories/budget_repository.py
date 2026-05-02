from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.budget import Budget


class BudgetRepository:
    """Data access layer for the budgets table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, budget_id: UUID) -> Budget | None:
        """Fetch a budget by its UUID."""
        return self.db.get(Budget, budget_id)

    def get_by_household(self, household_id: UUID) -> list[Budget]:
        """Fetch all budgets for a household, ordered by period start desc."""
        stmt = (
            select(Budget)
            .where(Budget.household_id == household_id)
            .order_by(Budget.period_start.desc(), Budget.name)
        )
        return list(self.db.execute(stmt).scalars().all())

    def create(
        self,
        household_id: UUID,
        created_by: UUID,
        name: str,
        amount,
        period_start,
        period_end,
        category_id: UUID | None = None,
        description: str | None = None,
    ) -> Budget:
        """Insert a new budget and flush to get the generated ID."""
        budget = Budget(
            household_id=household_id,
            created_by=created_by,
            name=name,
            amount=amount,
            period_start=period_start,
            period_end=period_end,
            category_id=category_id,
            description=description,
        )
        self.db.add(budget)
        self.db.flush()
        return budget

    def update(self, budget: Budget, **kwargs) -> Budget:
        """Update budget fields. Only sets provided non-None values."""
        for key, value in kwargs.items():
            if value is not None and hasattr(budget, key):
                setattr(budget, key, value)
        self.db.flush()
        return budget

    def delete(self, budget: Budget) -> None:
        """Delete a budget."""
        self.db.delete(budget)
        self.db.flush()
