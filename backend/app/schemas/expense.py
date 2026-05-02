from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from enum import Enum


# --- Enums ---

class PaymentMethodEnum(str, Enum):
    """Common payment methods."""
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    E_WALLET = "e_wallet"
    OTHER = "other"


# --- Request Schemas ---

class CreateExpenseRequest(BaseModel):
    """Schema for creating a new expense."""
    title: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    expense_date: date
    category_id: UUID | None = None
    description: str | None = None
    payment_method: PaymentMethodEnum | None = None
    notes: str | None = None
    is_recurring: bool = False


class UpdateExpenseRequest(BaseModel):
    """Schema for updating an expense. All fields optional."""
    title: str | None = Field(None, min_length=1, max_length=255)
    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    expense_date: date | None = None
    category_id: UUID | None = None
    description: str | None = None
    payment_method: PaymentMethodEnum | None = None
    notes: str | None = None
    is_recurring: bool | None = None


# --- Response Schemas ---

class ExpenseResponse(BaseModel):
    """Public expense data returned in API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    category_id: UUID | None
    created_by: UUID | None
    title: str
    description: str | None
    amount: Decimal
    currency: str
    expense_date: date
    payment_method: str | None
    notes: str | None
    is_recurring: bool
    created_at: datetime
    updated_at: datetime


class ExpenseListResponse(BaseModel):
    """Paginated list of expenses with summary."""
    expenses: list[ExpenseResponse]
    total_count: int
    total_amount: Decimal
