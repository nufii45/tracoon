import { api } from './client';
import type { HouseholdWithRole, HouseholdDetail, Household } from '@/types';

export const householdsApi = {
  list: () =>
    api.get<HouseholdWithRole[]>('/households').then((r) => r.data),

  get: (id: string) =>
    api.get<HouseholdDetail>(`/households/${id}`).then((r) => r.data),

  create: (data: { name: string; description?: string }) =>
    api.post<Household>('/households', data).then((r) => r.data),

  update: (id: string, data: { name?: string; description?: string }) =>
    api.patch<Household>(`/households/${id}`, data).then((r) => r.data),

  addMember: (householdId: string, data: { email?: string; user_id?: string; role?: string }) =>
    api.post(`/households/${householdId}/members`, data).then((r) => r.data),

  updateMemberRole: (householdId: string, memberId: string, data: { role: string }) =>
    api.patch(`/households/${householdId}/members/${memberId}`, data).then((r) => r.data),

  removeMember: (householdId: string, memberId: string) =>
    api.delete(`/households/${householdId}/members/${memberId}`),
};
