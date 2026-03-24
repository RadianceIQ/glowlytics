import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
} from 'react-native-reanimated';
import { tokenCache } from '../src/config/tokenCache';
import { env } from '../src/config/env';
import { BorderRadius, Colors, FontFamily, FontSize } from '../src/constants/theme';
import { CALM_EASING } from '../src/utils/animations';
import { useStore } from '../src/store/useStore';
import { setAuthTokenProvider } from '../src/services/api';
import { initRevenueCat, identifyUser, checkSubscriptionStatus, setupCustomerInfoListener } from '../src/services/subscription';
import { initAnalytics, identifyUser as identifyAnalyticsUser, trackEvent } from '../src/services/analytics';
// Lazy import — onnxruntime-react-native crashes in Expo Go
const initLesionDetection = () =>
  import('../src/services/onDeviceLesionDetection').then((m) => m.initLesionDetection());

const SPLASH_MIN_MS = 1500;

// ─── Splash Screen ───────────────────────────────────────────────
function SplashScreen() {
  const logoScale = useSharedValue(0.88);
  const logoOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.5);
  const glowOpacity = useSharedValue(0);
  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(10);

  useEffect(() => {
    // Logo: scale + fade in
    logoOpacity.value = withTiming(1, { duration: 500, easing: CALM_EASING });
    logoScale.value = withTiming(1, { duration: 600, easing: CALM_EASING });

    // Glow bloom behind logo (150ms delay)
    glowScale.value = withDelay(150, withTiming(1.4, { duration: 900, easing: CALM_EASING }));
    glowOpacity.value = withDelay(150, withSequence(
      withTiming(0.55, { duration: 600, easing: CALM_EASING }),
      withTiming(0.18, { duration: 600 }),
    ));

    // Wordmark fade + rise (650ms delay)
    nameOpacity.value = withDelay(650, withTiming(1, { duration: 400, easing: CALM_EASING }));
    nameY.value = withDelay(650, withTiming(0, { duration: 400, easing: CALM_EASING }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));

  return (
    <View style={splash.container}>
      <StatusBar style="dark" />
      <Animated.View style={[splash.glow, glowStyle]} />
      <Animated.View style={logoStyle}>
        <Image
          source={require('../assets/splash-icon.png')}
          style={splash.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <Animated.Text style={[splash.name, nameStyle]}>Glowlytics</Animated.Text>
    </View>
  );
}

const splash = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: BorderRadius.full,
    backgroundColor: 'rgba(58, 158, 143, 0.10)',
  },
  logo: {
    width: 140,
    height: 140,
  },
  name: {
    marginTop: 20,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
    color: Colors.text,
    letterSpacing: 0.5,
  },
});

// ─── Auth Redirector ─────────────────────────────────────────────
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
    const { onboardingFlow, onboardingFlowIndex } = useStore.getState();
    const resumeScreen = (onboardingFlowIndex > 0 && onboardingFlow.length > 0)
      ? onboardingFlow[onboardingFlowIndex] || 'welcome'
      : 'welcome';
    if (__DEV__) console.log(`[AuthRedirector] Onboarding incomplete → ${resumeScreen}`);
    return <Redirect href={`/onboarding/${resumeScreen}`} />;
  }

  if (__DEV__) console.log('[AuthRedirector] All good → tabs');
  return <Redirect href="/(tabs)/today" />;
}

// ─── Clerk-Gated App ─────────────────────────────────────────────
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

      // App init: hydrate store first, then analytics + RevenueCat
      const initApp = async () => {
        // Hydrate persisted data before anything that reads store state
        await loadPersistedData();

        try {
          console.log('[App] Initializing analytics...');
          await initAnalytics();
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

        console.log('[App] Init complete — rendering app');
        identifyAnalyticsUser(userId || 'anonymous');
        trackEvent('app_init_complete', {
          has_revenuecat_key: !!env.REVENUECAT_API_KEY,
          has_posthog_key: !!env.POSTHOG_API_KEY,
          has_api_url: !!env.API_BASE_URL,
        });

        // Pre-download lesion detection model in background
        initLesionDetection().catch(() => {});
      };

      // Wait for BOTH init and minimum splash display time
      Promise.all([
        initApp(),
        new Promise<void>((r) => setTimeout(r, SPLASH_MIN_MS)),
      ]).then(() => {
        setAppReady(true);
      }).catch((err) => {
        console.error('[App] Init failed:', err);
        setAppReady(true);
      });
    }

    return () => {
      listenerCleanup.current();
    };
  }, []);

  // Show animated splash while initializing
  if (!appReady) {
    return <SplashScreen />;
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

// ─── Root Layout ─────────────────────────────────────────────────
export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'Switzer-Regular': require('../assets/fonts/Switzer-Regular.ttf'),
    'Switzer-Medium': require('../assets/fonts/Switzer-Medium.ttf'),
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
