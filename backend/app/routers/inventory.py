from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.inventory import (
    CreateInventoryItemRequest,
    UpdateInventoryItemRequest,
    InventoryItemResponse,
    InventoryListResponse,
)
from app.services.inventory_service import InventoryService

router = APIRouter(
    prefix="/households/{household_id}/inventory",
    tags=["Inventory"],
)


def get_inventory_service(db: Session = Depends(get_db)) -> InventoryService:
    """Dependency that provides an InventoryService instance."""
    return InventoryService(db)


def _to_response(item) -> InventoryItemResponse:
    """Convert an InventoryItem model to a response with computed is_low_stock."""
    resp = InventoryItemResponse.model_validate(item)
    if item.low_stock_threshold is not None and item.quantity <= item.low_stock_threshold:
        resp.is_low_stock = True
    return resp


# --- Endpoints ---


@router.get("", response_model=InventoryListResponse)
def list_inventory_items(
    household_id: UUID,
    category_id: UUID | None = Query(None, description="Filter by inventory category"),
    low_stock_only: bool = Query(False, description="Show only low-stock items"),
    search: str | None = Query(None, description="Search by item name"),
    location: str | None = Query(None, description="Filter by location"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user_id: UUID = Depends(get_current_user_id),
    service: InventoryService = Depends(get_inventory_service),
):
    """List inventory items for a household with optional filters. Any member can view."""
    result = service.list_items(
        household_id=household_id,
        user_id=user_id,
        category_id=category_id,
        low_stock_only=low_stock_only,
        search=search,
        location=location,
        limit=limit,
        offset=offset,
    )
    return InventoryListResponse(
        items=[_to_response(i) for i in result["items"]],
        total_count=result["total_count"],
        low_stock_count=result["low_stock_count"],
    )


@router.get("/{item_id}", response_model=InventoryItemResponse)
def get_inventory_item(
    household_id: UUID,
    item_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: InventoryService = Depends(get_inventory_service),
):
    """Get a single inventory item. Any member can view."""
    item = service.get_item(household_id, item_id, user_id)
    return _to_response(item)


@router.post("", response_model=InventoryItemResponse, status_code=status.HTTP_201_CREATED)
def create_inventory_item(
    household_id: UUID,
    body: CreateInventoryItemRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: InventoryService = Depends(get_inventory_service),
):
    """Create a new inventory item. Members, admins, and owners can create."""
    item = service.create_item(
        household_id=household_id,
        user_id=user_id,
        name=body.name,
        quantity=body.quantity,
        description=body.description,
        unit=body.unit,
        low_stock_threshold=body.low_stock_threshold,
        location=body.location,
        expiry_date=body.expiry_date,
        notes=body.notes,
        category_id=body.category_id,
    )
    return _to_response(item)


@router.patch("/{item_id}", response_model=InventoryItemResponse)
def update_inventory_item(
    household_id: UUID,
    item_id: UUID,
    body: UpdateInventoryItemRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: InventoryService = Depends(get_inventory_service),
):
    """Update an inventory item. Creator or owner/admin can update."""
    updates = body.model_dump(exclude_unset=True)
    item = service.update_item(
        household_id=household_id,
        item_id=item_id,
        user_id=user_id,
        **updates,
    )
    return _to_response(item)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inventory_item(
    household_id: UUID,
    item_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: InventoryService = Depends(get_inventory_service),
):
    """Delete an inventory item. Creator or owner/admin can delete."""
    service.delete_item(household_id, item_id, user_id)
    return None
