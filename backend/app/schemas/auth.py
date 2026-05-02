from pydantic import BaseModel, EmailStr, ConfigDict
from datetime import datetime
from uuid import UUID


# --- Request Schemas ---

class RegisterRequest(BaseModel):
    """Schema for user registration."""
    email: EmailStr
    password: str
    full_name: str | None = None


class LoginRequest(BaseModel):
    """Schema for user login."""
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    """Schema for token refresh."""
    refresh_token: str


class LogoutRequest(BaseModel):
    """Schema for logout (revoke refresh token)."""
    refresh_token: str


# --- Response Schemas ---

class UserResponse(BaseModel):
    """Public user data returned in API responses."""
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    full_name: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime


class TokenResponse(BaseModel):
    """Access + refresh token pair returned on login/refresh."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RegisterResponse(BaseModel):
    """Response after successful registration."""
    user: UserResponse
    message: str = "User registered successfully"
