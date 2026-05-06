import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryApi } from '@/api/inventory';
import { Alert } from 'react-native';

export function useInventory(householdId: string | undefined, categoryId?: string, isLowStock?: boolean) {
  const queryClient = useQueryClient();

  // Read
  const query = useQuery({
    queryKey: ['inventory', householdId, categoryId, isLowStock],
    queryFn: () => inventoryApi.list(householdId!, {
      category_id: categoryId || undefined,
      low_stock_only: isLowStock ? true : undefined,
    }),
    enabled: !!householdId,
  });

  // Create
  const createMutation = useMutation({
    mutationFn: (data: Parameters<typeof inventoryApi.create>[1]) => inventoryApi.create(householdId!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create inventory item'),
  });

  // Update
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) => inventoryApi.update(householdId!, id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update inventory item'),
  });

  // Delete
  const deleteMutation = useMutation({
    mutationFn: (id: string) => inventoryApi.delete(householdId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete inventory item'),
  });

  return {
    ...query,
    createInventoryItem: createMutation.mutate,
    updateInventoryItem: updateMutation.mutate,
    deleteInventoryItem: deleteMutation.mutate,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
