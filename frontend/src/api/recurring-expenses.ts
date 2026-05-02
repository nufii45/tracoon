import { api } from './client';
import type {
  RecurringExpense,
  RecurringExpenseList,
  GenerateResult,
  UpcomingExpense,
} from '@/types';

export interface RecurringExpenseFilters {
  is_active?: boolean;
  limit?: number;
  offset?: number;
}

export const recurringExpensesApi = {
  list: (householdId: string, filters?: RecurringExpenseFilters) =>
    api
      .get<RecurringExpenseList>(`/households/${householdId}/recurring-expenses`, {
        params: filters,
      })
      .then((r) => r.data),

  get: (householdId: string, ruleId: string) =>
    api
      .get<RecurringExpense>(`/households/${householdId}/recurring-expenses/${ruleId}`)
      .then((r) => r.data),

  create: (
    householdId: string,
    data: {
      title: string;
      amount: number;
      frequency: string;
      next_due_date: string;
      category_id?: string;
      description?: string;
      payment_method?: string;
      notes?: string;
    },
  ) =>
    api
      .post<RecurringExpense>(`/households/${householdId}/recurring-expenses`, data)
      .then((r) => r.data),

  update: (householdId: string, ruleId: string, data: Record<string, unknown>) =>
    api
      .patch<RecurringExpense>(
        `/households/${householdId}/recurring-expenses/${ruleId}`,
        data,
      )
      .then((r) => r.data),

  delete: (householdId: string, ruleId: string) =>
    api.delete(`/households/${householdId}/recurring-expenses/${ruleId}`),

  upcoming: (householdId: string, withinDays?: number) =>
    api
      .get<UpcomingExpense[]>(`/households/${householdId}/recurring-expenses/upcoming`, {
        params: withinDays ? { within_days: withinDays } : undefined,
      })
      .then((r) => r.data),

  generate: (householdId: string, asOf?: string) =>
    api
      .post<GenerateResult>(
        `/households/${householdId}/recurring-expenses/generate`,
        undefined,
        { params: asOf ? { as_of: asOf } : undefined },
      )
      .then((r) => r.data),
};
