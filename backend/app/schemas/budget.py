from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


# --- Request Schemas ---

class CreateBudgetRequest(BaseModel):
    """Schema for creating a new budget."""
    name: str = Field(..., min_length=1, max_length=255)
    amount: Decimal = Field(..., gt=0, decimal_places=2)
    period_start: date
    period_end: date
    category_id: UUID | None = None
    description: str | None = None

    @model_validator(mode="after")
    def validate_period(self):
        if self.period_end < self.period_start:
            raise ValueError("period_end must be >= period_start")
        return self


class UpdateBudgetRequest(BaseModel):
    """Schema for updating a budget. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=255)
    amount: Decimal | None = Field(None, gt=0, decimal_places=2)
    period_start: date | None = None
    period_end: date | None = None
    category_id: UUID | None = None
    description: str | None = None


# --- Response Schemas ---

class BudgetResponse(BaseModel):
    """Public budget data returned in API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    category_id: UUID | None
    created_by: UUID | None
    name: str
    description: str | None
    amount: Decimal
    period_start: date
    period_end: date
    created_at: datetime
    updated_at: datetime


class BudgetProgressResponse(BaseModel):
    """Budget with spending progress calculated from expenses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    category_id: UUID | None
    created_by: UUID | None
    name: str
    description: str | None
    amount: Decimal
    period_start: date
    period_end: date
    created_at: datetime
    updated_at: datetime
    # Progress fields
    spent: Decimal
    remaining: Decimal
    percentage_used: float
    expense_count: int
