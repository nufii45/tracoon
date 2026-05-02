import uuid
import enum
from datetime import datetime, timezone
from sqlalchemy import String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class CategoryType(str, enum.Enum):
    """Allowed category types."""
    EXPENSE = "expense"
    BUDGET = "budget"
    INVENTORY = "inventory"
    PURCHASE = "purchase"


class Category(Base):
    """Categories table — household-scoped categories for expenses, budgets, etc."""

    __tablename__ = "categories"

    __table_args__ = (
        UniqueConstraint(
            "household_id", "category_type", "name",
            name="uq_household_type_name",
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
    name: Mapped[str] = mapped_column(
        String(255), nullable=False
    )
    category_type: Mapped[str] = mapped_column(
        String(20), nullable=False, index=True
    )
    color: Mapped[str | None] = mapped_column(
        String(30), nullable=True
    )
    icon: Mapped[str | None] = mapped_column(
        String(100), nullable=True
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
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
        return f"<Category {self.category_type}:{self.name}>"
