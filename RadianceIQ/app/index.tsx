import React, { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
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
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../src/constants/theme';

const CALM_EASING = Easing.out(Easing.cubic);

export default function Index() {
  const orbScale = useSharedValue(0.3);
  const orbOpacity = useSharedValue(0);
  const glowOpacity = useSharedValue(0.2);
  const brandOpacity = useSharedValue(0);
  const brandTranslateY = useSharedValue(16);
  const safetyOpacity = useSharedValue(0);

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

    // Safety card
    safetyOpacity.value = withDelay(900, withTiming(1, { duration: 500, easing: CALM_EASING }));
  }, []);

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

  const safetyAnimStyle = useAnimatedStyle(() => ({
    opacity: safetyOpacity.value,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundDeep, '#081522']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[Colors.glowSecondary, 'transparent']}
        start={{ x: 0.05, y: 0.05 }}
        end={{ x: 0.8, y: 0.8 }}
        style={styles.topGlow}
      />
      <Animated.View style={[styles.midGlow, glowAnimStyle]}>
        <LinearGradient
          colors={[Colors.glowPrimary, 'transparent']}
          start={{ x: 0.2, y: 0 }}
          end={{ x: 0.8, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.content}>
        <Animated.View style={orbAnimStyle}>
          <Image
            source={require('../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        <Animated.Text style={[styles.brand, brandAnimStyle]}>Glowlytics</Animated.Text>

        <Animated.View style={[styles.safetyCard, safetyAnimStyle]}>
          <Text style={styles.safetyEyebrow}>Safety framing</Text>
          <Text style={styles.safetyText}>
            Glowlytics measures skin metrics and trends over time. It does not diagnose conditions.
          </Text>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 320,
    height: 280,
    borderRadius: BorderRadius.full,
    opacity: 0.75,
  },
  midGlow: {
    position: 'absolute',
    top: 180,
    right: -120,
    width: 300,
    height: 260,
    borderRadius: BorderRadius.full,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 28,
  },
  brand: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
    letterSpacing: 0.5,
  },
  safetyCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
    maxWidth: 340,
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
});
