import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedProps,
  withTiming,
  withRepeat,
  withSequence,
  withDelay,
  Easing,
  FadeIn,
  FadeOut,
} from 'react-native-reanimated';
import { Colors, FontFamily, FontSize, BorderRadius, Spacing } from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import { analyzeWithFallback } from '../../src/services/skinAnalysis';
import { getEstimatedCycleDay } from '../../src/utils/cycleDay';
import { trackEvent } from '../../src/services/analytics';

// ---------------------------------------------------------------------------
// Animated SVG circle for Reanimated
// ---------------------------------------------------------------------------
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// ---------------------------------------------------------------------------
// Stage durations (internal timer track -- unchanged from original)
// ---------------------------------------------------------------------------
interface Stage {
  duration: number; // ms, 0 = holds until API done
}

const STAGES: Stage[] = [
  { duration: 600 },
  { duration: 700 },
  { duration: 700 },
  { duration: 700 },
  { duration: 700 },
  { duration: 700 },
  { duration: 0 },   // API hold stage
  { duration: 800 },
  { duration: 600 },
];

// Calm rotating messages mapped to stage ranges
const CALM_MESSAGES = [
  'Analyzing your skin...',
  'Mapping conditions...',
  'Generating insights...',
  'Almost ready...',
];

const calmMessageForStage = (stage: number): string => {
  if (stage <= 1) return CALM_MESSAGES[0];
  if (stage <= 4) return CALM_MESSAGES[1];
  if (stage <= 6) return CALM_MESSAGES[2];
  return CALM_MESSAGES[3];
};

const CALM_EASING = Easing.out(Easing.cubic);
const API_STAGE = 6;

// ---------------------------------------------------------------------------
// Progress ring constants
// ---------------------------------------------------------------------------
const RING_RADIUS = 60;
const RING_STROKE = 3;
const RING_SIZE = (RING_RADIUS + RING_STROKE) * 2;
const CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

// ---------------------------------------------------------------------------
// Particle configuration
// ---------------------------------------------------------------------------
interface ParticleConfig {
  size: number;
  startX: number;
  startY: number;
  driftX: number;
  driftY: number;
  durationX: number;
  durationY: number;
  opacityDuration: number;
  delay: number;
}

const PARTICLES: ParticleConfig[] = [
  { size: 6, startX: -80, startY: -160, driftX: 30, driftY: -20, durationX: 6000, durationY: 5000, opacityDuration: 4000, delay: 0 },
  { size: 4, startX: 90, startY: -100, driftX: -20, driftY: 25, durationX: 7000, durationY: 6000, opacityDuration: 5000, delay: 800 },
  { size: 5, startX: -60, startY: 120, driftX: 25, driftY: -15, durationX: 5500, durationY: 7000, opacityDuration: 4500, delay: 400 },
  { size: 3, startX: 70, startY: 140, driftX: -15, driftY: -25, durationX: 6500, durationY: 5500, opacityDuration: 5500, delay: 1200 },
];

