from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user_id
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
    RefreshRequest,
    LogoutRequest,
    UserResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])


def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    """Dependency that provides an AuthService instance."""
    return AuthService(db)


# --- Endpoints ---


@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, service: AuthService = Depends(get_auth_service)):
    """Register a new user account."""
    user = service.register(
        email=body.email,
        password=body.password,
        full_name=body.full_name,
    )
    return RegisterResponse(user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, service: AuthService = Depends(get_auth_service)):
    """Authenticate and receive access + refresh tokens."""
    tokens = service.login(email=body.email, password=body.password)
    return TokenResponse(**tokens)


@router.post("/refresh", response_model=TokenResponse)
def refresh(body: RefreshRequest, service: AuthService = Depends(get_auth_service)):
    """Exchange a valid refresh token for a new token pair."""
    tokens = service.refresh(refresh_token_str=body.refresh_token)
    return TokenResponse(**tokens)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(body: LogoutRequest, service: AuthService = Depends(get_auth_service)):
    """Revoke a refresh token."""
    service.logout(refresh_token_str=body.refresh_token)
    return None


@router.get("/me", response_model=UserResponse)
def get_me(
    user_id: UUID = Depends(get_current_user_id),
    service: AuthService = Depends(get_auth_service),
):
    """Return the currently authenticated user's profile."""
    user = service.get_user_by_id(user_id)
    return UserResponse.model_validate(user)
