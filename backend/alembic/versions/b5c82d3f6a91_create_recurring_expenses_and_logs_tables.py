"""Create recurring_expenses and generated_expense_logs tables

Revision ID: b5c82d3f6a91
Revises: a3b91c2e4f68
Create Date: 2026-05-02 03:56:00.000000+00:00

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "b5c82d3f6a91"
down_revision: Union[str, None] = "a3b91c2e4f68"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- Recurring Expenses table ---
    op.create_table(
        "recurring_expenses",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("household_id", sa.Uuid(), nullable=False),
        sa.Column("category_id", sa.Uuid(), nullable=True),
        sa.Column("created_by", sa.Uuid(), nullable=True),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("amount", sa.Numeric(12, 2), nullable=False),
        sa.Column("frequency", sa.String(20), nullable=False),
        sa.Column("next_due_date", sa.Date(), nullable=False),
        sa.Column("payment_method", sa.String(50), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["household_id"], ["households.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["created_by"], ["users.id"], ondelete="SET NULL"),
        sa.CheckConstraint("amount > 0", name="ck_recurring_expense_amount_positive"),
        sa.CheckConstraint(
            "frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')",
            name="ck_recurring_expense_frequency_valid",
        ),
    )
    op.create_index("ix_recurring_expenses_household_id", "recurring_expenses", ["household_id"])
    op.create_index("ix_recurring_expenses_category_id", "recurring_expenses", ["category_id"])
    op.create_index("ix_recurring_expenses_created_by", "recurring_expenses", ["created_by"])
    op.create_index("ix_recurring_expenses_next_due_date", "recurring_expenses", ["next_due_date"])

    # --- Generated Expense Logs table ---
    op.create_table(
        "generated_expense_logs",
        sa.Column("id", sa.Uuid(), nullable=False, default=sa.text("gen_random_uuid()")),
        sa.Column("recurring_expense_id", sa.Uuid(), nullable=False),
        sa.Column("expense_id", sa.Uuid(), nullable=False),
        sa.Column("occurrence_date", sa.Date(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["recurring_expense_id"], ["recurring_expenses.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["expense_id"], ["expenses.id"], ondelete="CASCADE"),
        sa.UniqueConstraint("recurring_expense_id", "occurrence_date", name="uq_generated_expense_rule_date"),
    )
    op.create_index("ix_generated_expense_logs_recurring_expense_id", "generated_expense_logs", ["recurring_expense_id"])
    op.create_index("ix_generated_expense_logs_expense_id", "generated_expense_logs", ["expense_id"])


def downgrade() -> None:
    op.drop_table("generated_expense_logs")
    op.drop_table("recurring_expenses")
