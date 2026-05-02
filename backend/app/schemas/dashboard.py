from pydantic import BaseModel
from datetime import date
from uuid import UUID


# --- Nested summary items ---

class ExpenseSummaryItem(BaseModel):
    id: str
    title: str
    amount: float
    expense_date: date
    category_id: str | None
    category_name: str | None
    payment_method: str | None


class BudgetSummaryItem(BaseModel):
    id: str
    name: str
    amount: float
    spent: float
    remaining: float
    percentage_used: float
    category_id: str | None


class UpcomingRecurringItem(BaseModel):
    id: str
    title: str
    amount: float
    frequency: str
    next_due_date: date
    days_until_due: int
    is_overdue: bool


class LowStockItem(BaseModel):
    id: str
    name: str
    quantity: float
    unit: str | None
    low_stock_threshold: float
    location: str | None


class RecentPurchaseItem(BaseModel):
    id: str
    store_name: str | None
    purchase_date: date
    total_amount: float
    item_count: int


class QuickAction(BaseModel):
    """Contextual action the user should take."""
    key: str          # machine key for the frontend
    icon: str         # Ionicons icon name
    label: str        # display text
    description: str  # short explanation


# --- Main Dashboard Response ---

class DashboardResponse(BaseModel):
    """Aggregated household dashboard summary."""
    # Spending overview
    spent_this_month: float
    expense_count_this_month: int
    total_budget: float
    total_budget_remaining: float
    budget_utilization_pct: float

    # Lists
    recent_expenses: list[ExpenseSummaryItem]
    budgets: list[BudgetSummaryItem]
    upcoming_recurring: list[UpcomingRecurringItem]
    low_stock_items: list[LowStockItem]
    recent_purchases: list[RecentPurchaseItem]
    quick_actions: list[QuickAction]

    # Counts for badges
    overdue_recurring_count: int
    low_stock_count: int
    budgets_over_limit_count: int
    inventory_total_count: int
    purchase_count_this_month: int
    purchase_total_this_month: float
