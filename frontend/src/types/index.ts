// ── User ──
export interface User {
  id: string;
  email: string;
  full_name: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ── Auth ──
export interface TokenPair {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RegisterResponse {
  user: User;
  message: string;
}

// ── Household ──
export interface Household {
  id: string;
  name: string;
  description: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface HouseholdWithRole extends Household {
  my_role: string;
}

export interface HouseholdMember {
  id: string;
  household_id: string;
  user_id: string;
  role: string;
  joined_at: string;
  user_email: string;
  user_full_name: string | null;
}

export interface HouseholdDetail {
  household: Household;
  members: HouseholdMember[];
  my_role: string;
}

// ── Category ──
export type CategoryType = 'expense' | 'budget' | 'inventory' | 'purchase';

export interface Category {
  id: string;
  household_id: string;
  name: string;
  category_type: CategoryType;
  color: string | null;
  icon: string | null;
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ── Expense ──
export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'e_wallet' | 'other';

export interface Expense {
  id: string;
  household_id: string;
  category_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  amount: number;
  expense_date: string;
  payment_method: string | null;
  notes: string | null;
  is_recurring: boolean;
  created_at: string;
  updated_at: string;
}

export interface ExpenseList {
  expenses: Expense[];
  total_count: number;
  total_amount: number;
}

// ── Budget ──
export interface Budget {
  id: string;
  household_id: string;
  category_id: string | null;
  created_by: string | null;
  name: string;
  description: string | null;
  amount: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
  spent: number;
  remaining: number;
  percentage_used: number;
  expense_count: number;
}

// ── Inventory ──
export interface InventoryItem {
  id: string;
  household_id: string;
  category_id: string | null;
  created_by: string | null;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  low_stock_threshold: number | null;
  location: string | null;
  expiry_date: string | null;
  notes: string | null;
  is_low_stock: boolean;
  created_at: string;
  updated_at: string;
}

export interface InventoryList {
  items: InventoryItem[];
  total_count: number;
  low_stock_count: number;
}

// ── Purchase ──
export interface PurchaseItem {
  id: string;
  purchase_id: string;
  household_id: string;
  category_id: string | null;
  inventory_item_id: string | null;
  name: string;
  quantity: number;
  unit: string | null;
  unit_price: number | null;
  total_price: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  household_id: string;
  created_by: string | null;
  store_name: string | null;
  purchase_date: string;
  total_amount: number;
  payment_method: string | null;
  receipt_url: string | null;
  receipt_reference: string | null;
  notes: string | null;
  items: PurchaseItem[];
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface PurchaseList {
  purchases: Purchase[];
  total_count: number;
  total_amount: number;
}

// ── Recurring Expense ──
export type Frequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly';

export interface RecurringExpense {
  id: string;
  household_id: string;
  category_id: string | null;
  created_by: string | null;
  title: string;
  description: string | null;
  amount: number;
  frequency: Frequency;
  next_due_date: string;
  payment_method: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpenseList {
  rules: RecurringExpense[];
  total_count: number;
}

export interface GenerateResult {
  generated_count: number;
  skipped_count: number;
  generated_expense_ids: string[];
}

export interface UpcomingExpense {
  recurring_expense_id: string;
  title: string;
  amount: number;
  frequency: string;
  next_due_date: string;
  category_id: string | null;
  payment_method: string | null;
  days_until_due: number;
}

// ── Member Roles ──
export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';

