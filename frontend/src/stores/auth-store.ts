import { create } from 'zustand';
import type { User } from '@/types';
import { authApi } from '@/api/auth';
import { saveTokens, clearTokens, getRefreshToken } from '@/lib/secure-store';
import { queryClient } from '@/lib/query-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, fullName?: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: User) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: false,
  isInitialized: false,

  initialize: async () => {
    set({ isLoading: true });
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return;

      const user = await authApi.getMe();
      set({ user, isAuthenticated: true });
    } catch {
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isInitialized: true, isLoading: false });
    }
  },

  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const tokens = await authApi.login({ email, password });
      await saveTokens(tokens.access_token, tokens.refresh_token);
      const user = await authApi.getMe();
      set({ user, isAuthenticated: true });
    } catch (error) {
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  register: async (email, password, fullName) => {
    set({ isLoading: true });
    try {
      await authApi.register({ email, password, full_name: fullName });
      await get().login(email, password);
    } catch (error) {
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (refreshToken) {
        await authApi.logout(refreshToken).catch(() => {});
      }
    } finally {
      await clearTokens();
      queryClient.clear();
      set({ user: null, isAuthenticated: false });
    }
  },

  setUser: (user) => set({ user }),
}));