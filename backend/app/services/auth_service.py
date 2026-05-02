import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.config import get_settings
from app.core.security import hash_password, verify_password, create_access_token
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.repositories.token_repository import TokenRepository

settings = get_settings()


class AuthService:
    """Business logic for authentication flows."""

    def __init__(self, db: Session):
        self.db = db
        self.user_repo = UserRepository(db)
        self.token_repo = TokenRepository(db)

    # --- Registration ---

    def register(self, email: str, password: str, full_name: str | None = None) -> User:
        """Register a new user.

        Raises HTTPException 409 if the email is already taken.
        """
        existing = self.user_repo.get_by_email(email)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists",
            )

        hashed = hash_password(password)
        user = self.user_repo.create(
            email=email,
            hashed_password=hashed,
            full_name=full_name,
        )
        self.db.commit()
        self.db.refresh(user)
        return user

    # --- Login ---

    def login(self, email: str, password: str) -> dict:
        """Authenticate user and return access + refresh tokens.

        Raises HTTPException 401 on invalid credentials.
        """
        user = self._authenticate(email, password)

        access_token = create_access_token(subject=str(user.id))
        refresh_token = self._create_refresh_token(user.id)

        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
        }

    # --- Refresh ---

    def refresh(self, refresh_token_str: str) -> dict:
        """Validate a refresh token, rotate it, and issue a new access token.

        Raises HTTPException 401 if the token is invalid or expired.
        """
        stored = self.token_repo.get_by_token(refresh_token_str)
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )

        if stored.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            self.token_repo.delete_by_token(refresh_token_str)
            self.db.commit()
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Refresh token has expired",
            )

        # Rotate: delete old, create new
        self.token_repo.delete_by_token(refresh_token_str)
        new_refresh = self._create_refresh_token(stored.user_id)
        new_access = create_access_token(subject=str(stored.user_id))

        return {
            "access_token": new_access,
            "refresh_token": new_refresh,
        }

    # --- Logout ---

    def logout(self, refresh_token_str: str) -> None:
        """Revoke a refresh token. Silent no-op if it doesn't exist."""
        self.token_repo.delete_by_token(refresh_token_str)
        self.db.commit()

    # --- Get Current User ---

    def get_user_by_id(self, user_id: UUID) -> User:
        """Fetch user by ID. Raises 404 if not found or inactive."""
        user = self.user_repo.get_by_id(user_id)
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found",
            )
        return user

    # --- Private Helpers ---

    def _authenticate(self, email: str, password: str) -> User:
        """Verify email + password. Raises 401 on failure."""
        user = self.user_repo.get_by_email(email)
        if not user or not verify_password(password, user.hashed_password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is deactivated",
            )
        return user

    def _create_refresh_token(self, user_id: UUID) -> str:
        """Generate a cryptographically secure refresh token and store it."""
        token_str = secrets.token_urlsafe(64)
        expires_at = datetime.now(timezone.utc) + timedelta(
            days=settings.REFRESH_TOKEN_EXPIRE_DAYS
        )
        self.token_repo.create(
            user_id=user_id,
            token=token_str,
            expires_at=expires_at,
        )
        self.db.commit()
        return token_str
