import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { budgetsApi } from '@/api/budgets';
import { Alert } from 'react-native';

export function useBudgets(householdId: string | undefined) {
  const queryClient = useQueryClient();

  // Read
  const query = useQuery({
    queryKey: ['budgets', householdId],
    queryFn: () => budgetsApi.list(householdId!),
    enabled: !!householdId,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof budgetsApi.create>[1]) => budgetsApi.create(householdId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create budget'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => budgetsApi.update(householdId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update budget'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => budgetsApi.delete(householdId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete budget'),
  });

  return {
    ...query,
    createBudget: createMutation.mutate,
    updateBudget: updateMutation.mutate,
    deleteBudget: deleteMutation.mutate,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
