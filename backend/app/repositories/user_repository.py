from uuid import UUID
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models.user import User


class UserRepository:
    """Data access layer for the users table."""

    def __init__(self, db: Session):
        self.db = db

    def get_by_id(self, user_id: UUID) -> User | None:
        """Fetch a user by their UUID."""
        return self.db.get(User, user_id)

    def get_by_email(self, email: str) -> User | None:
        """Fetch a user by email address."""
        stmt = select(User).where(User.email == email)
        return self.db.execute(stmt).scalar_one_or_none()

    def create(self, email: str, hashed_password: str, full_name: str | None = None) -> User:
        """Insert a new user and flush to get the generated ID."""
        user = User(
            email=email,
            hashed_password=hashed_password,
            full_name=full_name,
        )
        self.db.add(user)
        self.db.flush()
        return user
