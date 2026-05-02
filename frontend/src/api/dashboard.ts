import { api } from './client';
import type { DashboardSummary } from '@/types';

export const dashboardApi = {
  get: (householdId: string) =>
    api.get<DashboardSummary>(`/households/${householdId}/dashboard`).then((r) => r.data),
};
