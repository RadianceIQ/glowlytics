import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { AtmosphereScreen } from '../src/components/AtmosphereScreen';
import { Button } from '../src/components/Button';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../src/constants/theme';
import { useStore } from '../src/store/useStore';
import { env } from '../src/config/env';

const CALM_EASING = Easing.out(Easing.cubic);

export default function Index() {
  const router = useRouter();
  const onboardingComplete = useStore((s) => s.user?.onboarding_complete ?? false);
  const navigated = useRef(false);
  const hasClerk = Boolean(env.CLERK_PUBLISHABLE_KEY);

  // Animations
  const orbScale = useSharedValue(0.3);
  const orbOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.2);
  const brandOpacity = useSharedValue(0);
  const brandTranslateY = useSharedValue(16);
  const taglineOpacity = useSharedValue(0);
  const taglineTranslateY = useSharedValue(16);
  const safetyOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);

  useEffect(() => {
    // Orb entrance
    orbScale.value = withTiming(1, { duration: 800, easing: CALM_EASING });
    orbOpacity.value = withTiming(1, { duration: 600, easing: CALM_EASING });

    // Glow pulse
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2000 }),
        withTiming(0.2, { duration: 2000 }),
      ),
      -1,
    );

    // Brand text
    brandOpacity.value = withDelay(500, withTiming(1, { duration: 500, easing: CALM_EASING }));
    brandTranslateY.value = withDelay(500, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Tagline
    taglineOpacity.value = withDelay(700, withTiming(1, { duration: 500, easing: CALM_EASING }));
    taglineTranslateY.value = withDelay(700, withTiming(0, { duration: 500, easing: CALM_EASING }));

    // Safety card
    safetyOpacity.value = withDelay(900, withTiming(1, { duration: 500, easing: CALM_EASING }));

    // Buttons (demo mode only)
    if (!hasClerk) {
      buttonsOpacity.value = withDelay(1100, withTiming(1, { duration: 500, easing: CALM_EASING }));
    }
  }, []);

  useEffect(() => {
    if (onboardingComplete && !navigated.current && !hasClerk) {
      navigated.current = true;
      router.replace('/(tabs)/today');
    }
  }, [onboardingComplete]);

  const orbAnimStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const brandAnimStyle = useAnimatedStyle(() => ({
    opacity: brandOpacity.value,
    transform: [{ translateY: brandTranslateY.value }],
  }));

  const taglineAnimStyle = useAnimatedStyle(() => ({
    opacity: taglineOpacity.value,
    transform: [{ translateY: taglineTranslateY.value }],
  }));

  const safetyAnimStyle = useAnimatedStyle(() => ({
    opacity: safetyOpacity.value,
  }));

  const buttonsAnimStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
  }));

  // When Clerk is active, show minimal splash (orb + brand) while loading
  if (hasClerk) {
    return (
      <View style={[styles.content, styles.clerkSplash]}>
        <Animated.View style={orbAnimStyle}>
          <LinearGradient
            colors={[Colors.glowSecondary, Colors.glowPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orbShell}
          >
            <View style={styles.orbRing}>
              <View style={styles.orbInner}>
                <Text style={styles.orbLetter}>R</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>
        <Animated.Text style={[styles.brand, brandAnimStyle]}>RadianceIQ</Animated.Text>
      </View>
    );
  }

  return (
    <AtmosphereScreen scroll={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.headerBrand}>RadianceIQ</Text>
        <Animated.View style={[styles.headerDot, glowAnimStyle]} />
      </View>

      <View style={styles.hero}>
        <Animated.View style={orbAnimStyle}>
          <LinearGradient
            colors={[Colors.glowSecondary, Colors.glowPrimary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.orbShell}
          >
            <View style={styles.orbRing}>
              <View style={styles.orbInner}>
                <Text style={styles.orbLetter}>R</Text>
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <Animated.View style={brandAnimStyle}>
          <Text style={styles.kicker}>Premium skin trend tracking</Text>
          <Text style={styles.title}>
            Your skin,{'\n'}
            <Text style={styles.titleAccent}>measured.</Text>
          </Text>
        </Animated.View>

        <Animated.Text style={[styles.subtitle, taglineAnimStyle]}>
          Guided scans, contextual insights, and a calmer daily rhythm built for demo-ready clarity.
        </Animated.Text>

        <Animated.View style={[styles.safetyCard, safetyAnimStyle]}>
          <Text style={styles.safetyEyebrow}>Safety framing</Text>
          <Text style={styles.safetyText}>
            RadianceIQ measures skin metrics and trends over time. It does not diagnose conditions.
          </Text>
        </Animated.View>
      </View>

      <Animated.View style={[styles.footer, buttonsAnimStyle]}>
        <Button
          title="Start your baseline"
          onPress={() => router.push('/onboarding/essentials')}
          size="lg"
        />
        <Button
          title="Load demo data"
          onPress={() => router.push('/onboarding/demo-setup')}
          variant="secondary"
        />
        <Text style={styles.footerNote}>
          Demo mode seeds 21 days of history.
        </Text>
      </Animated.View>
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
  },
  clerkSplash: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBrand: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  brand: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
    letterSpacing: 0.5,
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  hero: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  orbShell: {
    width: 148,
    height: 148,
    borderRadius: BorderRadius.full,
    padding: 1,
    alignSelf: 'center',
  },
  orbRing: {
    flex: 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 16, 26, 0.82)',
  },
  orbInner: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: 'rgba(199,255,250,0.18)',
  },
  orbLetter: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.hero,
    lineHeight: 44,
  },
  kicker: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.display,
    lineHeight: 52,
  },
  titleAccent: {
    color: Colors.primaryLight,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
    maxWidth: '88%',
  },
  safetyCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  safetyEyebrow: {
    color: Colors.warning,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  safetyText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  footer: {
    gap: Spacing.md,
  },
  footerNote: {
    color: Colors.textDim,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
});
