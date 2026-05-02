import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String, DateTime, Date, ForeignKey, Numeric, Text,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class InventoryItem(Base):
    """Inventory items table — household stock tracking."""

    __tablename__ = "inventory_items"

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_inventory_quantity_non_negative"),
        CheckConstraint(
            "low_stock_threshold IS NULL OR low_stock_threshold >= 0",
            name="ck_inventory_threshold_non_negative",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    category_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=0
    )
    unit: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    low_stock_threshold: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    location: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    expiry_date: Mapped[date | None] = mapped_column(
        Date, nullable=True
    )
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<InventoryItem {self.name} qty={self.quantity}>"
