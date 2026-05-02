from uuid import UUID
from datetime import date
from decimal import Decimal
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from app.models.purchase import Purchase, PurchaseItem


class PurchaseRepository:
    """Data access layer for the purchases and purchase_items tables."""

    def __init__(self, db: Session):
        self.db = db

    # --- Purchase CRUD ---

    def get_by_id(self, purchase_id: UUID) -> Purchase | None:
        """Fetch a purchase by ID (items loaded via selectin)."""
        return self.db.get(Purchase, purchase_id)

    def get_by_household(
        self,
        household_id: UUID,
        store_name: str | None = None,
        payment_method: str | None = None,
        category_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Purchase]:
        """Fetch purchases for a household with optional filters."""
        stmt = (
            select(Purchase)
            .where(Purchase.household_id == household_id)
            .order_by(Purchase.purchase_date.desc(), Purchase.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        if store_name:
            stmt = stmt.where(Purchase.store_name.ilike(f"%{store_name}%"))
        if payment_method:
            stmt = stmt.where(Purchase.payment_method == payment_method)
        if date_from:
            stmt = stmt.where(Purchase.purchase_date >= date_from)
        if date_to:
            stmt = stmt.where(Purchase.purchase_date <= date_to)
        if category_id:
            # Filter purchases that have at least one item with this category
            stmt = stmt.where(
                Purchase.id.in_(
                    select(PurchaseItem.purchase_id)
                    .where(PurchaseItem.category_id == category_id)
                )
            )

        return list(self.db.scalars(stmt).unique().all())

    def count_total(
        self,
        household_id: UUID,
        store_name: str | None = None,
        payment_method: str | None = None,
        category_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> int:
        """Count total purchases matching filters."""
        stmt = (
            select(func.count())
            .select_from(Purchase)
            .where(Purchase.household_id == household_id)
        )

        if store_name:
            stmt = stmt.where(Purchase.store_name.ilike(f"%{store_name}%"))
        if payment_method:
            stmt = stmt.where(Purchase.payment_method == payment_method)
        if date_from:
            stmt = stmt.where(Purchase.purchase_date >= date_from)
        if date_to:
            stmt = stmt.where(Purchase.purchase_date <= date_to)
        if category_id:
            stmt = stmt.where(
                Purchase.id.in_(
                    select(PurchaseItem.purchase_id)
                    .where(PurchaseItem.category_id == category_id)
                )
            )

        return self.db.scalar(stmt) or 0

    def sum_total(
        self,
        household_id: UUID,
        store_name: str | None = None,
        payment_method: str | None = None,
        category_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
    ) -> Decimal:
        """Sum total_amount for purchases matching filters."""
        stmt = (
            select(func.coalesce(func.sum(Purchase.total_amount), 0))
            .where(Purchase.household_id == household_id)
        )

        if store_name:
            stmt = stmt.where(Purchase.store_name.ilike(f"%{store_name}%"))
        if payment_method:
            stmt = stmt.where(Purchase.payment_method == payment_method)
        if date_from:
            stmt = stmt.where(Purchase.purchase_date >= date_from)
        if date_to:
            stmt = stmt.where(Purchase.purchase_date <= date_to)
        if category_id:
            stmt = stmt.where(
                Purchase.id.in_(
                    select(PurchaseItem.purchase_id)
                    .where(PurchaseItem.category_id == category_id)
                )
            )

        return self.db.scalar(stmt) or Decimal("0")

    def create(self, **kwargs) -> Purchase:
        """Create a new purchase."""
        purchase = Purchase(**kwargs)
        self.db.add(purchase)
        self.db.flush()
        return purchase

    def update(self, purchase: Purchase, **kwargs) -> Purchase:
        """Update purchase fields."""
        for key, value in kwargs.items():
            if hasattr(purchase, key):
                setattr(purchase, key, value)
        self.db.flush()
        return purchase

    def delete(self, purchase: Purchase) -> None:
        """Delete a purchase (cascade deletes items)."""
        self.db.delete(purchase)
        self.db.flush()

    # --- Purchase Item CRUD ---

    def get_item_by_id(self, item_id: UUID) -> PurchaseItem | None:
        """Fetch a purchase item by ID."""
        return self.db.get(PurchaseItem, item_id)

    def create_item(self, **kwargs) -> PurchaseItem:
        """Create a purchase item."""
        item = PurchaseItem(**kwargs)
        self.db.add(item)
        self.db.flush()
        return item

    def update_item(self, item: PurchaseItem, **kwargs) -> PurchaseItem:
        """Update a purchase item."""
        for key, value in kwargs.items():
            if hasattr(item, key):
                setattr(item, key, value)
        self.db.flush()
        return item

    def delete_item(self, item: PurchaseItem) -> None:
        """Delete a purchase item."""
        self.db.delete(item)
        self.db.flush()
