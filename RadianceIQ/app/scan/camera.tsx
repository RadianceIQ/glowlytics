import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, FontFamily, FontSize, BorderRadius, Spacing } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { CameraFaceMesh } from '../../src/components/CameraFaceMesh';
import { DirectionIndicators } from '../../src/components/DirectionIndicators';
import { LesionOverlay } from '../../src/components/LesionOverlay';
import { useFaceTracking } from '../../src/hooks/useFaceTracking';
import { getDirections } from '../../src/services/faceTracking';
import { checkPhotoQuality } from '../../src/services/photoQuality';
import { useStore } from '../../src/store/useStore';
import { presentPaywall, checkSubscriptionStatus } from '../../src/services/subscription';
import { trackEvent } from '../../src/services/analytics';
import { env } from '../../src/config/env';
import {
  initLesionDetection,
  detectLesions,
  releaseLesionDetection,
  isReady as isLesionModelReady,
} from '../../src/services/onDeviceLesionDetection';
import type { DetectedLesion } from '../../src/types';

export default function CameraScreen() {
  const { width: SCREEN_W, height: SCREEN_H } = useWindowDimensions();
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const protocol = useStore((s) => s.protocol);
  const canPerformScan = useStore((s) => s.canPerformScan);

  // Defense-in-depth: present paywall if scan not allowed
  useEffect(() => {
    trackEvent('scan_started', { subscription_tier: useStore.getState().subscription.tier });
    if (!canPerformScan()) {
      (async () => {
        setPaywallVisible(true);
        try {
          const purchased = await presentPaywall();
          if (purchased) {
            const sub = await checkSubscriptionStatus(useStore.getState().subscription);
            useStore.getState().setSubscription(sub);
          }
        } catch {
          // RevenueCat config error — non-fatal
        }
        setPaywallVisible(false);
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
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [detectedLesions, setDetectedLesions] = useState<DetectedLesion[]>([]);
  const detectingRef = useRef(false);
  const detectionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastFrameUriRef = useRef<string | null>(null);
  const alignedStartRef = useRef<number | null>(null);

  const { trackingState, lastFrameUri } = useFaceTracking(cameraRef, cameraReady && !capturing && !paywallVisible);

  // Keep ref in sync so detection loop reads latest URI without causing effect re-runs
  useEffect(() => { lastFrameUriRef.current = lastFrameUri; }, [lastFrameUri]);
  const directions = getDirections(trackingState.issues);

  // Animations
  const flashOpacity = useSharedValue(0);
  const buttonScale = useSharedValue(1);
  // ringColor removed — was assigned but never read in any animated style

  // Auto-capture: track continuous alignment
  useEffect(() => {
    if (trackingState.status === 'aligned' && trackingState.lightingOk && !capturing) {
      if (!alignedStartRef.current) {
        alignedStartRef.current = Date.now();
      }
      const elapsed = Date.now() - alignedStartRef.current;
      if (elapsed >= 2000) {
        handleCaptureRef.current();
      } else {
        // Update countdown
        setAutoCountdown(Math.ceil((2000 - elapsed) / 1000));
      }
    } else {
      alignedStartRef.current = null;
      setAutoCountdown(0);
    }
  }, [trackingState]);

  // Model is pre-downloaded at app startup (_layout.tsx).
  // Just ensure session is loaded when camera mounts (no-op if already cached).
  useEffect(() => {
    initLesionDetection().catch(() => {});
    return () => releaseLesionDetection();
  }, []);

  // Lesion detection when face is aligned — on-device first, server fallback
  useEffect(() => {
    if (trackingState.status !== 'aligned' || capturing) {
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
      if (detectedLesions.length > 0) setDetectedLesions([]);
      return;
    }

    const detectOnDevice = async (base64: string): Promise<DetectedLesion[]> => {
      if (!isLesionModelReady()) return [];
      return detectLesions(base64);
    };

    const detectViaServer = async (base64: string): Promise<DetectedLesion[]> => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      try {
        const res = await fetch(`${env.API_BASE_URL}/api/vision/detect-lesions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image_base64: base64 }),
          signal: controller.signal,
        });
        if (res.ok) {
          const data = await res.json();
          return data.lesions || [];
        }
      } catch {
        // Server unreachable — non-fatal
      } finally {
        clearTimeout(timeout);
      }
      return [];
    };

    const detect = async () => {
      const uri = lastFrameUriRef.current;
      if (detectingRef.current || !uri) return;
      detectingRef.current = true;

      try {
        const base64 = await FileSystemLegacy.readAsStringAsync(uri, {
          encoding: FileSystemLegacy.EncodingType.Base64,
        });

        // Try on-device first, fall back to server
        let lesions = await detectOnDevice(base64);
        const source = lesions.length > 0 ? 'on_device' : 'none';

        if (lesions.length === 0) {
          lesions = await detectViaServer(base64);
        }

        setDetectedLesions(lesions);

        if (lesions.length > 0) {
          trackEvent('realtime_lesions_detected', {
            count: lesions.length,
            source: source === 'on_device' ? 'on_device' : 'server',
          });
        }
      } catch {
        // Detection failed — non-fatal
      } finally {
        detectingRef.current = false;
      }
    };

    // Run immediately, then every 1.2s
    detect();
    detectionTimerRef.current = setInterval(detect, 1200);

    return () => {
      if (detectionTimerRef.current) {
        clearInterval(detectionTimerRef.current);
        detectionTimerRef.current = null;
      }
    };
  }, [trackingState.status, capturing]);

  // Button animation based on alignment
  useEffect(() => {
    if (trackingState.status === 'aligned') {
      buttonScale.value = withRepeat(
        withSequence(
          withTiming(1.0, { duration: 400 }),
          withTiming(0.95, { duration: 400 }),
        ),
        -1,
      );
    } else {
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

      // Quality check — use photo's native dimensions, not screen dimensions
      const quality = await checkPhotoQuality(photo.uri, photo.width, photo.height);
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

  const handleCaptureRef = useRef(handleCapture);
  useEffect(() => { handleCaptureRef.current = handleCapture; }, [handleCapture]);

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

      {/* Real-time lesion bounding boxes */}
      {detectedLesions.length > 0 && (
        <LesionOverlay
          lesions={detectedLesions}
          width={SCREEN_W}
          height={SCREEN_H}
          mirrored
        />
      )}

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
                alignedStartRef.current = null;
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
