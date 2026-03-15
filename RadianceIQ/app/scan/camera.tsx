import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, BorderRadius, Spacing } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { CameraFaceMesh } from '../../src/components/CameraFaceMesh';
import { DirectionIndicators } from '../../src/components/DirectionIndicators';
import { useFaceTracking } from '../../src/hooks/useFaceTracking';
import { getDirections } from '../../src/services/faceTracking';
import { checkPhotoQuality } from '../../src/services/photoQuality';
import { useStore } from '../../src/store/useStore';
import { presentPaywall, checkSubscriptionStatus } from '../../src/services/subscription';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

export default function CameraScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const protocol = useStore((s) => s.protocol);
  const canPerformScan = useStore((s) => s.canPerformScan);

  // Defense-in-depth: present paywall if scan not allowed
  useEffect(() => {
    if (!canPerformScan()) {
      (async () => {
        const purchased = await presentPaywall();
        if (purchased) {
          const sub = await checkSubscriptionStatus(useStore.getState().subscription);
          useStore.getState().setSubscription(sub);
        }
        if (!useStore.getState().canPerformScan()) {
          router.back();
        }
      })();
    }
  }, []);
  const cameraRef = useRef<CameraView>(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [qualityFailed, setQualityFailed] = useState(false);
  const [qualityIssues, setQualityIssues] = useState<string[]>([]);
  const [autoCountdown, setAutoCountdown] = useState(0);
  const autoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const alignedStartRef = useRef<number | null>(null);

  const { trackingState } = useFaceTracking(cameraRef, cameraReady && !capturing);
  const directions = getDirections(trackingState.issues);

  // Animations
  const flashOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  const ringColor = useSharedValue(0); // 0 = muted, 1 = primary
  const countdownProgress = useSharedValue(0);

  // Auto-capture: track continuous alignment
  useEffect(() => {
    if (trackingState.status === 'aligned' && trackingState.lightingOk && !capturing) {
      if (!alignedStartRef.current) {
        alignedStartRef.current = Date.now();
      }
      const elapsed = Date.now() - alignedStartRef.current;
      if (elapsed >= 2000) {
        handleCapture();
      } else {
        // Update countdown
        setAutoCountdown(Math.ceil((2000 - elapsed) / 1000));
        countdownProgress.value = withTiming(elapsed / 2000, { duration: 200 });
      }
    } else {
      alignedStartRef.current = null;
      setAutoCountdown(0);
      countdownProgress.value = withTiming(0, { duration: 200 });
    }
  }, [trackingState]);

  // Button animation based on alignment
  useEffect(() => {
    if (trackingState.status === 'aligned') {
      ringColor.value = withTiming(1, { duration: 400 });
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 400 }),
          withTiming(0.95, { duration: 400 }),
        ),
        -1,
      );
    } else {
      ringColor.value = withTiming(0, { duration: 300 });
      buttonScale.value = withTiming(1, { duration: 200 });
    }
  }, [trackingState.status]);

  const buttonAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const handleCapture = useCallback(async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    setQualityFailed(false);

    // Haptic + flash
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    flashOpacity.value = withSequence(
      withTiming(0.3, { duration: 100 }),
      withTiming(0, { duration: 200 }),
    );

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setCapturing(false);
        return;
      }

      // Quality check
      const quality = await checkPhotoQuality(photo.uri, SCREEN_W, SCREEN_H);
      if (quality.overallPass || quality.issues.length === 0) {
        // Navigate to processing with photo
        router.push({
          pathname: '/scan/processing',
          params: { photoUri: photo.uri },
        });
      } else {
        setQualityFailed(true);
        setQualityIssues(quality.issues);
        setCapturing(false);
      }
    } catch {
      setCapturing(false);
    }
  }, [capturing, router]);

  // Permission not yet granted
  if (!permission?.granted) {
    return (
      <View style={styles.permissionContainer}>
        <View style={styles.permissionContent}>
          <Feather name="camera" size={48} color={Colors.primary} />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionText}>
            Glowlytics needs camera access to analyze your skin.
          </Text>
          <Button title="Enable Camera" onPress={requestPermission} />
          <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
            <Text style={styles.backLinkText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />

      {/* Face mesh overlay */}
      <CameraFaceMesh
        status={trackingState.status}
        width={SCREEN_W}
        height={SCREEN_H}
      />

      {/* Direction indicators */}
      {trackingState.status === 'misaligned' && (
        <DirectionIndicators directions={directions} />
      )}

      {/* Flash overlay */}
      <Animated.View style={[styles.flashOverlay, flashStyle]} pointerEvents="none" />

      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Feather name="chevron-left" size={28} color={Colors.text} />
        </TouchableOpacity>

        {/* Region pill */}
        {protocol?.scan_region && (
          <View style={styles.regionPill}>
            <Text style={styles.regionText}>
              {protocol.scan_region.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        )}

        {/* Lighting indicator */}
        <View style={[
          styles.lightingPill,
          {
            backgroundColor: trackingState.lightingUnavailable
              ? 'rgba(134, 199, 255, 0.2)'
              : trackingState.lightingOk
                ? 'rgba(95, 211, 172, 0.2)'
                : 'rgba(242, 181, 106, 0.2)',
          },
        ]}>
          <View style={[
            styles.lightingDot,
            {
              backgroundColor: trackingState.lightingUnavailable
                ? Colors.info
                : trackingState.lightingOk
                  ? Colors.success
                  : Colors.warning,
            },
          ]} />
          <Text style={[
            styles.lightingText,
            {
              color: trackingState.lightingUnavailable
                ? Colors.info
                : trackingState.lightingOk
                  ? Colors.success
                  : Colors.warning,
            },
          ]}>
            {trackingState.lightingUnavailable
              ? 'Light N/A'
              : trackingState.lightingOk
                ? 'Good light'
                : 'Low light'}
          </Text>
        </View>
      </View>

      {/* Status text */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {trackingState.status === 'no_face'
            ? 'Position your face in the frame'
            : !trackingState.lightingOk && !trackingState.lightingUnavailable
              ? 'Find better lighting — face a window or lamp'
              : trackingState.status === 'misaligned'
                ? trackingState.issues[0] || 'Adjust position'
                : autoCountdown > 0
                  ? `Hold steady...`
                  : 'Ready to capture'}
        </Text>
      </View>

      {/* Bottom controls */}
      <View style={styles.bottomControls}>
        {qualityFailed ? (
          <View style={styles.retakeContainer}>
            <Text style={styles.retakeTitle}>Photo quality issue</Text>
            {qualityIssues.map((issue, i) => (
              <Text key={i} style={styles.retakeIssue}>{issue}</Text>
            ))}
            <Button
              title="Retake"
              onPress={() => {
                setQualityFailed(false);
                setCapturing(false);
              }}
            />
          </View>
        ) : (
          <TouchableOpacity
            onPress={handleCapture}
            disabled={trackingState.status !== 'aligned' || capturing}
            activeOpacity={0.8}
          >
            <Animated.View style={buttonAnimStyle}>
              <View style={[
                styles.captureRing,
                {
                  borderColor: trackingState.status === 'aligned'
                    ? Colors.primary
                    : Colors.textMuted,
                },
              ]}>
                {trackingState.status === 'aligned' && (
                  <View style={styles.captureInner} />
                )}
              </View>
            </Animated.View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flashOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'white',
  },
  topBar: {
    position: 'absolute',
    top: 56,
    left: Spacing.md,
    right: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  regionPill: {
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: BorderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: Spacing.md,
  },
  regionText: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
  },
  lightingPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: BorderRadius.full,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  lightingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  lightingText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
  },
  statusContainer: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusText: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: 8,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  bottomControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureRing: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
  },
  retakeContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    gap: Spacing.sm,
    alignItems: 'center',
    marginHorizontal: Spacing.xl,
  },
  retakeTitle: {
    color: Colors.warning,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  retakeIssue: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
  },
  permissionContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  permissionContent: {
    alignItems: 'center',
    gap: Spacing.lg,
  },
  permissionTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  permissionText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    textAlign: 'center',
    lineHeight: 24,
  },
  backLink: {
    marginTop: Spacing.md,
  },
  backLinkText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
});
