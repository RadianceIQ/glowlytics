import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
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
import { initRevenueCat, identifyUser, checkSubscriptionStatus, setupCustomerInfoListener } from '../src/services/subscription';
import { initAnalytics, identifyUser as identifyAnalyticsUser, trackEvent } from '../src/services/analytics';
// Lazy import — onnxruntime-react-native crashes in Expo Go
const initLesionDetection = () =>
  import('../src/services/onDeviceLesionDetection').then((m) => m.initLesionDetection());

/**
 * Auth gate that only returns Redirect components — never its own navigator.
 * Rendered as a child of the single Stack in ClerkGatedApp.
 */
function AuthRedirector() {
  const { isSignedIn, isLoaded } = useAuth();
  const onboardingComplete = useStore((s) => s.user?.onboarding_complete ?? false);

  if (!isLoaded) {
    if (__DEV__) console.log('[AuthRedirector] Clerk not loaded yet');
    return null;
  }

  if (!isSignedIn) {
    if (__DEV__) console.log('[AuthRedirector] Not signed in → sign-in');
    return <Redirect href="/auth/sign-in" />;
  }

  if (!onboardingComplete) {
    if (__DEV__) console.log('[AuthRedirector] Onboarding incomplete → welcome');
    return <Redirect href="/onboarding/welcome" />;
  }

  if (__DEV__) console.log('[AuthRedirector] All good → tabs');
  return <Redirect href="/(tabs)/today" />;
}

function ClerkGatedApp() {
  const { getToken, userId } = useAuth();
  const loadPersistedData = useStore((s) => s.loadPersistedData);
  const setSubscription = useStore((s) => s.setSubscription);
  const subscription = useStore((s) => s.subscription);
  const loaded = useRef(false);
  const listenerCleanup = useRef<() => void>(() => {});
  const [appReady, setAppReady] = useState(false);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      setAuthTokenProvider(() => getToken());

      // Initialize store + analytics + RevenueCat — gate app on completion
      (async () => {
        // Hydrate persisted data FIRST so AuthRedirector sees onboarding_complete
        try {
          console.log('[App] Loading persisted data...');
          await loadPersistedData();
          console.log('[App] Persisted data loaded');
        } catch (e: any) {
          console.warn('[App] Failed to load persisted data:', e?.message || e);
        }

        try {
          console.log('[App] Initializing analytics...');
          await initAnalytics();
          if (userId) identifyAnalyticsUser(userId);
          try {
            console.log('[App] Initializing RevenueCat...');
            await initRevenueCat();
            listenerCleanup.current = setupCustomerInfoListener();
            if (userId) await identifyUser(userId);
            const currentSub = useStore.getState().subscription;
            const sub = await checkSubscriptionStatus(currentSub);
            setSubscription(sub);
            console.log('[App] RevenueCat ready');
          } catch (e: any) {
            console.warn('[App] RevenueCat init failed:', e?.message || e);
          }
        } catch (e: any) {
          console.warn('[App] Analytics init failed:', e?.message || e);
        }

        // App is ready — always fires even if init steps above fail
        console.log('[App] Init complete — rendering app');
        identifyAnalyticsUser(userId || 'anonymous');
        trackEvent('app_init_complete', {
          has_revenuecat_key: !!env.REVENUECAT_API_KEY,
          has_posthog_key: !!env.POSTHOG_API_KEY,
          has_api_url: !!env.API_BASE_URL,
        });
        setAppReady(true);

        // Pre-download lesion detection model in background (lazy — skips in Expo Go)
        initLesionDetection().catch(() => {});
      })().catch((e) => {
        // Last resort — ensure app renders even if everything above fails
        console.error('[App] Critical init error:', e);
        setAppReady(true);
      });
    }

    return () => {
      listenerCleanup.current();
    };
  }, []);

  // Gate on init completion — prevents paywall race condition
  if (!appReady) {
    return <View style={{ flex: 1, backgroundColor: Colors.background }} />;
  }

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: Colors.background }}>
        <StatusBar style="dark" />
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
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
          <Stack.Screen name="scan" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="product" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="signal" options={{ animation: 'slide_from_bottom' }} />
          <Stack.Screen name="privacy-policy" options={{ animation: 'slide_from_right' }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
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
