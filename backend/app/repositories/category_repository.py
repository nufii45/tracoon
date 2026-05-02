from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.category import Category


class CategoryRepository:
    """Data access layer for the categories table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, category_id: UUID) -> Category | None:
        """Fetch a category by its UUID."""
        return self.db.get(Category, category_id)

    def get_by_household(
        self, household_id: UUID, category_type: str | None = None
    ) -> list[Category]:
        """Fetch all categories for a household, optionally filtered by type."""
        stmt = select(Category).where(
            Category.household_id == household_id
        )
        if category_type:
            stmt = stmt.where(Category.category_type == category_type)
        stmt = stmt.order_by(Category.category_type, Category.name)
        return list(self.db.execute(stmt).scalars().all())

    def get_duplicate(
        self, household_id: UUID, category_type: str, name: str
    ) -> Category | None:
        """Check if a category with the same type and name already exists."""
        stmt = select(Category).where(
            Category.household_id == household_id,
            Category.category_type == category_type,
            Category.name == name,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def create(
        self,
        household_id: UUID,
        name: str,
        category_type: str,
        created_by: UUID,
        color: str | None = None,
        icon: str | None = None,
        is_default: bool = False,
    ) -> Category:
        """Insert a new category and flush to get the generated ID."""
        category = Category(
            household_id=household_id,
            name=name,
            category_type=category_type,
            created_by=created_by,
            color=color,
            icon=icon,
            is_default=is_default,
        )
        self.db.add(category)
        self.db.flush()
        return category

    def update(self, category: Category, **kwargs) -> Category:
        """Update category fields. Only sets provided non-None values."""
        for key, value in kwargs.items():
            if value is not None and hasattr(category, key):
                setattr(category, key, value)
        self.db.flush()
        return category

    def delete(self, category: Category) -> None:
        """Delete a category."""
        self.db.delete(category)
        self.db.flush()
