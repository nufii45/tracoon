import { api } from './client';
import type { User, TokenPair, RegisterResponse } from '@/types';

export const authApi = {
  register: (data: { email: string; password: string; full_name?: string }) =>
    api.post<RegisterResponse>('/auth/register', data).then((r) => r.data),

  login: (data: { email: string; password: string }) =>
    api.post<TokenPair>('/auth/login', data).then((r) => r.data),

  refresh: (refreshToken: string) =>
    api.post<TokenPair>('/auth/refresh', { refresh_token: refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refresh_token: refreshToken }),

  getMe: () =>
    api.get<User>('/auth/me').then((r) => r.data),
};
