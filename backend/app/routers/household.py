from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.household import (
    CreateHouseholdRequest,
    UpdateHouseholdRequest,
    AddMemberRequest,
    UpdateMemberRoleRequest,
    HouseholdResponse,
    HouseholdWithRoleResponse,
    HouseholdDetailResponse,
    MemberResponse,
)
from app.services.household_service import HouseholdService

router = APIRouter(prefix="/households", tags=["Households"])


def get_household_service(db: Session = Depends(get_db)) -> HouseholdService:
    """Dependency that provides a HouseholdService instance."""
    return HouseholdService(db)


# --- Household CRUD ---


@router.post("", response_model=HouseholdResponse, status_code=status.HTTP_201_CREATED)
def create_household(
    body: CreateHouseholdRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """Create a new household. The requesting user becomes the owner."""
    household, _ = service.create_household(
        name=body.name,
        created_by=user_id,
        description=body.description,
    )
    return HouseholdResponse.model_validate(household)


@router.get("", response_model=list[HouseholdWithRoleResponse])
def list_my_households(
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """List all households the current user belongs to."""
    households = service.list_user_households(user_id)
    return [HouseholdWithRoleResponse(**h) for h in households]


@router.get("/{household_id}", response_model=HouseholdDetailResponse)
def get_household(
    household_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """Get full household details including members. Requires membership."""
    detail = service.get_household_detail(household_id, user_id)
    return HouseholdDetailResponse(
        household=HouseholdResponse.model_validate(detail["household"]),
        members=detail["members"],
        my_role=detail["my_role"],
    )


@router.patch("/{household_id}", response_model=HouseholdResponse)
def update_household(
    household_id: UUID,
    body: UpdateHouseholdRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """Update household details. Requires owner or admin role."""
    household = service.update_household(
        household_id=household_id,
        user_id=user_id,
        name=body.name,
        description=body.description,
    )
    return HouseholdResponse.model_validate(household)


# --- Member Management ---


@router.post(
    "/{household_id}/members",
    response_model=MemberResponse,
    status_code=status.HTTP_201_CREATED,
)
def add_member(
    household_id: UUID,
    body: AddMemberRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """Add a user to the household. Requires owner or admin role."""
    member = service.add_member(
        household_id=household_id,
        requesting_user_id=user_id,
        target_user_id=body.user_id,
        email=body.email,
        role=body.role.value,
    )
    return MemberResponse.model_validate(member)


@router.patch(
    "/{household_id}/members/{member_id}",
    response_model=MemberResponse,
)
def update_member_role(
    household_id: UUID,
    member_id: UUID,
    body: UpdateMemberRoleRequest,
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """Change a member's role. Requires owner role."""
    member = service.update_member_role(
        household_id=household_id,
        requesting_user_id=user_id,
        target_member_id=member_id,
        new_role=body.role.value,
    )
    return MemberResponse.model_validate(member)


@router.delete(
    "/{household_id}/members/{member_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def remove_member(
    household_id: UUID,
    member_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    service: HouseholdService = Depends(get_household_service),
):
    """Remove a member from the household.

    Owners can remove anyone. Members can remove themselves (leave).
    """
    service.remove_member(
        household_id=household_id,
        requesting_user_id=user_id,
        target_member_id=member_id,
    )
    return None
