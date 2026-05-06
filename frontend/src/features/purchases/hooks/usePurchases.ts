import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { purchasesApi } from '@/api/purchases';
import { Alert } from 'react-native';

export function usePurchases(householdId: string | undefined) {
  const queryClient = useQueryClient();

  // Read
  const query = useQuery({
    queryKey: ['purchases', householdId],
    queryFn: () => purchasesApi.list(householdId!),
    enabled: !!householdId,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof purchasesApi.create>[1]) => purchasesApi.create(householdId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create purchase'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => purchasesApi.update(householdId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update purchase'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => purchasesApi.delete(householdId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete purchase'),
  });

  return {
    ...query,
    createPurchase: createMutation.mutate,
    updatePurchase: updateMutation.mutate,
    deletePurchase: deleteMutation.mutate,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
