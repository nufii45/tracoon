import { api } from './client';
import type { InventoryItem, InventoryList } from '@/types';

export interface InventoryFilters {
  category_id?: string;
  low_stock_only?: boolean;
  search?: string;
  location?: string;
  limit?: number;
  offset?: number;
}

export const inventoryApi = {
  list: (householdId: string, filters?: InventoryFilters) =>
    api
      .get<InventoryList>(`/households/${householdId}/inventory`, { params: filters })
      .then((r) => r.data),

  get: (householdId: string, itemId: string) =>
    api.get<InventoryItem>(`/households/${householdId}/inventory/${itemId}`).then((r) => r.data),

  create: (householdId: string, data: {
    name: string;
    quantity?: number;
    unit?: string;
    description?: string;
    low_stock_threshold?: number;
    location?: string;
    expiry_date?: string;
    notes?: string;
    category_id?: string;
  }) =>
    api.post<InventoryItem>(`/households/${householdId}/inventory`, data).then((r) => r.data),

  update: (householdId: string, itemId: string, data: Record<string, unknown>) =>
    api.patch<InventoryItem>(`/households/${householdId}/inventory/${itemId}`, data).then((r) => r.data),

  delete: (householdId: string, itemId: string) =>
    api.delete(`/households/${householdId}/inventory/${itemId}`),
};
