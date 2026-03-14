import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  FadeIn,
  Easing,
} from 'react-native-reanimated';
import { Feather } from '@expo/vector-icons';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { CameraFaceMesh } from '../../src/components/CameraFaceMesh';
import { DirectionIndicators } from '../../src/components/DirectionIndicators';
import { useFaceTracking } from '../../src/hooks/useFaceTracking';
import { getDirections } from '../../src/services/faceTracking';
import { checkPhotoQuality } from '../../src/services/photoQuality';
import { getCameraPermissionStatus } from '../../src/services/permissionState';
import { analyzeWithFallback } from '../../src/services/skinAnalysis';
import { generateDefaultIndices } from '../../src/services/mockScanner';
import { useStore } from '../../src/store/useStore';

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get('window');

type Phase = 'intro' | 'camera' | 'processing' | 'complete';

export default function BaselineScan() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const protocol = useStore((s) => s.protocol);
  const user = useStore((s) => s.user);
  const modelOutputs = useStore((s) => s.modelOutputs);
  const addDailyRecord = useStore((s) => s.addDailyRecord);
  const addModelOutput = useStore((s) => s.addModelOutput);
  const cameraPermissionStatus = useStore((s) => s.user?.camera_permission_status);
  const updateUser = useStore((s) => s.updateUser);
  const cameraRef = useRef<CameraView>(null);

  const [phase, setPhase] = useState<Phase>('intro');
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState('Analyzing your baseline...');

  const { trackingState } = useFaceTracking(cameraRef, phase === 'camera' && cameraReady && !capturing);
  const directions = getDirections(trackingState.issues);

  // Completion animation
  const checkScale = useSharedValue(0);
  const checkOpacity = useSharedValue(0);
  const glowScale = useSharedValue(0.5);

  useEffect(() => {
    if (!permission) return;
    const nextStatus = getCameraPermissionStatus(permission);
    if (cameraPermissionStatus === nextStatus) return;
    updateUser({ camera_permission_status: nextStatus });
  }, [permission?.status, permission?.granted, permission?.canAskAgain, cameraPermissionStatus, updateUser]);

  const handleCapture = async () => {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) {
        setCapturing(false);
        return;
      }

      // Quality check
      const quality = await checkPhotoQuality(photo.uri, SCREEN_W, SCREEN_H);
      if (!quality.overallPass && quality.issues.length > 0) {
        setCapturing(false);
        return;
      }

      // Move to processing phase
      setPhase('processing');

      // Generate scanner indices
      const scannerData = generateDefaultIndices();

      // Run analysis
      const analysis = await analyzeWithFallback({
        scannerData,
        photoUri: photo.uri,
        userProfile: user!,
        protocol: protocol!,
        previousOutputs: modelOutputs,
        dailyContext: {
          sunscreen_used: false,
          new_product_added: false,
        },
        skipDelay: true,
      });

      setProcessingMessage('Saving your baseline...');

      // Save baseline record
      const record = addDailyRecord({
        date: new Date().toISOString().split('T')[0],
        scanner_reading_id: `baseline_${Date.now()}`,
        scanner_indices: scannerData,
        scanner_quality_flag: 'pass',
        scan_region: protocol?.scan_region || 'left_cheek',
        photo_uri: photo.uri,
        sunscreen_used: false,
        new_product_added: false,
      });

      // Generate baseline model output
      addModelOutput({
        daily_id: record.daily_id,
        acne_score: analysis.acne_score,
        sun_damage_score: analysis.sun_damage_score,
        skin_age_score: analysis.skin_age_score,
        confidence: analysis.confidence,
        primary_driver: 'baseline',
        recommended_action: 'Your baseline is set! Scan daily at the same time for the best trend accuracy.',
        escalation_flag: false,
        conditions: analysis.conditions,
        rag_recommendations: analysis.rag_recommendations,
        personalized_feedback: analysis.personalized_feedback,
      });

      // Transition to complete
      setPhase('complete');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      // Animate checkmark
      checkScale.value = withDelay(200, withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) }));
      checkOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      glowScale.value = withDelay(200, withTiming(1.2, { duration: 600, easing: Easing.out(Easing.cubic) }));
    } catch {
      setCapturing(false);
      setPhase('camera');
    }
  };

  const checkAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
  }));

  if (phase === 'intro') {
    return (
      <View style={styles.container}>
        <OnboardingHero
          total={7}
          current={5}
          eyebrow="Step 6 · Baseline"
          title="Take your first scan."
          subtitle="This establishes your personal baseline. All future scores are measured against it."
        />

        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>What happens next</Text>
          <Text style={styles.infoItem}>1. Camera captures your baseline photo</Text>
          <Text style={styles.infoItem}>2. AI analyzes your skin condition</Text>
          <Text style={styles.infoItem}>3. Your baseline scores are generated</Text>
        </View>

        <View style={styles.footer}>
          {!permission?.granted ? (
            <Button title="Enable Camera & Start" onPress={async () => {
              await requestPermission();
              setPhase('camera');
            }} />
          ) : (
            <Button title="Start Baseline Scan" onPress={() => setPhase('camera')} />
          )}
        </View>
      </View>
    );
  }

  if (!permission?.granted) {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Text style={styles.title}>Camera Access Needed</Text>
          <Text style={styles.subtitle}>
            We need camera access to capture your baseline scan photo.
          </Text>
          <Button title="Grant Camera Access" onPress={requestPermission} />
        </View>
      </View>
    );
  }

  if (phase === 'processing') {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <Animated.View entering={FadeIn.duration(400)}>
            <Text style={styles.title}>Processing</Text>
            <Text style={styles.processingText}>{processingMessage}</Text>
          </Animated.View>
        </View>
      </View>
    );
  }

  if (phase === 'complete') {
    return (
      <View style={styles.container}>
        <View style={styles.centeredContent}>
          <View style={styles.completeContainer}>
            <Animated.View style={[styles.glowCircle, glowAnimStyle]} />
            <Animated.View style={[styles.checkCircle, checkAnimStyle]}>
              <Feather name="check" size={48} color={Colors.primary} />
            </Animated.View>
          </View>
          <Text style={styles.title}>Baseline captured!</Text>
          <Text style={styles.subtitle}>
            Your personal baseline is set. Future scans will track changes from here.
          </Text>
          <Button
            title="Continue"
            onPress={() => router.push('/onboarding/boost')}
          />
        </View>
      </View>
    );
  }

  // Camera phase
  return (
    <View style={styles.cameraContainer}>
      <CameraView
        ref={cameraRef}
        style={StyleSheet.absoluteFill}
        facing="front"
        onCameraReady={() => setCameraReady(true)}
      />

      <CameraFaceMesh
        status={trackingState.status}
        width={SCREEN_W}
        height={SCREEN_H}
      />

      {trackingState.status === 'misaligned' && (
        <DirectionIndicators directions={directions} />
      )}

      {/* Region reminder */}
      <View style={styles.cameraTopBar}>
        {protocol?.scan_region && (
          <View style={styles.regionPill}>
            <Text style={styles.regionText}>
              {protocol.scan_region.replace(/_/g, ' ').toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      {/* Status */}
      <View style={styles.statusContainer}>
        <Text style={styles.statusText}>
          {trackingState.status === 'no_face'
            ? 'Position your face in the frame'
            : trackingState.status === 'misaligned'
              ? trackingState.issues[0] || 'Adjust position'
              : 'Ready  - tap to capture'}
        </Text>
      </View>

      {/* Capture button */}
      <View style={styles.cameraControls}>
        <View style={[
          styles.captureButton,
          {
            borderColor: trackingState.status === 'aligned' ? Colors.primary : Colors.textMuted,
          },
        ]}>
          {trackingState.status === 'aligned' && !capturing && (
            <View
              style={styles.captureInner}
              onTouchEnd={handleCapture}
            />
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingTop: 56,
  },
  centeredContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  infoCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  infoTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansBold,
    marginBottom: Spacing.xs,
  },
  infoItem: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.sansBold,
    color: Colors.text,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  processingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    textAlign: 'center',
    marginTop: Spacing.sm,
  },
  completeContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  glowCircle: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: Colors.primary + '40',
    backgroundColor: Colors.primary + '08',
  },
  checkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceOverlay,
  },
  cameraContainer: {
    flex: 1,
  },
  cameraTopBar: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
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
  cameraControls: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
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
});
