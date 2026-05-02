import { api } from './client';
import type { Expense, ExpenseList } from '@/types';

export interface ExpenseFilters {
  category_id?: string;
  created_by?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const expensesApi = {
  list: (householdId: string, filters?: ExpenseFilters) =>
    api
      .get<ExpenseList>(`/households/${householdId}/expenses`, { params: filters })
      .then((r) => r.data),

  get: (householdId: string, expenseId: string) =>
    api.get<Expense>(`/households/${householdId}/expenses/${expenseId}`).then((r) => r.data),

  create: (householdId: string, data: {
    title: string;
    amount: number;
    expense_date: string;
    category_id?: string;
    description?: string;
    payment_method?: string;
    notes?: string;
    is_recurring?: boolean;
  }) =>
    api.post<Expense>(`/households/${householdId}/expenses`, data).then((r) => r.data),

  update: (householdId: string, expenseId: string, data: Record<string, unknown>) =>
    api.patch<Expense>(`/households/${householdId}/expenses/${expenseId}`, data).then((r) => r.data),

  delete: (householdId: string, expenseId: string) =>
    api.delete(`/households/${householdId}/expenses/${expenseId}`),
};
