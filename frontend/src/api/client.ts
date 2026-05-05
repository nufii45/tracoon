import axios, { InternalAxiosRequestConfig } from 'axios';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getAccessToken, getRefreshToken, saveTokens, clearTokens } from '@/lib/secure-store';

declare module 'axios' {
  interface InternalAxiosRequestConfig {
    _retry?: boolean;
  }
}

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

const PORT = '8000';

function resolveBaseUrl(): string {
  const configUrl = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  if (configUrl) return configUrl;

  switch (Platform.OS) {
    case 'web':
      return `http://localhost:${PORT}`;

    case 'android': {
      const isEmulator = Constants.expoConfig?.extra?.isEmulator as boolean ?? false;
      if (isEmulator) return `http://10.0.2.2:${PORT}`;
      // fall through to use Expo's hostUri
    }

    case 'ios':
    default: {
      const debuggerHost = Constants.expoConfig?.hostUri?.split(':')[0];
      if (debuggerHost) return `http://${debuggerHost}:${PORT}`;
      throw new Error('Could not resolve API base URL. Set apiUrl in app.json extra.');
    }
  }
}

export const BASE_URL = resolveBaseUrl();

// ---------------------------------------------------------------------------
// Axios instance
// ---------------------------------------------------------------------------

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10_000,
});

// ---------------------------------------------------------------------------
// Request interceptor — attach access token
// ---------------------------------------------------------------------------

api.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error),
);

// ---------------------------------------------------------------------------
// Response interceptor — silent token refresh on 401
// ---------------------------------------------------------------------------

type QueueEntry = {
  resolve: (token: string) => void;
  reject: (error: unknown) => void;
};

let isRefreshing = false;
let failedQueue: QueueEntry[] = [];

function drainQueue(error: unknown, token: string | null): void {
  failedQueue.forEach(({ resolve, reject }) =>
    error ? reject(error) : resolve(token!),
  );
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original: InternalAxiosRequestConfig = error.config;

    if (error.response?.status !== 401 || original._retry) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`;
        return api(original);
      });
    }

    original._retry = true;
    isRefreshing = true;

    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) throw new Error('No refresh token available');

      const { data } = await axios.post<{
        access_token: string;
        refresh_token: string;
      }>(`${BASE_URL}/auth/refresh`, { refresh_token: refreshToken });

      await saveTokens(data.access_token, data.refresh_token);
      drainQueue(null, data.access_token);

      original.headers.Authorization = `Bearer ${data.access_token}`;
      return api(original);
    } catch (refreshError) {
      drainQueue(refreshError, null);
      await clearTokens();
      return Promise.reject(refreshError);
    } finally {
      isRefreshing = false;
    }
  },
);