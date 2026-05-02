import { api } from './client';
import type { Budget } from '@/types';

export const budgetsApi = {
  list: (householdId: string) =>
    api.get<Budget[]>(`/households/${householdId}/budgets`).then((r) => r.data),

  get: (householdId: string, budgetId: string) =>
    api.get<Budget>(`/households/${householdId}/budgets/${budgetId}`).then((r) => r.data),

  create: (householdId: string, data: {
    name: string;
    amount: number;
    period_start: string;
    period_end: string;
    category_id?: string;
    description?: string;
  }) =>
    api.post<Budget>(`/households/${householdId}/budgets`, data).then((r) => r.data),

  update: (householdId: string, budgetId: string, data: Record<string, unknown>) =>
    api.patch<Budget>(`/households/${householdId}/budgets/${budgetId}`, data).then((r) => r.data),

  delete: (householdId: string, budgetId: string) =>
    api.delete(`/households/${householdId}/budgets/${budgetId}`),
};
