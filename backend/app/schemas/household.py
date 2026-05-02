from pydantic import BaseModel, ConfigDict, Field
from datetime import datetime
from uuid import UUID
from enum import Enum


# --- Enums ---

class MemberRoleEnum(str, Enum):
    """Allowed household member roles."""
    OWNER = "owner"
    ADMIN = "admin"
    MEMBER = "member"
    VIEWER = "viewer"


# --- Request Schemas ---

class CreateHouseholdRequest(BaseModel):
    """Schema for creating a new household."""
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None


class UpdateHouseholdRequest(BaseModel):
    """Schema for updating household details. All fields optional."""
    name: str | None = Field(None, min_length=1, max_length=255)
    description: str | None = None


class AddMemberRequest(BaseModel):
    """Schema for adding a member to a household. Provide either user_id or email."""
    user_id: UUID | None = None
    email: str | None = None
    role: MemberRoleEnum = MemberRoleEnum.MEMBER


class UpdateMemberRoleRequest(BaseModel):
    """Schema for changing a member's role."""
    role: MemberRoleEnum


# --- Response Schemas ---

class MemberResponse(BaseModel):
    """A household member with their role."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    created_at: datetime
    updated_at: datetime


class MemberWithUserResponse(BaseModel):
    """A household member with basic user info included."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    household_id: UUID
    user_id: UUID
    role: str
    joined_at: datetime
    user_email: str
    user_full_name: str | None


class HouseholdResponse(BaseModel):
    """Public household data returned in API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime


class HouseholdWithRoleResponse(BaseModel):
    """Household data with the requesting user's role."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None
    created_by: UUID | None
    created_at: datetime
    updated_at: datetime
    my_role: str


class HouseholdDetailResponse(BaseModel):
    """Full household detail including member list."""
    household: HouseholdResponse
    members: list[MemberWithUserResponse]
    my_role: str
