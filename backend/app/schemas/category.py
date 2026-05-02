from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from uuid import UUID
from enum import Enum


# --- Enums ---

class CategoryTypeEnum(str, Enum):
    """Allowed category types."""
    EXPENSE = "expense"
    BUDGET = "budget"
    INVENTORY = "inventory"
    PURCHASE = "purchase"


# --- Request Schemas ---

class CreateCategoryRequest(BaseModel):
    """Schema for creating a new category."""
    name: str = Field(..., min_length=1, max_length=255)
    category_type: CategoryTypeEnum
    color: str | None = Field(None, max_length=30)
    icon: str | None = Field(None, max_length=100)
    is_default: bool = False


class UpdateCategoryRequest(BaseModel):
    """Schema for updating a category. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=255)
    color: str | None = None
    icon: str | None = None
    is_default: bool | None = None


# --- Response Schemas ---

class CategoryResponse(BaseModel):
    """Public category data returned in API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    name: str
    category_type: str
    color: str | None
    icon: str | None
    is_default: bool
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
