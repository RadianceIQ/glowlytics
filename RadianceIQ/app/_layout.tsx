import 'react-native-get-random-values';
import React, { useEffect, useRef, useState } from 'react';
import { Stack, Redirect } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ClerkProvider, ClerkLoaded, useAuth } from '@clerk/clerk-expo';
import Animated, {
  Easing,
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withSequence,
  withRepeat,
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
const EXPO_OUT = Easing.out(Easing.exp);

function SplashScreen() {
  // Phase 1: Logo materializes
  const logoScale = useSharedValue(0.55);
  const logoOpacity = useSharedValue(0);

  // Phase 2: Three concentric glow rings bloom outward like a scan pulse
  const ring1Scale = useSharedValue(0.3);
  const ring1Opacity = useSharedValue(0);
  const ring2Scale = useSharedValue(0.3);
  const ring2Opacity = useSharedValue(0);
  const ring3Scale = useSharedValue(0.3);
  const ring3Opacity = useSharedValue(0);

  // Phase 3: Scan line sweeps through the logo
  const scanY = useSharedValue(-90);
  const scanOpacity = useSharedValue(0);

  // Phase 4: Wordmark reveals
  const nameOpacity = useSharedValue(0);
  const nameY = useSharedValue(22);

  useEffect(() => {
    // ── Phase 1: Logo (0–700ms) ──
    logoOpacity.value = withTiming(1, { duration: 600, easing: EXPO_OUT });
    logoScale.value = withTiming(1, { duration: 800, easing: EXPO_OUT });

    // ── Phase 2: Glow rings bloom (staggered 150ms apart) ──
    // Inner ring — brightest, tightest
    ring1Scale.value = withDelay(150, withTiming(1, { duration: 900, easing: EXPO_OUT }));
    ring1Opacity.value = withDelay(150, withSequence(
      withTiming(0.30, { duration: 400, easing: EXPO_OUT }),
      withTiming(0.10, { duration: 700 }),
      // Settle into a gentle breathe
      withRepeat(withSequence(
        withTiming(0.14, { duration: 2000 }),
        withTiming(0.08, { duration: 2000 }),
      ), -1, true),
    ));

    // Mid ring
    ring2Scale.value = withDelay(300, withTiming(1, { duration: 900, easing: EXPO_OUT }));
    ring2Opacity.value = withDelay(300, withSequence(
      withTiming(0.20, { duration: 400, easing: EXPO_OUT }),
      withTiming(0.06, { duration: 700 }),
      withRepeat(withSequence(
        withTiming(0.09, { duration: 2200 }),
        withTiming(0.04, { duration: 2200 }),
      ), -1, true),
    ));

    // Outer ring — softest, widest
    ring3Scale.value = withDelay(450, withTiming(1, { duration: 900, easing: EXPO_OUT }));
    ring3Opacity.value = withDelay(450, withSequence(
      withTiming(0.14, { duration: 400, easing: EXPO_OUT }),
      withTiming(0.03, { duration: 700 }),
      withRepeat(withSequence(
        withTiming(0.06, { duration: 2400 }),
        withTiming(0.02, { duration: 2400 }),
      ), -1, true),
    ));

    // ── Phase 3: Scan line (400–950ms) ──
    scanOpacity.value = withDelay(400, withSequence(
      withTiming(0.7, { duration: 80 }),
      withTiming(0.5, { duration: 400 }),
      withTiming(0, { duration: 70 }),
    ));
    scanY.value = withDelay(400, withTiming(90, {
      duration: 550,
      easing: Easing.inOut(Easing.cubic),
    }));

    // ── Phase 4: Wordmark (800ms) ──
    nameOpacity.value = withDelay(800, withTiming(1, { duration: 500, easing: EXPO_OUT }));
    nameY.value = withDelay(800, withTiming(0, { duration: 600, easing: EXPO_OUT }));
  }, []);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const ring1Style = useAnimatedStyle(() => ({
    opacity: ring1Opacity.value,
    transform: [{ scale: ring1Scale.value }],
  }));

  const ring2Style = useAnimatedStyle(() => ({
    opacity: ring2Opacity.value,
    transform: [{ scale: ring2Scale.value }],
  }));

  const ring3Style = useAnimatedStyle(() => ({
    opacity: ring3Opacity.value,
    transform: [{ scale: ring3Scale.value }],
  }));

  const scanStyle = useAnimatedStyle(() => ({
    opacity: scanOpacity.value,
    transform: [{ translateY: scanY.value }],
  }));

  const nameStyle = useAnimatedStyle(() => ({
    opacity: nameOpacity.value,
    transform: [{ translateY: nameY.value }],
  }));

  return (
    <View style={splash.container}>
      <StatusBar style="dark" />

      {/* Glow rings — outermost first for z-order */}
      <Animated.View style={[splash.ring, splash.ring3, ring3Style]} />
      <Animated.View style={[splash.ring, splash.ring2, ring2Style]} />
      <Animated.View style={[splash.ring, splash.ring1, ring1Style]} />

      {/* Logo + scan line container */}
      <View style={splash.logoArea}>
        <Animated.View style={[splash.scanLine, scanStyle]} />
        <Animated.View style={logoStyle}>
          <Image
            source={require('../assets/logo-emblem.png')}
            style={splash.logo}
            resizeMode="contain"
          />
        </Animated.View>
      </View>

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
  logoArea: {
    width: 180,
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  logo: {
    width: 170,
    height: 170,
  },
  ring: {
    position: 'absolute',
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  ring1: {
    width: 220,
    height: 220,
  },
  ring2: {
    width: 320,
    height: 320,
  },
  ring3: {
    width: 440,
    height: 440,
  },
  scanLine: {
    position: 'absolute',
    width: 160,
    height: 2,
    backgroundColor: Colors.primary,
    borderRadius: 1,
    zIndex: 10,
  },
  name: {
    marginTop: 28,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
    color: Colors.text,
    letterSpacing: 2,
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
