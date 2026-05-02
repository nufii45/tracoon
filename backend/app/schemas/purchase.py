from pydantic import BaseModel, ConfigDict, Field
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from enum import Enum


# --- Enums ---

class PaymentMethodEnum(str, Enum):
    """Common payment methods for purchases."""
    CASH = "cash"
    CARD = "card"
    BANK_TRANSFER = "bank_transfer"
    E_WALLET = "e_wallet"
    OTHER = "other"


# --- Purchase Item Schemas ---

class CreatePurchaseItemRequest(BaseModel):
    """Schema for a single item within a purchase."""
    name: str = Field(..., min_length=1, max_length=255)
    quantity: Decimal = Field(default=Decimal("1"), gt=0)
    unit: str | None = Field(None, max_length=30)
    unit_price: Decimal | None = Field(None, ge=0)
    total_price: Decimal = Field(..., ge=0)
    category_id: UUID | None = None
    inventory_item_id: UUID | None = None
    notes: str | None = None


class UpdatePurchaseItemRequest(BaseModel):
    """Schema for updating a purchase item. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=255)
    quantity: Decimal | None = Field(None, gt=0)
    unit: str | None = Field(None, max_length=30)
    unit_price: Decimal | None = Field(None, ge=0)
    total_price: Decimal | None = Field(None, ge=0)
    category_id: UUID | None = None
    inventory_item_id: UUID | None = None
    notes: str | None = None


class PurchaseItemResponse(BaseModel):
    """Response schema for a purchase item."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    purchase_id: UUID
    household_id: UUID
    category_id: UUID | None
    inventory_item_id: UUID | None
    name: str
    quantity: Decimal
    unit: str | None
    unit_price: Decimal | None
    total_price: Decimal
    notes: str | None
    created_at: datetime
    updated_at: datetime


# --- Purchase Schemas ---

class CreatePurchaseRequest(BaseModel):
    """Schema for creating a new purchase."""
    store_name: str | None = Field(None, max_length=255)
    purchase_date: date
    total_amount: Decimal = Field(..., ge=0)
    payment_method: PaymentMethodEnum | None = None
    receipt_url: str | None = Field(None, max_length=500)
    receipt_reference: str | None = Field(None, max_length=255)
    notes: str | None = None
    items: list[CreatePurchaseItemRequest] = Field(default_factory=list)


class UpdatePurchaseRequest(BaseModel):
    """Schema for updating a purchase. All fields optional."""
    store_name: str | None = Field(None, max_length=255)
    purchase_date: date | None = None
    total_amount: Decimal | None = Field(None, ge=0)
    payment_method: PaymentMethodEnum | None = None
    receipt_url: str | None = Field(None, max_length=500)
    receipt_reference: str | None = Field(None, max_length=255)
    notes: str | None = None


class PurchaseResponse(BaseModel):
    """Response schema for a purchase with its items."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    created_by: UUID | None
    store_name: str | None
    purchase_date: date
    total_amount: Decimal
    payment_method: str | None
    receipt_url: str | None
    receipt_reference: str | None
    notes: str | None
    items: list[PurchaseItemResponse] = []
    item_count: int = 0
    created_at: datetime
    updated_at: datetime


class PurchaseListResponse(BaseModel):
    """Response for paginated purchase list with summary."""
    purchases: list[PurchaseResponse]
    total_count: int
    total_amount: Decimal
