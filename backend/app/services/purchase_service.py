from uuid import UUID
from decimal import Decimal
from datetime import date

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.purchase import Purchase, PurchaseItem
from app.models.household_member import MemberRole
from app.models.category import CategoryType
from app.repositories.purchase_repository import PurchaseRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository
from app.repositories.category_repository import CategoryRepository


class PurchaseService:
    """Business logic for household purchase tracking."""

    def __init__(self, db: Session):
        self.db = db
        self.purchase_repo = PurchaseRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)
        self.category_repo = CategoryRepository(db)

    # --- List Purchases ---

    def list_purchases(
        self,
        household_id: UUID,
        user_id: UUID,
        store_name: str | None = None,
        payment_method: str | None = None,
        category_id: UUID | None = None,
        date_from: date | None = None,
        date_to: date | None = None,
        limit: int = 50,
        offset: int = 0,
    ) -> dict:
        """Return filtered purchases for a household with summary.

        Any member can list purchases.
        """
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)

        filter_kwargs = dict(
            household_id=household_id,
            store_name=store_name,
            payment_method=payment_method,
            category_id=category_id,
            date_from=date_from,
            date_to=date_to,
        )

        purchases = self.purchase_repo.get_by_household(
            **filter_kwargs, limit=limit, offset=offset
        )
        total_count = self.purchase_repo.count_total(**filter_kwargs)
        total_amount = self.purchase_repo.sum_total(**filter_kwargs)

        return {
            "purchases": purchases,
            "total_count": total_count,
            "total_amount": total_amount,
        }

    # --- Get Single Purchase ---

    def get_purchase(
        self, household_id: UUID, purchase_id: UUID, user_id: UUID
    ) -> Purchase:
        """Fetch a single purchase with its items. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        purchase = self._get_purchase_or_404(purchase_id)
        self._verify_purchase_belongs_to_household(purchase, household_id)
        return purchase

    # --- Create Purchase ---

    def create_purchase(
        self,
        household_id: UUID,
        user_id: UUID,
        purchase_date: date,
        total_amount: Decimal,
        store_name: str | None = None,
        payment_method: str | None = None,
        receipt_url: str | None = None,
        receipt_reference: str | None = None,
        notes: str | None = None,
        items: list[dict] | None = None,
    ) -> Purchase:
        """Create a new purchase with optional inline items.

        Members, admins, and owners can create.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(
            membership,
            [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
        )

        purchase = self.purchase_repo.create(
            household_id=household_id,
            created_by=user_id,
            purchase_date=purchase_date,
            total_amount=total_amount,
            store_name=store_name,
            payment_method=payment_method,
            receipt_url=receipt_url,
            receipt_reference=receipt_reference,
            notes=notes,
        )

        # Create inline items if provided
        if items:
            for item_data in items:
                # Validate category if provided
                cat_id = item_data.get("category_id")
                if cat_id:
                    self._validate_purchase_category(cat_id, household_id)

                self.purchase_repo.create_item(
                    purchase_id=purchase.id,
                    household_id=household_id,
                    **item_data,
                )

        self.db.commit()
        self.db.refresh(purchase)
        return purchase

    # --- Update Purchase ---

    def update_purchase(
        self,
        household_id: UUID,
        purchase_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> Purchase:
        """Update a purchase.

        - Members can update their own purchases.
        - Owners/admins can update any purchase.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        purchase = self._get_purchase_or_404(purchase_id)
        self._verify_purchase_belongs_to_household(purchase, household_id)
        self._require_edit_permission(membership, purchase, user_id)

        updated = self.purchase_repo.update(purchase, **kwargs)
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Delete Purchase ---

    def delete_purchase(
        self, household_id: UUID, purchase_id: UUID, user_id: UUID
    ) -> None:
        """Delete a purchase (cascade deletes items).

        - Members can delete their own purchases.
        - Owners/admins can delete any purchase.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        purchase = self._get_purchase_or_404(purchase_id)
        self._verify_purchase_belongs_to_household(purchase, household_id)
        self._require_edit_permission(membership, purchase, user_id)

        self.purchase_repo.delete(purchase)
        self.db.commit()

    # --- Purchase Item Operations ---

    def add_item(
        self,
        household_id: UUID,
        purchase_id: UUID,
        user_id: UUID,
        name: str,
        total_price: Decimal,
        quantity: Decimal = Decimal("1"),
        unit: str | None = None,
        unit_price: Decimal | None = None,
        category_id: UUID | None = None,
        inventory_item_id: UUID | None = None,
        notes: str | None = None,
    ) -> PurchaseItem:
        """Add an item to a purchase."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        purchase = self._get_purchase_or_404(purchase_id)
        self._verify_purchase_belongs_to_household(purchase, household_id)
        self._require_edit_permission(membership, purchase, user_id)

        if category_id:
            self._validate_purchase_category(category_id, household_id)

        item = self.purchase_repo.create_item(
            purchase_id=purchase_id,
            household_id=household_id,
            name=name,
            total_price=total_price,
            quantity=quantity,
            unit=unit,
            unit_price=unit_price,
            category_id=category_id,
            inventory_item_id=inventory_item_id,
            notes=notes,
        )
        self.db.commit()
        self.db.refresh(item)
        return item

    def update_item(
        self,
        household_id: UUID,
        purchase_id: UUID,
        item_id: UUID,
        user_id: UUID,
        **kwargs,
    ) -> PurchaseItem:
        """Update a purchase item."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        purchase = self._get_purchase_or_404(purchase_id)
        self._verify_purchase_belongs_to_household(purchase, household_id)
        self._require_edit_permission(membership, purchase, user_id)

        item = self._get_item_or_404(item_id)
        if item.purchase_id != purchase_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found in this purchase",
            )

        if "category_id" in kwargs and kwargs["category_id"] is not None:
            self._validate_purchase_category(kwargs["category_id"], household_id)

        updated = self.purchase_repo.update_item(item, **kwargs)
        self.db.commit()
        self.db.refresh(updated)
        return updated

    def delete_item(
        self,
        household_id: UUID,
        purchase_id: UUID,
        item_id: UUID,
        user_id: UUID,
    ) -> None:
        """Delete a purchase item."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)

        purchase = self._get_purchase_or_404(purchase_id)
        self._verify_purchase_belongs_to_household(purchase, household_id)
        self._require_edit_permission(membership, purchase, user_id)

        item = self._get_item_or_404(item_id)
        if item.purchase_id != purchase_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Item not found in this purchase",
            )

        self.purchase_repo.delete_item(item)
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

    def _require_edit_permission(self, membership, purchase: Purchase, user_id: UUID) -> None:
        """Check if user can edit/delete this purchase.

        Owners/admins can edit any. Members can edit only their own.
        """
        is_privileged = membership.role in (
            MemberRole.OWNER.value, MemberRole.ADMIN.value
        )
        is_creator = purchase.created_by == user_id
        if not is_privileged and not is_creator:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only modify purchases you created",
            )

    def _get_purchase_or_404(self, purchase_id: UUID) -> Purchase:
        """Fetch purchase or raise 404."""
        purchase = self.purchase_repo.get_by_id(purchase_id)
        if not purchase:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found",
            )
        return purchase

    def _get_item_or_404(self, item_id: UUID) -> PurchaseItem:
        """Fetch purchase item or raise 404."""
        item = self.purchase_repo.get_item_by_id(item_id)
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase item not found",
            )
        return item

    def _verify_purchase_belongs_to_household(
        self, purchase: Purchase, household_id: UUID
    ) -> None:
        """Verify the purchase belongs to the given household."""
        if purchase.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Purchase not found in this household",
            )

    def _validate_purchase_category(
        self, category_id: UUID, household_id: UUID
    ) -> None:
        """Verify the category exists, belongs to the household, and is a purchase type."""
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
        if category.category_type != CategoryType.PURCHASE.value:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Category must be of type 'purchase', got '{category.category_type}'",
            )
