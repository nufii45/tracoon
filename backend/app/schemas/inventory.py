from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID


# --- Request Schemas ---

class CreateInventoryItemRequest(BaseModel):
    """Schema for creating an inventory item."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    quantity: Decimal = Field(default=Decimal("0"), ge=0)
    unit: str | None = Field(None, max_length=30)
    low_stock_threshold: Decimal | None = Field(None, ge=0)
    location: str | None = Field(None, max_length=100)
    expiry_date: date | None = None
    notes: str | None = None
    category_id: UUID | None = None


class UpdateInventoryItemRequest(BaseModel):
    """Schema for updating an inventory item. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None
    quantity: Decimal | None = Field(None, ge=0)
    unit: str | None = Field(None, max_length=30)
    low_stock_threshold: Decimal | None = Field(None, ge=0)
    location: str | None = Field(None, max_length=100)
    expiry_date: date | None = None
    notes: str | None = None
    category_id: UUID | None = None


# --- Response Schemas ---

class InventoryItemResponse(BaseModel):
    """Response schema for a single inventory item."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    category_id: UUID | None
    created_by: UUID | None
    name: str
    description: str | None
    quantity: Decimal
    unit: str | None
    low_stock_threshold: Decimal | None
    location: str | None
    expiry_date: date | None
    notes: str | None
    is_low_stock: bool = False
    created_at: datetime
    updated_at: datetime


class InventoryListResponse(BaseModel):
    """Response schema for paginated inventory list with summary."""
    items: list[InventoryItemResponse]
    total_count: int
    low_stock_count: int
