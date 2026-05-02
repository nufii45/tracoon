"""add currency column to expenses

Revision ID: c9f4a1b2d3e5
Revises: b5c82d3f6a91
Create Date: 2026-05-02 18:38:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9f4a1b2d3e5'
down_revision: Union[str, None] = 'b5c82d3f6a91'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'expenses',
        sa.Column('currency', sa.String(length=3), nullable=False, server_default='PHP'),
    )


def downgrade() -> None:
    op.drop_column('expenses', 'currency')
