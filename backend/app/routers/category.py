from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.category import (
    CreateCategoryRequest,
    UpdateCategoryRequest,
    CategoryResponse,
    CategoryTypeEnum,
)
from app.services.category_service import CategoryService

router = APIRouter(
    prefix="/households/{household_id}/categories",
    tags=["Categories"],
)


def get_category_service(db: Session = Depends(get_db)) -> CategoryService:
    """Dependency that provides a CategoryService instance."""
    return CategoryService(db)


# --- Endpoints ---


@router.get("", response_model=list[CategoryResponse])
def list_categories(
    household_id: UUID,
    category_type: CategoryTypeEnum | None = Query(
        None, description="Filter by category type"
    ),
    user_id: UUID = Depends(get_current_user_id),
    service: CategoryService = Depends(get_category_service),
):
    """List all categories for a household. Any member can view."""
    type_value = category_type.value if category_type else None
    categories = service.list_categories(household_id, user_id, type_value)
    return [CategoryResponse.model_validate(c) for c in categories]


@router.get("/{category_id}", response_model=CategoryResponse)
def get_category(
    household_id: UUID,
    category_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: CategoryService = Depends(get_category_service),
):
    """Get a single category. Any member can view."""
    category = service.get_category(household_id, category_id, user_id)
    return CategoryResponse.model_validate(category)


@router.post("", response_model=CategoryResponse, status_code=status.HTTP_201_CREATED)
def create_category(
    household_id: UUID,
    body: CreateCategoryRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: CategoryService = Depends(get_category_service),
):
    """Create a new category. Requires owner or admin role."""
    category = service.create_category(
        household_id=household_id,
        user_id=user_id,
        name=body.name,
        category_type=body.category_type.value,
        color=body.color,
        icon=body.icon,
        is_default=body.is_default,
    )
    return CategoryResponse.model_validate(category)


@router.patch("/{category_id}", response_model=CategoryResponse)
def update_category(
    household_id: UUID,
    category_id: UUID,
    body: UpdateCategoryRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: CategoryService = Depends(get_category_service),
):
    """Update a category. Requires owner or admin role."""
    category = service.update_category(
        household_id=household_id,
        category_id=category_id,
        user_id=user_id,
        name=body.name,
        color=body.color,
        icon=body.icon,
        is_default=body.is_default,
    )
    return CategoryResponse.model_validate(category)


@router.delete("/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_category(
    household_id: UUID,
    category_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: CategoryService = Depends(get_category_service),
):
    """Delete a category. Requires owner or admin role."""
    service.delete_category(household_id, category_id, user_id)
    return None
