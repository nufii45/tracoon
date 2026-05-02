import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String, Boolean, DateTime, Date, ForeignKey, Numeric, Text,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class Expense(Base):
    """Expenses table — household expense tracking."""

    __tablename__ = "expenses"

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_expense_amount_positive"),
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
        index=True,
    )
    title: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    description: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(
        Numeric(12, 2), nullable=False
    )
    currency: Mapped[str] = mapped_column(
        String(3), nullable=False, default="PHP"
    )
    expense_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )
    payment_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    is_recurring: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
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
        return f"<Expense {self.title} {self.currency}{self.amount}>"