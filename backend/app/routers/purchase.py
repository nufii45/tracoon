from uuid import UUID
from datetime import date

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.purchase import (
    CreatePurchaseRequest,
    UpdatePurchaseRequest,
    CreatePurchaseItemRequest,
    UpdatePurchaseItemRequest,
    PurchaseResponse,
    PurchaseItemResponse,
    PurchaseListResponse,
)
from app.services.purchase_service import PurchaseService

router = APIRouter(
    prefix="/households/{household_id}/purchases",
    tags=["Purchases"],
)


def get_purchase_service(db: Session = Depends(get_db)) -> PurchaseService:
    """Dependency that provides a PurchaseService instance."""
    return PurchaseService(db)


def _to_purchase_response(purchase) -> PurchaseResponse:
    """Convert a Purchase model to a response with computed item_count."""
    resp = PurchaseResponse.model_validate(purchase)
    resp.item_count = len(purchase.items) if purchase.items else 0
    return resp


# --- Purchase Endpoints ---


@router.get("", response_model=PurchaseListResponse)
def list_purchases(
    household_id: UUID,
    store_name: str | None = Query(None, description="Filter by store name (partial match)"),
    payment_method: str | None = Query(None, description="Filter by payment method"),
    category_id: UUID | None = Query(None, description="Filter by item category"),
    date_from: date | None = Query(None, description="Filter from date"),
    date_to: date | None = Query(None, description="Filter to date"),
    limit: int = Query(50, ge=1, le=100, description="Max results"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """List purchases for a household with optional filters. Any member can view."""
    result = service.list_purchases(
        household_id=household_id,
        user_id=user_id,
        store_name=store_name,
        payment_method=payment_method,
        category_id=category_id,
        date_from=date_from,
        date_to=date_to,
        limit=limit,
        offset=offset,
    )
    return PurchaseListResponse(
        purchases=[_to_purchase_response(p) for p in result["purchases"]],
        total_count=result["total_count"],
        total_amount=result["total_amount"],
    )


@router.get("/{purchase_id}", response_model=PurchaseResponse)
def get_purchase(
    household_id: UUID,
    purchase_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Get a single purchase with its items. Any member can view."""
    purchase = service.get_purchase(household_id, purchase_id, user_id)
    return _to_purchase_response(purchase)


@router.post("", response_model=PurchaseResponse, status_code=status.HTTP_201_CREATED)
def create_purchase(
    household_id: UUID,
    body: CreatePurchaseRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Create a new purchase with optional inline items. Members, admins, and owners can create."""
    items_dicts = [item.model_dump() for item in body.items] if body.items else None
    purchase = service.create_purchase(
        household_id=household_id,
        user_id=user_id,
        purchase_date=body.purchase_date,
        total_amount=body.total_amount,
        store_name=body.store_name,
        payment_method=body.payment_method.value if body.payment_method else None,
        receipt_url=body.receipt_url,
        receipt_reference=body.receipt_reference,
        notes=body.notes,
        items=items_dicts,
    )
    return _to_purchase_response(purchase)


@router.patch("/{purchase_id}", response_model=PurchaseResponse)
def update_purchase(
    household_id: UUID,
    purchase_id: UUID,
    body: UpdatePurchaseRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Update a purchase. Creator or owner/admin can update."""
    updates = body.model_dump(exclude_unset=True)
    # Convert enum to string value
    if "payment_method" in updates and updates["payment_method"] is not None:
        updates["payment_method"] = updates["payment_method"].value
    purchase = service.update_purchase(
        household_id=household_id,
        purchase_id=purchase_id,
        user_id=user_id,
        **updates,
    )
    return _to_purchase_response(purchase)


@router.delete("/{purchase_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_purchase(
    household_id: UUID,
    purchase_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Delete a purchase (cascade deletes items). Creator or owner/admin can delete."""
    service.delete_purchase(household_id, purchase_id, user_id)
    return None


# --- Purchase Item Endpoints ---


@router.post(
    "/{purchase_id}/items",
    response_model=PurchaseItemResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_purchase_item(
    household_id: UUID,
    purchase_id: UUID,
    body: CreatePurchaseItemRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Add an item to a purchase."""
    item = service.add_item(
        household_id=household_id,
        purchase_id=purchase_id,
        user_id=user_id,
        name=body.name,
        total_price=body.total_price,
        quantity=body.quantity,
        unit=body.unit,
        unit_price=body.unit_price,
        category_id=body.category_id,
        inventory_item_id=body.inventory_item_id,
        notes=body.notes,
    )
    return PurchaseItemResponse.model_validate(item)


@router.patch(
    "/{purchase_id}/items/{item_id}",
    response_model=PurchaseItemResponse,
)
def update_purchase_item(
    household_id: UUID,
    purchase_id: UUID,
    item_id: UUID,
    body: UpdatePurchaseItemRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Update a purchase item."""
    updates = body.model_dump(exclude_unset=True)
    item = service.update_item(
        household_id=household_id,
        purchase_id=purchase_id,
        item_id=item_id,
        user_id=user_id,
        **updates,
    )
    return PurchaseItemResponse.model_validate(item)


@router.delete(
    "/{purchase_id}/items/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_purchase_item(
    household_id: UUID,
    purchase_id: UUID,
    item_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: PurchaseService = Depends(get_purchase_service),
):
    """Delete a purchase item."""
    service.delete_item(household_id, purchase_id, item_id, user_id)
    return None
