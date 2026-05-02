from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from enum import Enum


# --- Enums ---

class FrequencyEnum(str, Enum):
    """Supported recurrence frequencies."""
    DAILY = "daily"
    WEEKLY = "weekly"
    BIWEEKLY = "biweekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    YEARLY = "yearly"


class PaymentMethodEnum(str, Enum):
    """Common payment methods."""
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    E_WALLET = "e_wallet"
    OTHER = "other"


# --- Request Schemas ---

class CreateRecurringExpenseRequest(BaseModel):
    """Schema for creating a recurring expense rule."""
    title: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    frequency: FrequencyEnum
    next_due_date: date
    category_id: UUID | None = None
    description: str | None = None
    payment_method: PaymentMethodEnum | None = None
    notes: str | None = None


class UpdateRecurringExpenseRequest(BaseModel):
    """Schema for updating a recurring expense rule. All fields optional."""
    title: str | None = Field(None, min_length=1, max_length=255)
    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    frequency: FrequencyEnum | None = None
    next_due_date: date | None = None
    category_id: UUID | None = None
    description: str | None = None
    payment_method: PaymentMethodEnum | None = None
    notes: str | None = None
    is_active: bool | None = None


# --- Response Schemas ---

class RecurringExpenseResponse(BaseModel):
    """Public recurring expense data returned in API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    category_id: UUID | None
    created_by: UUID | None
    title: str
    description: str | None
    amount: Decimal
    frequency: str
    next_due_date: date
    payment_method: str | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class RecurringExpenseListResponse(BaseModel):
    """List of recurring expense rules."""
    rules: list[RecurringExpenseResponse]
    total_count: int


class GenerateResult(BaseModel):
    """Result of generating expenses from due recurring rules."""
    generated_count: int
    skipped_count: int
    generated_expense_ids: list[UUID]


class UpcomingExpense(BaseModel):
    """A preview of an upcoming recurring expense."""
    recurring_expense_id: UUID
    title: str
    amount: Decimal
    frequency: str
    next_due_date: date
    category_id: UUID | None
    payment_method: str | None
    days_until_due: int
