from uuid import UUID
from decimal import Decimal
from datetime import date

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.inventory_item import InventoryItem
from app.models.household_member import MemberRole
from app.models.category import CategoryType
from app.repositories.inventory_repository import InventoryRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository
from app.repositories.category_repository import CategoryRepository


class InventoryService:
    """Business logic for household inventory management."""

    def __init__(self, db: Session):
        self.db = db
        self.inventory_repo = InventoryRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)
        self.category_repo = CategoryRepository(db)

    # --- List Inventory Items ---

    def list_items(
        self,
        household_id: UUID,
        user_id: UUID,
        category_id: UUID | None = None,
        low_stock_only: bool = False,
        search: str | None = None,
        location: str | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Return filtered inventory items for a household with summary.

        Any member can list inventory items.
        """
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)

        items = self.inventory_repo.get_by_household(
            household_id=household_id,
            category_id=category_id,
            low_stock_only=low_stock_only,
            search=search,
            location=location,
            limit=limit,
            offset=offset,
        )
        total_count = self.inventory_repo.count_total(
            household_id=household_id,
            category_id=category_id,
            search=search,
            location=location,
        )
        low_stock_count = self.inventory_repo.count_low_stock(household_id)

        return {
            "items": items,
            "total_count": total_count,
            "low_stock_count": low_stock_count,
        }

    # --- Get Single Inventory Item ---

    def get_item(
        self, household_id: UUID, item_id: UUID, user_id: UUID
    ) -> InventoryItem:
        """Fetch a single inventory item. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        item = self._get_item_or_404(item_id)
        self._verify_item_belongs_to_household(item, household_id)
        return item

    # --- Create Inventory Item ---

    def create_item(
        self,
        household_id: UUID,
        user_id: UUID,
        name: str,
        quantity: Decimal = Decimal("0"),
        description: str | None = None,
        unit: str | None = None,
        low_stock_threshold: Decimal | None = None,
        location: str | None = None,
        expiry_date: date | None = None,
        notes: str | None = None,
        category_id: UUID | None = None,
    ) -> InventoryItem:
        """Create a new inventory item. Members, admins, and owners can create."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(
            membership,
            [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
        )

        # Validate category if provided
        if category_id:
            self._validate_inventory_category(category_id, household_id)

        item = self.inventory_repo.create(
            household_id=household_id,
            created_by=user_id,
            name=name,
            quantity=quantity,
            description=description,
            unit=unit,
            low_stock_threshold=low_stock_threshold,
            location=location,
            expiry_date=expiry_date,
            notes=notes,
            category_id=category_id,
        )
        self.db.commit()
        self.db.refresh(item)
        return item

    # --- Update Inventory Item ---

    def update_item(
        self,
        household_id: UUID,
        item_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> InventoryItem:
        """Update an inventory item.

        - Members can update their own items.
        - Owners/admins can update any item.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        item = self._get_item_or_404(item_id)
        self._verify_item_belongs_to_household(item, household_id)
        self._require_edit_permission(membership, item, user_id)

        # Validate category if being updated
        if "category_id" in kwargs and kwargs["category_id"] is not None:
            self._validate_inventory_category(kwargs["category_id"], household_id)

        updated = self.inventory_repo.update(item, **kwargs)
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Delete Inventory Item ---

    def delete_item(
        self, household_id: UUID, item_id: UUID, user_id: UUID
    ) -> None:
        """Delete an inventory item.

        - Members can delete their own items.
        - Owners/admins can delete any item.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        item = self._get_item_or_404(item_id)
        self._verify_item_belongs_to_household(item, household_id)
        self._require_edit_permission(membership, item, user_id)

        self.inventory_repo.delete(item)
        self.db.commit()

    # --- Private Helpers ---

    def _require_household_exists(self, household_id: UUID) -> None:
        """Verify the household exists. Raises 404 if not."""
        household = self.household_repo.get_by_id(household_id)
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Household not found",
            )

    def _require_membership(self, household_id: UUID, user_id: UUID):
        """Verify user is a member. Raises 403 if not."""
        membership = self.member_repo.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household",
            )
        return membership

    def _require_role(self, membership, allowed_roles: list[MemberRole]) -> None:
        """Verify the member has one of the allowed roles. Raises 403 if not."""
        allowed_values = [r.value for r in allowed_roles]
        if membership.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_values)}",
            )

    def _require_edit_permission(self, membership, item: InventoryItem, user_id: UUID) -> None:
        """Check if user can edit/delete this item.

        Owners/admins can edit any. Members can edit only their own.
        """
        is_privileged = membership.role in (
            MemberRole.OWNER.value, MemberRole.ADMIN.value
        )
        is_creator = item.created_by == user_id
        if not is_privileged and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify inventory items you created",
            )

    def _get_item_or_404(self, item_id: UUID) -> InventoryItem:
        """Fetch inventory item or raise 404."""
        item = self.inventory_repo.get_by_id(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found",
            )
        return item

    def _verify_item_belongs_to_household(
        self, item: InventoryItem, household_id: UUID
    ) -> None:
        """Verify the item belongs to the given household."""
        if item.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Inventory item not found in this household",
            )

    def _validate_inventory_category(
        self, category_id: UUID, household_id: UUID
    ) -> None:
        """Verify the category exists, belongs to the household, and is an inventory type."""
        category = self.category_repo.get_by_id(category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category not found",
            )
        if category.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Category does not belong to this household",
            )
        if category.category_type != CategoryType.INVENTORY.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category must be of type 'inventory', got '{category.category_type}'",
            )
