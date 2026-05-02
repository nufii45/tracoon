from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.household_member import HouseholdMember
from app.models.household import Household
from app.models.user import User


class HouseholdMemberRepository:
    """Data access layer for the household_members table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, member_id: UUID) -> HouseholdMember | None:
        """Fetch a membership record by its UUID."""
        return self.db.get(HouseholdMember, member_id)

    def get_membership(
        self, household_id: UUID, user_id: UUID
    ) -> HouseholdMember | None:
        """Look up a specific user's membership in a specific household."""
        stmt = select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.user_id == user_id,
        )
        return self.db.execute(stmt).scalar_one_or_none()

    def get_user_households(self, user_id: UUID) -> list[tuple[Household, str]]:
        """Return all households a user belongs to, along with their role.

        Returns a list of (Household, role_string) tuples.
        """
        stmt = (
            select(Household, HouseholdMember.role)
            .join(HouseholdMember, Household.id == HouseholdMember.household_id)
            .where(HouseholdMember.user_id == user_id)
            .order_by(Household.created_at.desc())
        )
        return self.db.execute(stmt).all()

    def get_household_members(
        self, household_id: UUID
    ) -> list[tuple[HouseholdMember, str, str | None]]:
        """Return all members of a household with user email and name.

        Returns a list of (HouseholdMember, email, full_name) tuples.
        """
        stmt = (
            select(HouseholdMember, User.email, User.full_name)
            .join(User, HouseholdMember.user_id == User.id)
            .where(HouseholdMember.household_id == household_id)
            .order_by(HouseholdMember.joined_at)
        )
        return self.db.execute(stmt).all()

    def create(
        self, household_id: UUID, user_id: UUID, role: str
    ) -> HouseholdMember:
        """Add a user to a household with the given role."""
        member = HouseholdMember(
            household_id=household_id,
            user_id=user_id,
            role=role,
        )
        self.db.add(member)
        self.db.flush()
        return member

    def update_role(self, member: HouseholdMember, role: str) -> HouseholdMember:
        """Change a member's role."""
        member.role = role
        self.db.flush()
        return member

    def delete(self, member: HouseholdMember) -> None:
        """Remove a member from a household."""
        self.db.delete(member)
        self.db.flush()

    def count_owners(self, household_id: UUID) -> int:
        """Count the number of owners in a household."""
        stmt = select(HouseholdMember).where(
            HouseholdMember.household_id == household_id,
            HouseholdMember.role == "owner",
        )
        return len(self.db.execute(stmt).scalars().all())
