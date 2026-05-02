import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const ACCESS_TOKEN_KEY = 'traccoon_access_token';
const REFRESH_TOKEN_KEY = 'traccoon_refresh_token';

interface TokenStorage {
  getItem: (key: string) => string | null | Promise<string | null>;
  setItem: (key: string, value: string) => void | Promise<void>;
  deleteItem: (key: string) => void | Promise<void>;
}

// Web fallback using localStorage (SecureStore is native-only)
const webStorage: TokenStorage = {
  getItem: (key: string) => localStorage.getItem(key),
  setItem: (key: string, value: string) => localStorage.setItem(key, value),
  deleteItem: (key: string) => localStorage.removeItem(key),
};

// Native adapter — map SecureStore's async API to the common interface
const nativeStorage: TokenStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  deleteItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const store: TokenStorage = Platform.OS === 'web' ? webStorage : nativeStorage;

export async function getAccessToken(): Promise<string | null> {
  return await store.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export async function getRefreshToken(): Promise<string | null> {
  return await store.getItem(REFRESH_TOKEN_KEY) ?? null;
}

export async function saveTokens(accessToken: string, refreshToken: string) {
  await store.setItem(ACCESS_TOKEN_KEY, accessToken);
  await store.setItem(REFRESH_TOKEN_KEY, refreshToken);
}

export async function clearTokens() {
  await store.deleteItem(ACCESS_TOKEN_KEY);
  await store.deleteItem(REFRESH_TOKEN_KEY);
}

