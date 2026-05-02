from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.household import Household


class HouseholdRepository:
    """Data access layer for the households table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, household_id: UUID) -> Household | None:
        """Fetch a household by its UUID."""
        return self.db.get(Household, household_id)

    def create(
        self, name: str, created_by: UUID, description: str | None = None
    ) -> Household:
        """Insert a new household and flush to get the generated ID."""
        household = Household(
            name=name,
            description=description,
            created_by=created_by,
        )
        self.db.add(household)
        self.db.flush()
        return household

    def update(self, household: Household, **kwargs) -> Household:
        """Update household fields. Only sets provided non-None values."""
        for key, value in kwargs.items():
            if value is not None and hasattr(household, key):
                setattr(household, key, value)
        self.db.flush()
        return household

    def delete(self, household: Household) -> None:
        """Delete a household (cascades to household_members)."""
        self.db.delete(household)
        self.db.flush()
