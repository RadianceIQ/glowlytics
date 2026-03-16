import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Colors, FontFamily, FontSize, BorderRadius, Spacing } from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import { generateDefaultIndices } from '../../src/services/mockScanner';
import { imageToBase64 } from '../../src/services/visionAPI';

const STATUS_MESSAGES = [
  'Analyzing skin structure...',
  'Mapping conditions...',
  'Generating insights...',
  'Consulting guidelines...',
];

const CALM_EASING = Easing.out(Easing.cubic);
const MIN_HOLD = 2000; // Minimum display time in ms

export default function ProcessingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ photoUri: string }>();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const setPendingPhotoBase64 = useStore((s) => s.setPendingPhotoBase64);

  const [messageIndex, setMessageIndex] = useState(0);
  const hasStarted = useRef(false);

  // Animations
  const orbScale = useSharedValue(0.8);
  const orbOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0.3);
  const progressWidth = useSharedValue(0);

  useEffect(() => {
    // Orb entrance
    orbScale.value = withTiming(1, { duration: 600, easing: CALM_EASING });
    orbOpacity.value = withTiming(1, { duration: 400, easing: CALM_EASING });

    // Glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 }),
      ),
      -1,
    );

    // Progress bar
    progressWidth.value = withTiming(1, { duration: MIN_HOLD + 2000, easing: CALM_EASING });

    // Cycle status messages
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Prepare photo and navigate to checkin
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;

    const startTime = Date.now();

    (async () => {
      if (!user || !protocol) {
        router.replace('/(tabs)/today');
        return;
      }

      // Generate fallback scanner indices
      const scannerData = generateDefaultIndices();

      // Pre-encode photo for later analysis in checkin
      if (params.photoUri) {
        try {
          const base64 = await imageToBase64(params.photoUri);
          setPendingPhotoBase64(base64);
        } catch {
          // Encoding failed — analysis will re-encode in checkin
        }
      }

      // Ensure minimum hold time
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_HOLD - elapsed);

      setTimeout(() => {
        router.replace({
          pathname: '/scan/checkin',
          params: {
            inflammation: String(scannerData.inflammation_index),
            pigmentation: String(scannerData.pigmentation_index),
            texture: String(scannerData.texture_index),
            photoUri: params.photoUri || '',
          },
        });
      }, remaining);
    })();
  }, []);

  const orbAnimStyle = useAnimatedStyle(() => ({
    opacity: orbOpacity.value,
    transform: [{ scale: orbScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progressWidth.value * 100}%` as any,
  }));

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[Colors.backgroundDeep, '#6B8799', '#081522']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      {/* Background glow */}
      <Animated.View style={[styles.bgGlow, glowAnimStyle]}>
        <LinearGradient
          colors={[Colors.glowPrimary, 'transparent']}
          start={{ x: 0.5, y: 0.3 }}
          end={{ x: 0.5, y: 0.8 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <View style={styles.content}>
        {/* Logo */}
        <Animated.View style={orbAnimStyle}>
          <Image
            source={require('../../assets/icon.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Status message */}
        <View style={styles.messageContainer}>
          <Animated.Text
            key={messageIndex}
            entering={FadeIn.duration(400)}
            exiting={FadeOut.duration(400)}
            style={styles.statusMessage}
          >
            {STATUS_MESSAGES[messageIndex]}
          </Animated.Text>
        </View>

        <Text style={styles.subtitle}>
          This may take a moment
        </Text>
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <View style={styles.progressTrack}>
          <Animated.View style={[styles.progressFill, progressStyle]}>
            <LinearGradient
              colors={[Colors.primaryDark, Colors.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  bgGlow: {
    position: 'absolute',
    top: '20%',
    left: -50,
    right: -50,
    height: 300,
    borderRadius: BorderRadius.full,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  logoImage: {
    width: 100,
    height: 100,
    borderRadius: 24,
  },
  messageContainer: {
    height: 30,
    justifyContent: 'center',
  },
  statusMessage: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
  },
  progressContainer: {
    position: 'absolute',
    bottom: 60,
    left: Spacing.xl,
    right: Spacing.xl,
  },
  progressTrack: {
    height: 3,
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
    overflow: 'hidden',
  },
});
