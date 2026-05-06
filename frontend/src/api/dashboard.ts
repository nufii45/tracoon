
import { api } from './client';
import type { DashboardSummary } from '@/types';

const dashboardApi = {
  async get(householdId: string): Promise<DashboardSummary> {
    if (!householdId) {
      throw new Error('householdId is required');
    }

    const response = await api.get<DashboardSummary>(
      `/households/${householdId}/dashboard`
    );

    return response.data;
  },
};

export default dashboardApi;