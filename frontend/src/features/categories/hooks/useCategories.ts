import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriesApi } from '@/api/categories';
import { Alert } from 'react-native';
import type { CategoryType } from '@/types';

export function useCategories(householdId: string | undefined, type?: CategoryType | '') {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: type ? ['categories', householdId, type] : ['all-categories', householdId],
    queryFn: () => categoriesApi.list(householdId!, type || undefined),
    enabled: !!householdId,
  });

  const createMutation = useMutation({
    mutationFn: (d: { name: string; category_type: CategoryType; color?: string; icon?: string }) => categoriesApi.create(householdId!, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to create category'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, d }: { id: string; d: { name?: string; color?: string; icon?: string } }) => categoriesApi.update(householdId!, id, d),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to update category'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => categoriesApi.delete(householdId!, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-categories'] });
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
    onError: (e: any) => Alert.alert('Error', e?.response?.data?.detail || 'Failed to delete category'),
  });

  return {
    ...query,
    createCategory: createMutation.mutate,
    updateCategory: updateMutation.mutate,
    deleteCategory: deleteMutation.mutate,
    isPending: createMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
  };
}
