from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.category import Category
from app.models.household_member import MemberRole
from app.repositories.category_repository import CategoryRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository


class CategoryService:
    """Business logic for household category management."""

    def __init__(self, db: Session):
        self.db = db
        self.category_repo = CategoryRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)

    # --- List Categories ---

    def list_categories(
        self,
        household_id: UUID,
        user_id: UUID,
        category_type: str | None = None,
    ) -> list[Category]:
        """Return all categories for a household. Any member can view.

        Optionally filter by category_type.
        """
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        return self.category_repo.get_by_household(household_id, category_type)

    # --- Get Single Category ---

    def get_category(
        self, household_id: UUID, category_id: UUID, user_id: UUID
    ) -> Category:
        """Fetch a single category. Any member can view."""
        self._require_household_exists(household_id)
        self._require_membership(household_id, user_id)
        category = self._get_category_or_404(category_id)
        self._verify_category_belongs_to_household(category, household_id)
        return category

    # --- Create Category ---

    def create_category(
        self,
        household_id: UUID,
        user_id: UUID,
        name: str,
        category_type: str,
        color: str | None = None,
        icon: str | None = None,
        is_default: bool = False,
    ) -> Category:
        """Create a new category. Only owners/admins can create.

        Raises 409 if a category with the same type+name already exists.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        # Check for duplicates
        existing = self.category_repo.get_duplicate(
            household_id, category_type, name
        )
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"A {category_type} category named '{name}' already exists in this household",
            )

        category = self.category_repo.create(
            household_id=household_id,
            name=name,
            category_type=category_type,
            created_by=user_id,
            color=color,
            icon=icon,
            is_default=is_default,
        )
        self.db.commit()
        self.db.refresh(category)
        return category

    # --- Update Category ---

    def update_category(
        self,
        household_id: UUID,
        category_id: UUID,
        user_id: UUID,
        name: str | None = None,
        color: str | None = None,
        icon: str | None = None,
        is_default: bool | None = None,
    ) -> Category:
        """Update a category. Only owners/admins can update.

        Raises 409 if renaming would create a duplicate.
        """
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        category = self._get_category_or_404(category_id)
        self._verify_category_belongs_to_household(category, household_id)

        # If renaming, check for duplicates
        if name and name != category.name:
            existing = self.category_repo.get_duplicate(
                household_id, category.category_type, name
            )
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail=f"A {category.category_type} category named '{name}' already exists in this household",
                )

        updated = self.category_repo.update(
            category, name=name, color=color, icon=icon, is_default=is_default
        )
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Delete Category ---

    def delete_category(
        self, household_id: UUID, category_id: UUID, user_id: UUID
    ) -> None:
        """Delete a category. Only owners/admins can delete."""
        self._require_household_exists(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        category = self._get_category_or_404(category_id)
        self._verify_category_belongs_to_household(category, household_id)

        self.category_repo.delete(category)
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

    def _get_category_or_404(self, category_id: UUID) -> Category:
        """Fetch category or raise 404."""
        category = self.category_repo.get_by_id(category_id)
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found",
            )
        return category

    def _verify_category_belongs_to_household(
        self, category: Category, household_id: UUID
    ) -> None:
        """Verify the category belongs to the given household."""
        if category.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Category not found in this household",
            )
