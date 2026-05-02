from uuid import UUID
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.repositories.expense_repository import ExpenseRepository
from app.repositories.budget_repository import BudgetRepository
from app.repositories.recurring_expense_repository import RecurringExpenseRepository
from app.repositories.inventory_repository import InventoryRepository
from app.repositories.purchase_repository import PurchaseRepository
from app.repositories.category_repository import CategoryRepository
from app.repositories.household_repository import HouseholdRepository
from app.repositories.household_member_repository import HouseholdMemberRepository


class DashboardService:
    """Aggregates data from multiple repositories into a dashboard summary."""

    def __init__(self, db: Session):
        self.db = db
        self.expense_repo = ExpenseRepository(db)
        self.budget_repo = BudgetRepository(db)
        self.recurring_repo = RecurringExpenseRepository(db)
        self.inventory_repo = InventoryRepository(db)
        self.purchase_repo = PurchaseRepository(db)
        self.category_repo = CategoryRepository(db)
        self.household_repo = HouseholdRepository(db)
        self.member_repo = HouseholdMemberRepository(db)

    def get_summary(self, household_id: UUID, user_id: UUID) -> dict:
        """Build the full dashboard summary for a household."""
        # Access control
        household = self.household_repo.get_by_id(household_id)
        if not household:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Household not found",
            )
        membership = self.member_repo.get_membership(household_id, user_id)
        if not membership:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You are not a member of this household",
            )

        today = date.today()
        month_start = today.replace(day=1)

        # Build a category name lookup
        categories = self.category_repo.get_by_household(household_id)
        cat_map = {str(c.id): c.name for c in categories}

        # ── 1. Spending this month ──
        expense_count, spent_total = self.expense_repo.count_and_sum(
            household_id=household_id,
            date_from=month_start,
            date_to=today,
        )
        spent_this_month = float(spent_total)

        # ── 2. Recent expenses (last 5) ──
        recent_expenses_raw = self.expense_repo.get_by_household(
            household_id=household_id,
            date_from=month_start,
            date_to=today,
            limit=5,
        )
        recent_expenses = [
            {
                "id": str(e.id),
                "title": e.title,
                "amount": float(e.amount),
                "expense_date": e.expense_date,
                "category_id": str(e.category_id) if e.category_id else None,
                "category_name": cat_map.get(str(e.category_id)) if e.category_id else None,
                "payment_method": e.payment_method,
            }
            for e in recent_expenses_raw
        ]

        # ── 3. Budget overview ──
        budgets_raw = self.budget_repo.get_by_household(household_id)
        budgets_summary = []
        total_budget = 0.0
        total_budget_remaining = 0.0
        budgets_over_limit = 0

        # Deduplicate spent across budget categories for the overall total
        seen_categories: set[str] = set()
        unique_spent = 0.0

        for b in budgets_raw:
            # Calculate spent for this budget
            if b.category_id:
                _, b_spent = self.expense_repo.count_and_sum(
                    household_id=household_id,
                    category_id=b.category_id,
                    date_from=b.period_start,
                    date_to=b.period_end,
                )
            else:
                _, b_spent = self.expense_repo.count_and_sum(
                    household_id=household_id,
                    date_from=b.period_start,
                    date_to=b.period_end,
                    uncategorized_only=True,
                )
            spent = float(b_spent)
            remaining = float(b.amount) - spent
            pct = round(spent / float(b.amount) * 100, 2) if b.amount > 0 else 0.0

            budgets_summary.append({
                "id": str(b.id),
                "name": b.name,
                "amount": float(b.amount),
                "spent": spent,
                "remaining": remaining,
                "percentage_used": pct,
                "category_id": str(b.category_id) if b.category_id else None,
            })

            total_budget += float(b.amount)

            # Deduplicate for overall remaining/spent
            cat_key = str(b.category_id) if b.category_id else "__uncategorized__"
            if cat_key not in seen_categories:
                seen_categories.add(cat_key)
                unique_spent += spent
                total_budget_remaining += remaining

            if pct > 100:
                budgets_over_limit += 1

        budget_utilization = round(
            unique_spent / total_budget * 100, 2
        ) if total_budget > 0 else 0.0

        # ── 4. Upcoming & overdue recurring ──
        upcoming_rules = self.recurring_repo.get_upcoming_rules(household_id, within_days=14)
        overdue_count = 0
        upcoming_recurring = []
        for r in upcoming_rules:
            days_until = (r.next_due_date - today).days
            is_overdue = days_until < 0
            if is_overdue:
                overdue_count += 1
            upcoming_recurring.append({
                "id": str(r.id),
                "title": r.title,
                "amount": float(r.amount),
                "frequency": r.frequency,
                "next_due_date": r.next_due_date,
                "days_until_due": days_until,
                "is_overdue": is_overdue,
            })

        # ── 5. Low stock items ──
        low_stock_items_raw = self.inventory_repo.get_by_household(
            household_id=household_id,
            low_stock_only=True,
            limit=10,
        )
        low_stock_count = self.inventory_repo.count_low_stock(household_id)
        inventory_total_count = self.inventory_repo.count_total(household_id)
        low_stock_items = [
            {
                "id": str(i.id),
                "name": i.name,
                "quantity": float(i.quantity),
                "unit": i.unit,
                "low_stock_threshold": float(i.low_stock_threshold) if i.low_stock_threshold else 0,
                "location": i.location,
            }
            for i in low_stock_items_raw
        ]

        # ── 6. Recent purchases (last 5) ──
        recent_purchases_raw = self.purchase_repo.get_by_household(
            household_id=household_id,
            limit=5,
        )
        recent_purchases = [
            {
                "id": str(p.id),
                "store_name": p.store_name,
                "purchase_date": p.purchase_date,
                "total_amount": float(p.total_amount),
                "item_count": len(p.items) if hasattr(p, "items") and p.items else 0,
            }
            for p in recent_purchases_raw
        ]

        # Monthly purchase stats
        purchase_count_this_month = self.purchase_repo.count_total(
            household_id=household_id,
            date_from=month_start,
            date_to=today,
        )
        purchase_total_this_month = float(self.purchase_repo.sum_total(
            household_id=household_id,
            date_from=month_start,
            date_to=today,
        ))

        # ── 7. Quick actions ──
        quick_actions = self._build_quick_actions(
            overdue_count=overdue_count,
            low_stock_count=low_stock_count,
            budgets_over_limit=budgets_over_limit,
            expense_count=expense_count,
            total_budget=total_budget,
        )

        return {
            "spent_this_month": spent_this_month,
            "expense_count_this_month": expense_count,
            "total_budget": total_budget,
            "total_budget_remaining": total_budget_remaining,
            "budget_utilization_pct": budget_utilization,
            "recent_expenses": recent_expenses,
            "budgets": budgets_summary,
            "upcoming_recurring": upcoming_recurring,
            "low_stock_items": low_stock_items,
            "recent_purchases": recent_purchases,
            "quick_actions": quick_actions,
            "overdue_recurring_count": overdue_count,
            "low_stock_count": low_stock_count,
            "budgets_over_limit_count": budgets_over_limit,
            "inventory_total_count": inventory_total_count,
            "purchase_count_this_month": purchase_count_this_month,
            "purchase_total_this_month": purchase_total_this_month,
        }

    # ── Quick Actions Builder ──

    @staticmethod
    def _build_quick_actions(
        overdue_count: int,
        low_stock_count: int,
        budgets_over_limit: int,
        expense_count: int,
        total_budget: float,
    ) -> list[dict]:
        """Generate contextual quick action suggestions."""
        actions: list[dict] = []

        if overdue_count > 0:
            actions.append({
                "key": "generate_recurring",
                "icon": "flash",
                "label": f"Generate {overdue_count} overdue expense{'s' if overdue_count != 1 else ''}",
                "description": "Recurring expenses are past due and need to be generated.",
            })

        if budgets_over_limit > 0:
            actions.append({
                "key": "review_budgets",
                "icon": "warning",
                "label": f"{budgets_over_limit} budget{'s' if budgets_over_limit != 1 else ''} over limit",
                "description": "Some budgets have exceeded their spending limit.",
            })

        if low_stock_count > 0:
            actions.append({
                "key": "restock_items",
                "icon": "cube",
                "label": f"{low_stock_count} item{'s' if low_stock_count != 1 else ''} low on stock",
                "description": "Inventory items need restocking.",
            })

        if total_budget == 0:
            actions.append({
                "key": "create_budget",
                "icon": "pie-chart",
                "label": "Set up a budget",
                "description": "Create your first budget to track spending limits.",
            })

        if expense_count == 0:
            actions.append({
                "key": "log_expense",
                "icon": "add-circle",
                "label": "Log your first expense",
                "description": "Start tracking expenses for this month.",
            })

        # Always show a gentle add-expense action if there are no urgent items
        if not actions:
            actions.append({
                "key": "log_expense",
                "icon": "add-circle",
                "label": "Add an expense",
                "description": "Keep your records up to date.",
            })

        return actions
