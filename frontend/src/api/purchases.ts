import { api } from './client';
import type { Purchase, PurchaseItem, PurchaseList } from '@/types';

export interface PurchaseFilters {
  store_name?: string;
  payment_method?: string;
  category_id?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
  offset?: number;
}

export const purchasesApi = {
  list: (householdId: string, filters?: PurchaseFilters) =>
    api
      .get<PurchaseList>(`/households/${householdId}/purchases`, { params: filters })
      .then((r) => r.data),

  get: (householdId: string, purchaseId: string) =>
    api.get<Purchase>(`/households/${householdId}/purchases/${purchaseId}`).then((r) => r.data),

  create: (householdId: string, data: {
    store_name?: string;
    purchase_date: string;
    total_amount: number;
    payment_method?: string;
    receipt_url?: string;
    receipt_reference?: string;
    notes?: string;
    items?: Array<{
      name: string;
      quantity?: number;
      unit?: string;
      unit_price?: number;
      total_price: number;
      category_id?: string;
      inventory_item_id?: string;
      notes?: string;
    }>;
  }) =>
    api.post<Purchase>(`/households/${householdId}/purchases`, data).then((r) => r.data),

  update: (householdId: string, purchaseId: string, data: Record<string, unknown>) =>
    api.patch<Purchase>(`/households/${householdId}/purchases/${purchaseId}`, data).then((r) => r.data),

  delete: (householdId: string, purchaseId: string) =>
    api.delete(`/households/${householdId}/purchases/${purchaseId}`),

  // --- Item endpoints ---
  addItem: (householdId: string, purchaseId: string, data: {
    name: string;
    total_price: number;
    quantity?: number;
    unit?: string;
    unit_price?: number;
    category_id?: string;
    inventory_item_id?: string;
    notes?: string;
  }) =>
    api.post<PurchaseItem>(
      `/households/${householdId}/purchases/${purchaseId}/items`,
      data
    ).then((r) => r.data),

  updateItem: (householdId: string, purchaseId: string, itemId: string, data: Record<string, unknown>) =>
    api.patch<PurchaseItem>(
      `/households/${householdId}/purchases/${purchaseId}/items/${itemId}`,
      data
    ).then((r) => r.data),

  deleteItem: (householdId: string, purchaseId: string, itemId: string) =>
    api.delete(`/households/${householdId}/purchases/${purchaseId}/items/${itemId}`),
};
