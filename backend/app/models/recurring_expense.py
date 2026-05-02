import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from sqlalchemy import (
    String, Boolean, DateTime, Date, ForeignKey, Numeric, Text,
    CheckConstraint, UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class RecurringExpense(Base):
    """Recurring expense rules — templates for scheduled household payments."""

    __tablename__ = "recurring_expenses"

    __table_args__ = (
        CheckConstraint("amount > 0", name="ck_recurring_expense_amount_positive"),
        CheckConstraint(
            "frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')",
            name="ck_recurring_expense_frequency_valid",
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
    frequency: Mapped[str] = mapped_column(
        String(20), nullable=False
    )
    next_due_date: Mapped[date] = mapped_column(
        Date, nullable=False, index=True
    )
    payment_method: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    notes: Mapped[str | None] = mapped_column(
        Text, nullable=True
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False
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
        return f"<RecurringExpense {self.title} ${self.amount} {self.frequency}>"


class GeneratedExpenseLog(Base):
    """Tracks which expenses were generated from which recurring rule,
    preventing duplicates for the same rule + occurrence date."""

    __tablename__ = "generated_expense_logs"

    __table_args__ = (
        UniqueConstraint(
            "recurring_expense_id", "occurrence_date",
            name="uq_generated_expense_rule_date",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True, default=uuid.uuid4
    )
    recurring_expense_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("recurring_expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    expense_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("expenses.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    occurrence_date: Mapped[date] = mapped_column(
        Date, nullable=False
    )
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<GeneratedExpenseLog rule={self.recurring_expense_id} date={self.occurrence_date}>"