// ---------------------------------------------------------------------------
// Floating particle component
// ---------------------------------------------------------------------------
function FloatingParticle({ config }: { config: ParticleConfig }) {
  const translateX = useSharedValue(config.startX);
  const translateY = useSharedValue(config.startY);
  const opacity = useSharedValue(0);

  useEffect(() => {
    // Fade in after delay, then pulse
    opacity.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(0.35, { duration: config.opacityDuration / 2, easing: CALM_EASING }),
          withTiming(0.1, { duration: config.opacityDuration / 2, easing: CALM_EASING }),
        ),
        -1,
      ),
    );

    // Gentle drift loops
    translateX.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(config.startX + config.driftX, { duration: config.durationX, easing: Easing.inOut(Easing.ease) }),
          withTiming(config.startX, { duration: config.durationX, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );

    translateY.value = withDelay(
      config.delay,
      withRepeat(
        withSequence(
          withTiming(config.startY + config.driftY, { duration: config.durationY, easing: Easing.inOut(Easing.ease) }),
          withTiming(config.startY, { duration: config.durationY, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      ),
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          width: config.size,
          height: config.size,
          borderRadius: config.size / 2,
          backgroundColor: Colors.primary,
        },
        animStyle,
      ]}
    />
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function AnalyzingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inflammation: string;
    pigmentation: string;
    texture: string;
    photoUri: string;
  }>();

  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const addDailyRecord = useStore((s) => s.addDailyRecord);
  const addModelOutput = useStore((s) => s.addModelOutput);
  const clearPendingPhotoBase64 = useStore((s) => s.clearPendingPhotoBase64);

  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [slowWarning, setSlowWarning] = useState(false);
  const [xpFeedback, setXpFeedback] = useState<{ xp: number; badge?: string } | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  const apiDone = useRef(false);
  const apiResult = useRef<any>(null);
  const holdingOnApiStage = useRef(false);
  const postApiStarted = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasStarted = useRef(false);
  const scannerDataRef = useRef({ inflammation_index: 0, pigmentation_index: 0, texture_index: 0 });
  const cycleDayRef = useRef<number | undefined>(undefined);
  const analysisStartTime = useRef(0);

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------
  const logoScale = useSharedValue(0.9);
  const logoOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0.3);
  const ringProgress = useSharedValue(0);

  // Message index derived from stage for cross-fade key
  const [displayedMessage, setDisplayedMessage] = useState(CALM_MESSAGES[0]);

  const progressForStage = (stage: number) => {
    if (stage <= 5) return (stage + 1) / STAGES.length;
    if (stage === 6) return 0.66;
    if (stage === 7) return 0.85;
    return 1;
  };

  const advanceStage = (stage: number) => {
    setCurrentStage(stage);
    setDisplayedMessage(calmMessageForStage(stage));
    const target = progressForStage(stage);
    ringProgress.value = withTiming(target, { duration: 400, easing: CALM_EASING });
  };

  // ---------------------------------------------------------------------------
  // Photo persistence (unchanged)
  // ---------------------------------------------------------------------------
  const persistPhoto = async (tempUri: string): Promise<string | undefined> => {
    try {
      const photosDir = `${FileSystemLegacy.documentDirectory}scan_photos/`;
      await FileSystemLegacy.makeDirectoryAsync(photosDir, { intermediates: true });
      const filename = `scan_${Date.now()}.jpg`;
      const destUri = `${photosDir}${filename}`;
      await FileSystemLegacy.copyAsync({ from: tempUri, to: destUri });
      return destUri;
    } catch {
      return undefined;
    }
  };

  // ---------------------------------------------------------------------------
  // Post-API stage runner (unchanged guard logic)
  // ---------------------------------------------------------------------------
  const runPostApiStages = () => {
    if (postApiStarted.current) return;
    postApiStarted.current = true;

    const t1 = setTimeout(() => {
      advanceStage(7);
      const t2 = setTimeout(() => {
        advanceStage(8);
        const t3 = setTimeout(() => {
          persistAndNavigate();
        }, STAGES[8].duration);
        timers.current.push(t3);
      }, STAGES[7].duration);
      timers.current.push(t2);
    }, 100);
    timers.current.push(t1);
  };

  // ---------------------------------------------------------------------------
  // Persist results + navigate (unchanged)
  // ---------------------------------------------------------------------------
  const persistAndNavigate = async () => {
    const analysis = apiResult.current;
    if (!analysis) {
      router.replace('/scan/results');
      return;
    }

    try {
      const state = useStore.getState();
      const currentProtocol = protocol || state.protocol;

      let savedPhotoUri: string | undefined;
      if (params.photoUri) {
        savedPhotoUri = await persistPhoto(params.photoUri);
      }

      clearPendingPhotoBase64();

      // Use camera-detected lesions as fallback if backend returned none
      const cameraLesions = state.pendingLesions;
      const finalLesions = (analysis.lesions && analysis.lesions.length > 0)
        ? analysis.lesions
        : cameraLesions || undefined;
      // Clear pending lesions after use
      useStore.getState().setPendingLesions(null);

      const xpBefore = state.gamification.xp;
      const badgesBefore = state.gamification.badges.length;

      const dailyRecord = addDailyRecord({
        date: new Date().toISOString().split('T')[0],
        scanner_reading_id: `scan_${Date.now()}`,
        scanner_indices: scannerDataRef.current,
        scanner_quality_flag: 'pass',
        scan_region: currentProtocol?.scan_region || 'whole_face',
        photo_uri: savedPhotoUri,
        photo_quality_flag: 'pass',
        sunscreen_used: false,
        new_product_added: false,
        cycle_day_estimated: cycleDayRef.current,
      });

      addModelOutput({
        daily_id: dailyRecord.daily_id,
        acne_score: analysis.acne_score,
        sun_damage_score: analysis.sun_damage_score,
        skin_age_score: analysis.skin_age_score,
        confidence: analysis.confidence,
        primary_driver: analysis.primary_driver,
        recommended_action: analysis.recommended_action,
        escalation_flag: analysis.escalation_flag,
        conditions: analysis.conditions,
        rag_recommendations: analysis.rag_recommendations,
        personalized_feedback: analysis.personalized_feedback,
        signal_scores: analysis.signal_scores,
        signal_features: analysis.signal_features,
        lesions: finalLesions,
        signal_confidence: analysis.signal_confidence,
        signal_recommendations: analysis.signal_recommendations,
        metric_recommendations: analysis.metric_recommendations,
      });

      const currentState = useStore.getState();
      const xpGained = currentState.gamification.xp - xpBefore;
      const newBadges = currentState.gamification.badges.slice(badgesBefore);
      const latestBadgeName = newBadges.length > 0 ? newBadges[newBadges.length - 1].name : undefined;

      if (xpGained > 0 || latestBadgeName) {
        setXpFeedback({ xp: xpGained, badge: latestBadgeName });
        const t = setTimeout(() => {
          router.replace('/scan/results');
        }, 1500);
        timers.current.push(t);
        return;
      }
    } catch {
      // Persistence failed -- still navigate to results
    }

    router.replace('/scan/results');
  };

  // ---------------------------------------------------------------------------
  // Start animations + cleanup
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // Fade logo in
    logoOpacity.value = withTiming(1, { duration: 600, easing: CALM_EASING });

    // Gentle breathing pulse on logo (continuous)
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );

    // Background glow pulse
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 }),
      ),
      -1,
    );

    return () => {
      timers.current.forEach(clearTimeout);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Bail out if store never hydrates within 5s
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hasStarted.current || user) return;
    const bail = setTimeout(() => {
      if (!hasStarted.current) {
        router.replace('/(tabs)/today');
      }
    }, 5000);
    timers.current.push(bail);
    return () => clearTimeout(bail);
  }, [user]);

  // ---------------------------------------------------------------------------
  // Main effect: timer track + API call (with reliability fix)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (hasStarted.current || !user || !protocol) return;
    hasStarted.current = true;

    // --- Timer track: advance stages 0-5, then hold at 6 ---
    let delay = 0;
    for (let i = 0; i <= 5; i++) {
      const stageIndex = i;
      const t = setTimeout(() => advanceStage(stageIndex), delay);
      timers.current.push(t);
      delay += STAGES[i].duration;
    }

    // Move to stage 6 (hold stage) after stage 5 completes
    const tHold = setTimeout(() => {
      advanceStage(API_STAGE);
      // Drift animation on ring while waiting for API
      ringProgress.value = withRepeat(
        withSequence(
          withTiming(0.72, { duration: 2000, easing: CALM_EASING }),
          withTiming(0.66, { duration: 2000, easing: CALM_EASING }),
        ),
        -1,
      );

      if (apiDone.current) {
        runPostApiStages();
      } else {
        holdingOnApiStage.current = true;
      }
    }, delay);
    timers.current.push(tHold);

    // Slow warning after 15s
    const tSlow = setTimeout(() => {
      if (!apiDone.current) setSlowWarning(true);
    }, 15000);
    timers.current.push(tSlow);

    // Hard timeout at 45s -- show error with retry instead of navigating with no data
    const tHardTimeout = setTimeout(() => {
      if (!apiDone.current) {
        console.error('[Glowlytics] Analysis hard timeout at 45s');
        trackEvent('scan_analysis_timeout', { analysis_time_ms: 45000 });
        apiDone.current = true;
        setError('Analysis is taking too long. Please check your connection and try again.');
      }
    }, 45000);
    timers.current.push(tHardTimeout);

    // --- API track: encode photo + fire analysis ---
    const scannerData = {
      inflammation_index: parseFloat(params.inflammation || '40'),
      pigmentation_index: parseFloat(params.pigmentation || '30'),
      texture_index: parseFloat(params.texture || '35'),
    };
    scannerDataRef.current = scannerData;

    const estimatedCycleDay = getEstimatedCycleDay(user);
    cycleDayRef.current = estimatedCycleDay;

    const { modelOutputs: prevOutputs, pendingPhotoBase64: existingBase64 } = useStore.getState();
    analysisStartTime.current = Date.now();

    // Pre-encode photo if not already done (camera now skips processing screen)
    const encodeAndAnalyze = async () => {
      let base64 = existingBase64;
      if (!base64 && params.photoUri) {
        try {
          const { imageToBase64 } = await import('../../src/services/visionAPI');
          base64 = await imageToBase64(params.photoUri);
          useStore.getState().setPendingPhotoBase64(base64);
        } catch {
          // Encoding failed — analysis will try without pre-encoded base64
        }
      }
      return analyzeWithFallback({
        scannerData,
        photoUri: params.photoUri || undefined,
        userProfile: user,
        protocol,
        previousOutputs: prevOutputs,
        dailyContext: {
          sunscreen_used: false,
          new_product_added: false,
          cycle_day_estimated: estimatedCycleDay,
        },
        preEncodedBase64: base64 || undefined,
        skipDelay: true,
      });
    };

    encodeAndAnalyze()
      .then((result) => {
        apiResult.current = result;
        apiDone.current = true;
        setSlowWarning(false);

        trackEvent('scan_analysis_completed', {
          analysis_time_ms: Date.now() - analysisStartTime.current,
          acne_score: result.acne_score ?? 0,
          sun_damage_score: result.sun_damage_score ?? 0,
          skin_age_score: result.skin_age_score ?? 0,
          has_lesions: Array.isArray(result.lesions) && result.lesions.length > 0,
        });

        // --- Primary path: timer track is already holding at API stage ---
        if (holdingOnApiStage.current) {
          runPostApiStages();
        }

        // --- Safety net: timer track already passed the API stage ---
        // If holdingOnApiStage is false, the timer moved on but the API just
        // finished. Kick post-API stages directly so results are not lost.
        if (!holdingOnApiStage.current) {
          runPostApiStages();
        }

        // --- Failsafe: 3-second backstop ---
        // In case neither code path above triggered postApiStages (e.g. a
        // timing race), force it after 3 seconds.
        const tFailsafe = setTimeout(() => {
          if (!postApiStarted.current) {
            console.warn('[Glowlytics] Failsafe: forcing post-API stages after 3s');
            runPostApiStages();
          }
        }, 3000);
        timers.current.push(tFailsafe);
      })
      .catch((err) => {
        console.error('[Glowlytics] Analysis failed:', err?.message || err, err?.stack);
        trackEvent('scan_analysis_failed', {
          error: String(err?.message || err),
          analysis_time_ms: Date.now() - analysisStartTime.current,
        });
        setError(err?.message || 'Something went wrong. Please try again.');
      });

  }, [user, protocol, retryCount]);

  // ---------------------------------------------------------------------------
  // Animated styles
  // ---------------------------------------------------------------------------
  const logoAnimStyle = useAnimatedStyle(() => ({
    opacity: logoOpacity.value,
    transform: [{ scale: logoScale.value }],
  }));

  const glowAnimStyle = useAnimatedStyle(() => ({
    opacity: glowPulse.value,
  }));

  // Progress ring: strokeDashoffset animated
  const ringAnimatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - ringProgress.value),
  }));

  // ---------------------------------------------------------------------------
  // Retry handler (unchanged logic, updated shared values)
  // ---------------------------------------------------------------------------
  const handleRetry = () => {
    setError(null);
    setSlowWarning(false);
    setCurrentStage(0);
    setDisplayedMessage(CALM_MESSAGES[0]);
    setXpFeedback(null);
    apiDone.current = false;
    apiResult.current = null;
    holdingOnApiStage.current = false;
    postApiStarted.current = false;
    hasStarted.current = false;
    timers.current.forEach(clearTimeout);
    timers.current = [];
    ringProgress.value = 0;
    logoOpacity.value = withTiming(1, { duration: 600, easing: CALM_EASING });
    logoScale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.95, { duration: 1800, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
    );
    glowPulse.value = withRepeat(
      withSequence(
        withTiming(0.7, { duration: 1200 }),
        withTiming(0.3, { duration: 1200 }),
      ),
      -1,
    );
    setRetryCount((c) => c + 1);
  };

  // ---------------------------------------------------------------------------
  // Error screen
  // ---------------------------------------------------------------------------
  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.backgroundDeep, Colors.gradientMid, Colors.gradientEnd]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <Feather name="wifi-off" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Analysis failed</Text>
          <Text style={styles.errorSubtitle}>{error}</Text>
          <View style={styles.errorButtons}>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleRetry}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.goBackButton}
              onPress={() => router.replace('/(tabs)/today')}
            >
              <Text style={styles.goBackText}>Go back</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------
  return (
    <>
      {/* XP feedback overlay */}
      {xpFeedback && (
        <Animated.View
          entering={FadeIn.duration(300)}
          exiting={FadeOut.duration(300)}
          style={styles.xpOverlay}
        >
          <View style={styles.xpOverlayContent}>
            {xpFeedback.xp > 0 && (
              <Text style={styles.xpGainText}>+{xpFeedback.xp} XP</Text>
            )}
            {xpFeedback.badge && (
              <Text style={styles.badgeEarnedText}>Badge earned: {xpFeedback.badge}!</Text>
            )}
          </View>
        </Animated.View>
      )}

      <View style={styles.container}>
        {/* Background gradient — smooth 5-stop to avoid visible banding */}
        <LinearGradient
          colors={['#3D5A6E', '#4A6B80', Colors.gradientMid, '#2A4A5E', Colors.gradientEnd]}
          locations={[0, 0.25, 0.45, 0.7, 1]}
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

        {/* Floating particles */}
        <View style={styles.particlesContainer}>
          {PARTICLES.map((p, i) => (
            <FloatingParticle key={i} config={p} />
          ))}
        </View>

        <View style={styles.content}>
          {/* Progress ring + logo */}
          <View style={styles.ringContainer}>
            <Animated.View style={logoAnimStyle}>
              <Svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
              >
                <Defs>
                  <SvgGradient id="ringGlow" x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor="#7DE7E1" stopOpacity={1} />
                    <Stop offset="1" stopColor="#3A9E8F" stopOpacity={0.8} />
                  </SvgGradient>
                </Defs>
                {/* Background ring */}
                <Circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="rgba(125, 231, 225, 0.12)"
                  strokeWidth={RING_STROKE}
                  fill="none"
                />
                {/* Animated progress ring with gradient glow */}
                <AnimatedCircle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  stroke="url(#ringGlow)"
                  strokeWidth={RING_STROKE + 1}
                  fill="none"
                  strokeDasharray={`${CIRCUMFERENCE}`}
                  strokeLinecap="round"
                  rotation="-90"
                  origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
                  animatedProps={ringAnimatedProps}
                />
              </Svg>
              {/* Logo emblem centered inside ring */}
              <Image
                source={require('../../assets/logo-emblem.png')}
                style={styles.logoEmblem}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* Rotating calm message */}
          <View style={styles.messageContainer}>
            <Animated.Text
              key={displayedMessage}
              entering={FadeIn.duration(500)}
              exiting={FadeOut.duration(500)}
              style={styles.statusMessage}
            >
              {displayedMessage}
            </Animated.Text>
          </View>

          {/* Slow warning */}
          {slowWarning && (
            <Animated.Text
              entering={FadeIn.duration(300)}
              style={styles.slowWarning}
            >
              Taking longer than expected...
            </Animated.Text>
          )}
        </View>
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
  particlesContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xl,
    paddingHorizontal: Spacing.xl,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
  },
  logoEmblem: {
    position: 'absolute',
    width: 56,
    height: 56,
    top: (RING_SIZE - 56) / 2,
    left: (RING_SIZE - 56) / 2,
  },
  messageContainer: {
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusMessage: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.lg,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  slowWarning: {
    color: Colors.warning,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
  },
  // Error screen
  errorTitle: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
    marginTop: Spacing.lg,
  },
  errorSubtitle: {
    color: Colors.textOnDarkDim,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  errorButtons: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
    alignItems: 'center',
  },
  retryButton: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  goBackButton: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.xl,
  },
  goBackText: {
    color: Colors.textOnDarkMuted,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
  },
  // XP overlay
  xpOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 100,
    backgroundColor: 'rgba(6, 11, 18, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  xpOverlayContent: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  xpGainText: {
    color: Colors.primary,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.hero,
  },
  badgeEarnedText: {
    color: Colors.warning,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
  },
});
