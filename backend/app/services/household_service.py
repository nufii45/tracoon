from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.household import Household
from app.models.household_member import HouseholdMember, MemberRole
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository
from app.repositories.user_repository import UserRepository


class HouseholdService:
    """Business logic for household management."""

    def __init__(self, db: Session):
        self.db = db
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)
        self.user_repo = UserRepository(db)

    # --- Create Household ---

    def create_household(
        self, name: str, created_by: UUID, description: str | None = None
    ) -> tuple[Household, HouseholdMember]:
        """Create a household and make the creator the owner.

        Returns (household, owner_membership).
        """
        household = self.household_repo.create(
            name=name,
            created_by=created_by,
            description=description,
        )
        owner_membership = self.member_repo.create(
            household_id=household.id,
            user_id=created_by,
            role=MemberRole.OWNER.value,
        )
        self.db.commit()
        self.db.refresh(household)
        self.db.refresh(owner_membership)
        return household, owner_membership

    # --- List My Households ---

    def list_user_households(self, user_id: UUID) -> list[dict]:
        """Return all households the user belongs to, with their role."""
        rows = self.member_repo.get_user_households(user_id)
        return [
            {
                "id": household.id,
                "name": household.name,
                "description": household.description,
                "created_by": household.created_by,
                "created_at": household.created_at,
                "updated_at": household.updated_at,
                "my_role": role,
            }
            for household, role in rows
        ]

    # --- Get Household Detail ---

    def get_household_detail(self, household_id: UUID, user_id: UUID) -> dict:
        """Return full household details including members.

        Raises 404 if household doesn't exist.
        Raises 403 if user is not a member.
        """
        household = self._get_household_or_404(household_id)
        membership = self._require_membership(household_id, user_id)

        member_rows = self.member_repo.get_household_members(household_id)
        members = [
            {
                "id": member.id,
                "household_id": member.household_id,
                "user_id": member.user_id,
                "role": member.role,
                "joined_at": member.joined_at,
                "user_email": email,
                "user_full_name": full_name,
            }
            for member, email, full_name in member_rows
        ]

        return {
            "household": household,
            "members": members,
            "my_role": membership.role,
        }

    # --- Update Household ---

    def update_household(
        self,
        household_id: UUID,
        user_id: UUID,
        name: str | None = None,
        description: str | None = None,
    ) -> Household:
        """Update household details. Only owners/admins can do this.

        Raises 403 if user lacks permission.
        """
        household = self._get_household_or_404(household_id)
        membership = self._require_membership(household_id, user_id)
        self._require_role(membership, [MemberRole.OWNER, MemberRole.ADMIN])

        updated = self.household_repo.update(
            household, name=name, description=description
        )
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Add Member ---

    def add_member(
        self,
        household_id: UUID,
        requesting_user_id: UUID,
        target_user_id: UUID | None = None,
        email: str | None = None,
        role: str = "member",
    ) -> HouseholdMember:
        """Add a user to the household. Only owners/admins can add members.

        Provide either target_user_id or email to identify the user.
        Raises 409 if the user is already a member.
        Raises 400 if trying to add another owner.
        """
        self._get_household_or_404(household_id)
        requester = self._require_membership(household_id, requesting_user_id)
        self._require_role(requester, [MemberRole.OWNER, MemberRole.ADMIN])

        # Resolve target user from email or user_id
        if email and not target_user_id:
            target_user = self.user_repo.get_by_email(email)
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"No user found with email '{email}'",
                )
            target_user_id = target_user.id
        elif target_user_id:
            target_user = self.user_repo.get_by_id(target_user_id)
            if not target_user:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="User not found",
                )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Provide either user_id or email",
            )

        # Check not already a member
        existing = self.member_repo.get_membership(household_id, target_user_id)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="User is already a member of this household",
            )

        # Only owners can assign owner/admin roles
        if role in (MemberRole.OWNER.value, MemberRole.ADMIN.value):
            self._require_role(requester, [MemberRole.OWNER])

        member = self.member_repo.create(
            household_id=household_id,
            user_id=target_user_id,
            role=role,
        )
        self.db.commit()
        self.db.refresh(member)
        return member

    # --- Update Member Role ---

    def update_member_role(
        self,
        household_id: UUID,
        requesting_user_id: UUID,
        target_member_id: UUID,
        new_role: str,
    ) -> HouseholdMember:
        """Change a member's role. Only owners can do this.

        Raises 400 if this would remove the last owner.
        """
        self._get_household_or_404(household_id)
        requester = self._require_membership(household_id, requesting_user_id)
        self._require_role(requester, [MemberRole.OWNER])

        target = self.member_repo.get_by_id(target_member_id)
        if not target or target.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this household",
            )

        # Prevent removing the last owner
        if (
            target.role == MemberRole.OWNER.value
            and new_role != MemberRole.OWNER.value
        ):
            owner_count = self.member_repo.count_owners(household_id)
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot change role: household must have at least one owner",
                )

        updated = self.member_repo.update_role(target, new_role)
        self.db.commit()
        self.db.refresh(updated)
        return updated

    # --- Remove Member ---

    def remove_member(
        self,
        household_id: UUID,
        requesting_user_id: UUID,
        target_member_id: UUID,
    ) -> None:
        """Remove a member from the household. Only owners can remove others.

        Members can always remove themselves (leave).
        Raises 400 if the last owner tries to leave.
        """
        self._get_household_or_404(household_id)
        requester = self._require_membership(household_id, requesting_user_id)

        target = self.member_repo.get_by_id(target_member_id)
        if not target or target.household_id != household_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Member not found in this household",
            )

        # Self-removal (leaving) is always allowed unless you're the last owner
        is_self = target.user_id == requesting_user_id
        if not is_self:
            self._require_role(requester, [MemberRole.OWNER])

        # Prevent the last owner from leaving
        if target.role == MemberRole.OWNER.value:
            owner_count = self.member_repo.count_owners(household_id)
            if owner_count <= 1:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot remove the last owner. Transfer ownership first.",
                )

        self.member_repo.delete(target)
        self.db.commit()

    # --- Private Helpers ---

    def _get_household_or_404(self, household_id: UUID) -> Household:
        """Fetch household or raise 404."""
        household = self.household_repo.get_by_id(household_id)
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Household not found",
            )
        return household

    def _require_membership(
        self, household_id: UUID, user_id: UUID
    ) -> HouseholdMember:
        """Verify user is a member of the household. Raises 403 if not."""
        membership = self.member_repo.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household",
            )
        return membership

    def _require_role(
        self, membership: HouseholdMember, allowed_roles: list[MemberRole]
    ) -> None:
        """Verify the member has one of the allowed roles. Raises 403 if not."""
        allowed_values = [r.value for r in allowed_roles]
        if membership.role not in allowed_values:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Insufficient permissions. Required role: {', '.join(allowed_values)}",
            )
