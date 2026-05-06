import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '@/api/expenses';
import { Alert } from 'react-native';
import type { Expense } from '@/types';

export function useExpenses(householdId: string | undefined, categoryId?: string) {
  const queryClient = useQueryClient();

  // Read
  const query = useQuery({
    queryKey: ['expenses', householdId, categoryId],
    queryFn: () => expensesApi.list(householdId!, categoryId ? { category_id: categoryId } : undefined),
    enabled: !!householdId,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof expensesApi.create>[1]) => expensesApi.create(householdId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create expense'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => expensesApi.update(householdId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update expense'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => expensesApi.delete(householdId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete expense'),
  });

  return {
    ...query,
    createExpense: createMutation.mutate,
    updateExpense: updateMutation.mutate,
    deleteExpense: deleteMutation.mutate,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
