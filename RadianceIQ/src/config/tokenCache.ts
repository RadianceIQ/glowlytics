import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import type { TokenCache } from '@clerk/clerk-expo';

const createTokenCache = (): TokenCache => {
  return {
    getToken: async (key: string) => {
      try {
        if (Platform.OS === 'web') return null;
        return await SecureStore.getItemAsync(key);
      } catch {
        return null;
      }
    },
    saveToken: async (key: string, token: string) => {
      try {
        if (Platform.OS === 'web') return;
        await SecureStore.setItemAsync(key, token);
      } catch {
        // silently fail on save errors
      }
    },
    clearToken: (key: string) => {
      try {
        if (Platform.OS === 'web') return;
        SecureStore.deleteItemAsync(key);
      } catch {
        // silently fail on clear errors
      }
    },
  };
};

export const tokenCache = createTokenCache();
