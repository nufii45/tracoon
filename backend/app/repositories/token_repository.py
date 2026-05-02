from uuid import UUID
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from sqlalchemy import select, delete
from app.models.refresh_token import RefreshToken


class TokenRepository:
    """Data access layer for the refresh_tokens table."""

    def __init__(self, db: Session):
        self.db = db

    def create(self, user_id: UUID, token: str, expires_at: datetime) -> RefreshToken:
        """Store a new refresh token."""
        refresh_token = RefreshToken(
            user_id=user_id,
            token=token,
            expires_at=expires_at,
        )
        self.db.add(refresh_token)
        self.db.flush()
        return refresh_token

    def get_by_token(self, token: str) -> RefreshToken | None:
        """Look up a refresh token by its string value."""
        stmt = select(RefreshToken).where(RefreshToken.token == token)
        return self.db.execute(stmt).scalar_one_or_none()

    def delete_by_token(self, token: str) -> bool:
        """Revoke a single refresh token. Returns True if it existed."""
        stmt = delete(RefreshToken).where(RefreshToken.token == token)
        result = self.db.execute(stmt)
        return result.rowcount > 0

    def delete_all_for_user(self, user_id: UUID) -> int:
        """Revoke all refresh tokens for a user (e.g. on password change)."""
        stmt = delete(RefreshToken).where(RefreshToken.user_id == user_id)
        result = self.db.execute(stmt)
        return result.rowcount

    def delete_expired(self) -> int:
        """Purge all expired refresh tokens."""
        now = datetime.now(timezone.utc)
        stmt = delete(RefreshToken).where(RefreshToken.expires_at < now)
        result = self.db.execute(stmt)
        return result.rowcount
