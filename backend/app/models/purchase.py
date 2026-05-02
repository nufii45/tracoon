import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String, DateTime, Date, ForeignKey, Numeric, Text,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.core.database import Base


class Purchase(Base):
    """Purchases table — household shopping/receipt tracking."""

    __tablename__ = "purchases"

    __table_args__ = (
        CheckConstraint("total_amount >= 0", name="ck_purchase_total_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    household_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("households.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    store_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    purchase_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    payment_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    receipt_url: Mapped[str | None] = mapped_column(
        String(500), nullable=True
    )
    receipt_reference: Mapped[str | None] = mapped_column(
        String(255), nullable=True
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

    # Relationship to purchase items
    items: Mapped[list["PurchaseItem"]] = relationship(
        "PurchaseItem",
        back_populates="purchase",
        cascade="all, delete-orphan",
        lazy="selectin",
    )

    def __repr__(self) -> str:
        return f"<Purchase {self.store_name or 'Unknown'} ${self.total_amount}>"


class PurchaseItem(Base):
    """Purchase items table — individual items within a purchase."""

    __tablename__ = "purchase_items"

    __table_args__ = (
        CheckConstraint("quantity > 0", name="ck_purchase_item_quantity_positive"),
        CheckConstraint(
            "unit_price IS NULL OR unit_price >= 0",
            name="ck_purchase_item_unit_price_non_negative",
        ),
        CheckConstraint("total_price >= 0", name="ck_purchase_item_total_non_negative"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    purchase_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("purchases.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
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
    inventory_item_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("inventory_items.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    quantity: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False, default=1
    )
    unit: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    unit_price: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    total_price: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
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

    # Relationship back to purchase
    purchase: Mapped["Purchase"] = relationship(
        "Purchase", back_populates="items"
    )

    def __repr__(self) -> str:
        return f"<PurchaseItem {self.name} qty={self.quantity} ${self.total_price}>"
