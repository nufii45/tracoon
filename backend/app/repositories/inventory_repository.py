from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func, and_
from app.models.inventory_item import InventoryItem


class InventoryRepository:
    """Data access layer for the inventory_items table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, item_id: UUID) -> InventoryItem | None:
        """Fetch a single inventory item by ID."""
        return self.db.get(InventoryItem, item_id)

    def get_by_household(
        self,
        household_id: UUID,
        category_id: UUID | None = None,
        low_stock_only: bool = False,
        search: str | None = None,
        location: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[InventoryItem]:
        """Fetch inventory items for a household with optional filters."""
        stmt = (
            select(InventoryItem)
            .where(InventoryItem.household_id == household_id)
            .order_by(InventoryItem.name.asc())
            .limit(limit)
            .offset(offset)
        )

        if category_id:
            stmt = stmt.where(InventoryItem.category_id == category_id)

        if low_stock_only:
            stmt = stmt.where(
                and_(
                    InventoryItem.low_stock_threshold.isnot(None),
                    InventoryItem.quantity <= InventoryItem.low_stock_threshold,
                )
            )

        if search:
            stmt = stmt.where(InventoryItem.name.ilike(f"%{search}%"))

        if location:
            stmt = stmt.where(InventoryItem.location == location)

        return list(self.db.scalars(stmt).all())

    def count_total(
        self,
        household_id: UUID,
        category_id: UUID | None = None,
        search: str | None = None,
        location: str | None = None,
    ) -> int:
        """Count total inventory items matching filters."""
        stmt = (
            select(func.count())
            .select_from(InventoryItem)
            .where(InventoryItem.household_id == household_id)
        )

        if category_id:
            stmt = stmt.where(InventoryItem.category_id == category_id)

        if search:
            stmt = stmt.where(InventoryItem.name.ilike(f"%{search}%"))

        if location:
            stmt = stmt.where(InventoryItem.location == location)

        return self.db.scalar(stmt) or 0

    def count_low_stock(self, household_id: UUID) -> int:
        """Count items that are at or below their low stock threshold."""
        stmt = (
            select(func.count())
            .select_from(InventoryItem)
            .where(
                InventoryItem.household_id == household_id,
                InventoryItem.low_stock_threshold.isnot(None),
                InventoryItem.quantity <= InventoryItem.low_stock_threshold,
            )
        )
        return self.db.scalar(stmt) or 0

    def create(self, **kwargs) -> InventoryItem:
        """Create a new inventory item."""
        item = InventoryItem(**kwargs)
        self.db.add(item)
        return item

    def update(self, item: InventoryItem, **kwargs) -> InventoryItem:
        """Update an inventory item with given fields."""
        for key, value in kwargs.items():
            if hasattr(item, key):
                setattr(item, key, value)
        return item

    def delete(self, item: InventoryItem) -> None:
        """Delete an inventory item."""
        self.db.delete(item)
