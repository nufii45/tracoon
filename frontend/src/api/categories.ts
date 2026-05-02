import { api } from './client';
import type { Category, CategoryType } from '@/types';

export const categoriesApi = {
  list: (householdId: string, categoryType?: CategoryType) => {
    const params = categoryType ? { category_type: categoryType } : {};
    return api
      .get<Category[]>(`/households/${householdId}/categories`, { params })
      .then((r) => r.data);
  },

  get: (householdId: string, categoryId: string) =>
    api.get<Category>(`/households/${householdId}/categories/${categoryId}`).then((r) => r.data),

  create: (householdId: string, data: {
    name: string;
    category_type: CategoryType;
    color?: string;
    icon?: string;
  }) =>
    api.post<Category>(`/households/${householdId}/categories`, data).then((r) => r.data),

  update: (householdId: string, categoryId: string, data: {
    name?: string;
    color?: string;
    icon?: string;
  }) =>
    api.patch<Category>(`/households/${householdId}/categories/${categoryId}`, data).then((r) => r.data),

  delete: (householdId: string, categoryId: string) =>
    api.delete(`/households/${householdId}/categories/${categoryId}`),
};
