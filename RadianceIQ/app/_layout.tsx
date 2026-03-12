import 'react-native-get-random-values';
import React, { useEffect, useRef } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import { tokenCache } from '../src/config/tokenCache';
import { env } from '../src/config/env';
import { Colors } from '../src/constants/theme';
import { useStore } from '../src/store/useStore';
import { setAuthTokenProvider } from '../src/services/api';

/**
 * Auth gate that only returns Redirect components — never its own navigator.
 * Rendered as a child of the single Stack in ClerkGatedApp.
 */
function AuthRedirector() {
  const { isSignedIn, isLoaded } = useAuth();
  const onboardingComplete = useStore((s) => s.user?.onboarding_complete ?? false);

  if (!isLoaded) {
    // Clerk still loading — stay on index (splash screen)
    return null;
  }

  if (!isSignedIn) {
    return <Redirect href="/auth/sign-in" />;
  }

  if (!onboardingComplete) {
    return <Redirect href="/onboarding/essentials" />;
  }

  // Signed in + onboarding complete → redirect to tabs
  return <Redirect href="/(tabs)/today" />;
}

function AppContent() {
  const loadPersistedData = useStore((s) => s.loadPersistedData);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      setTimeout(() => loadPersistedData(), 0);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
          <Stack.Screen name="product" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="signal" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
        </Stack>
      </View>
    </SafeAreaProvider>
  );
}

function ClerkGatedApp() {
  const { getToken } = useAuth();
  const loadPersistedData = useStore((s) => s.loadPersistedData);
  const loaded = useRef(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      setAuthTokenProvider(() => getToken());
      setTimeout(() => loadPersistedData(), 0);
    }
  }, []);

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: Colors.background },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" options={{ animation: 'fade' }} />
          <Stack.Screen name="auth" options={{ animation: 'fade' }} />
          <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
          <Stack.Screen name="onboarding" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="product" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="signal" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
        </Stack>
        <AuthRedirector />
      </View>
    </SafeAreaProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Switzer-Regular': require('../assets/fonts/Switzer-Regular.ttf'),
    'Switzer-Bold': require('../assets/fonts/Switzer-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  // If Clerk key is configured, wrap with ClerkProvider for auth
  if (env.CLERK_PUBLISHABLE_KEY) {
    return (
      <ClerkProvider
        publishableKey={env.CLERK_PUBLISHABLE_KEY}
        tokenCache={tokenCache}
      >
        <ClerkLoaded>
          <ClerkGatedApp />
        </ClerkLoaded>
      </ClerkProvider>
    );
  }

  // Fallback: run without Clerk if key not set (demo mode)
  return <AppContent />;
}
