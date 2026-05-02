"""Create purchases and purchase_items tables

Revision ID: a3b91c2e4f68
Revises: 0f7325a1957d
Create Date: 2026-05-02 03:45:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "a3b91c2e4f68"
down_revision: Union[str, None] = "0f7325a1957d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Purchases table ---
    op.create_table(
        "purchases",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("store_name", sa.String(255), nullable=True),
        sa.Column("purchase_date", sa.Date(), nullable=False),
        sa.Column("total_amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("receipt_url", sa.String(500), nullable=True),
        sa.Column("receipt_reference", sa.String(255), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("total_amount >= 0", name="ck_purchase_total_non_negative"),
    )
    op.create_index("ix_purchases_household_id", "purchases", ["household_id"])
    op.create_index("ix_purchases_created_by", "purchases", ["created_by"])

    # --- Purchase Items table ---
    op.create_table(
        "purchase_items",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("purchase_id", sa.Uuid(), nullable=False),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("inventory_item_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("quantity", sa.Numeric(12, 2), nullable=False, server_default="1"),
        sa.Column("unit", sa.String(30), nullable=True),
        sa.Column("unit_price", sa.Numeric(12, 2), nullable=True),
        sa.Column("total_price", sa.Numeric(12, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["purchase_id"], ["purchases.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["inventory_item_id"], ["inventory_items.id"], ondelete="SET NULL"),
        sa.CheckConstraint("quantity > 0", name="ck_purchase_item_quantity_positive"),
        sa.CheckConstraint("unit_price IS NULL OR unit_price >= 0", name="ck_purchase_item_unit_price_non_negative"),
        sa.CheckConstraint("total_price >= 0", name="ck_purchase_item_total_non_negative"),
    )
    op.create_index("ix_purchase_items_purchase_id", "purchase_items", ["purchase_id"])
    op.create_index("ix_purchase_items_household_id", "purchase_items", ["household_id"])
    op.create_index("ix_purchase_items_category_id", "purchase_items", ["category_id"])
    op.create_index("ix_purchase_items_inventory_item_id", "purchase_items", ["inventory_item_id"])


def downgrade() -> None:
    op.drop_table("purchase_items")
    op.drop_table("purchases")
