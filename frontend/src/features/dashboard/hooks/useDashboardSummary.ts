import { useQuery } from '@tanstack/react-query';
import dashboardApi from '@/api/dashboard';
import type { DashboardSummary } from '@/types';

export function useDashboardSummary(householdId: string | undefined) {
  return useQuery<DashboardSummary>({
    queryKey: ['dashboard', householdId],
    queryFn: () => dashboardApi.get(householdId!),
    enabled: !!householdId,
  });
}
