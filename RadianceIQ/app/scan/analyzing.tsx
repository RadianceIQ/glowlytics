import React, { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import * as FileSystemLegacy from 'expo-file-system/legacy';
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
import { analyzeWithFallback } from '../../src/services/skinAnalysis';

type FeatherIcon = React.ComponentProps<typeof Feather>['name'];

interface Stage {
  message: string;
  icon: FeatherIcon;
  duration: number; // ms, 0 = holds until API done
}

const STAGES: Stage[] = [
  { message: 'Preparing your scan...', icon: 'camera', duration: 600 },
  { message: 'Analyzing inflammation...', icon: 'thermometer', duration: 700 },
  { message: 'Checking hydration...', icon: 'droplet', duration: 700 },
  { message: 'Measuring structure...', icon: 'grid', duration: 700 },
  { message: 'Evaluating sun damage...', icon: 'sun', duration: 700 },
  { message: 'Assessing elasticity...', icon: 'activity', duration: 700 },
  { message: 'Running AI analysis...', icon: 'cpu', duration: 0 },
  { message: 'Generating recommendations...', icon: 'file-text', duration: 800 },
  { message: 'Compiling results...', icon: 'check-circle', duration: 600 },
];

const CALM_EASING = Easing.out(Easing.cubic);
const API_STAGE = 6;

export default function AnalyzingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inflammation: string;
    pigmentation: string;
    texture: string;
    photoUri: string;
    sunscreen: string;
    newProduct: string;
    periodAccurate: string;
    sleep: string;
    stress: string;
    drinks: string;
  }>();

  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const modelOutputs = useStore((s) => s.modelOutputs);
  const pendingPhotoBase64 = useStore((s) => s.pendingPhotoBase64);
  const addDailyRecord = useStore((s) => s.addDailyRecord);
  const addModelOutput = useStore((s) => s.addModelOutput);
  const clearPendingPhotoBase64 = useStore((s) => s.clearPendingPhotoBase64);

  const [currentStage, setCurrentStage] = useState(0);
  const [error, setError] = useState(false);
  const [slowWarning, setSlowWarning] = useState(false);
  const [xpFeedback, setXpFeedback] = useState<{ xp: number; badge?: string } | null>(null);

  const apiDone = useRef(false);
  const apiResult = useRef<any>(null);
  const holdingOnApiStage = useRef(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const hasStarted = useRef(false);

  // Animations
  const orbScale = useSharedValue(0.8);
  const orbOpacity = useSharedValue(0);
  const glowPulse = useSharedValue(0.3);
  const progressWidth = useSharedValue(0);

  const progressForStage = (stage: number) => {
    if (stage <= 5) return (stage + 1) / STAGES.length;
    if (stage === 6) return 0.66;
    if (stage === 7) return 0.85;
    return 1;
  };

  const advanceStage = (stage: number) => {
    setCurrentStage(stage);
    const target = progressForStage(stage);
    progressWidth.value = withTiming(target, { duration: 400, easing: CALM_EASING });
  };

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

  const runPostApiStages = () => {
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

  const persistAndNavigate = async () => {
    const analysis = apiResult.current;
    if (!analysis) {
      router.replace('/scan/results');
      return;
    }

    try {
      const currentUser = user || useStore.getState().user;
      const currentProtocol = protocol || useStore.getState().protocol;

      const scannerData = {
        inflammation_index: parseFloat(params.inflammation || '40'),
        pigmentation_index: parseFloat(params.pigmentation || '30'),
        texture_index: parseFloat(params.texture || '35'),
      };

      let savedPhotoUri: string | undefined;
      if (params.photoUri) {
        savedPhotoUri = await persistPhoto(params.photoUri);
      }

      clearPendingPhotoBase64();

      const xpBefore = useStore.getState().gamification.xp;
      const badgesBefore = useStore.getState().gamification.badges.length;

      const estimatedCycleDay = (() => {
        if (currentUser?.period_applicable !== 'yes' || !currentUser?.period_last_start_date) return undefined;
        const start = new Date(currentUser.period_last_start_date);
        const today = new Date();
        const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        const cycleLen = currentUser.cycle_length_days || 28;
        return ((diff % cycleLen) + cycleLen) % cycleLen + 1;
      })();

      const dailyRecord = addDailyRecord({
        date: new Date().toISOString().split('T')[0],
        scanner_reading_id: `scan_${Date.now()}`,
        scanner_indices: scannerData,
        scanner_quality_flag: 'pass',
        scan_region: currentProtocol?.scan_region || 'whole_face',
        photo_uri: savedPhotoUri,
        photo_quality_flag: 'pass',
        sunscreen_used: params.sunscreen === 'yes',
        new_product_added: params.newProduct === 'yes',
        period_status_confirmed: params.periodAccurate as any,
        cycle_day_estimated: estimatedCycleDay,
        sleep_quality: params.sleep as any,
        stress_level: params.stress as any,
        drinks_yesterday: params.drinks || undefined,
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
        lesions: analysis.lesions,
        signal_confidence: analysis.signal_confidence,
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
      // Persistence failed — still navigate to results
    }

    router.replace('/scan/results');
  };

  // Start animations immediately + cleanup timers on unmount
  useEffect(() => {
    orbScale.value = withTiming(1, { duration: 600, easing: CALM_EASING });
    orbOpacity.value = withTiming(1, { duration: 400, easing: CALM_EASING });
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

  // Wait for store to hydrate, then fire analysis
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
      // Drift animation while waiting for API
      progressWidth.value = withRepeat(
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

    // --- API track: fire immediately ---
    const scannerData = {
      inflammation_index: parseFloat(params.inflammation || '40'),
      pigmentation_index: parseFloat(params.pigmentation || '30'),
      texture_index: parseFloat(params.texture || '35'),
    };

    const estimatedCycleDay = (() => {
      if (user.period_applicable !== 'yes' || !user.period_last_start_date) return undefined;
      const start = new Date(user.period_last_start_date);
      const today = new Date();
      const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const cycleLen = user.cycle_length_days || 28;
      return ((diff % cycleLen) + cycleLen) % cycleLen + 1;
    })();

    analyzeWithFallback({
      scannerData,
      photoUri: params.photoUri || undefined,
      userProfile: user,
      protocol,
      previousOutputs: modelOutputs,
      dailyContext: {
        sunscreen_used: params.sunscreen === 'yes',
        new_product_added: params.newProduct === 'yes',
        cycle_day_estimated: estimatedCycleDay,
        sleep_quality: params.sleep || undefined,
        stress_level: params.stress || undefined,
      },
      preEncodedBase64: pendingPhotoBase64 || undefined,
      skipDelay: true,
    })
      .then((result) => {
        apiResult.current = result;
        apiDone.current = true;
        setSlowWarning(false);

        if (holdingOnApiStage.current) {
          runPostApiStages();
        }
      })
      .catch(() => {
        setError(true);
      });

  }, [user, protocol]);

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

  if (error) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={[Colors.backgroundDeep, '#6B8799', '#081522']}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.content}>
          <Feather name="alert-circle" size={48} color={Colors.error} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorSubtitle}>We couldn&apos;t complete your analysis.</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => router.replace('/(tabs)/today')}
          >
            <Text style={styles.retryText}>Go back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const stage = STAGES[currentStage];

  return (
    <>
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

          {/* Status message with icon */}
          <View style={styles.messageContainer}>
            <Animated.View
              key={currentStage}
              entering={FadeIn.duration(400)}
              exiting={FadeOut.duration(400)}
              style={styles.messageRow}
            >
              <Feather name={stage.icon} size={20} color={Colors.primary} />
              <Text style={styles.statusMessage}>{stage.message}</Text>
            </Animated.View>
          </View>

          {/* Step counter */}
          <Text style={styles.stepText}>
            Step {currentStage + 1} of {STAGES.length}
          </Text>

          {slowWarning && (
            <Animated.Text
              entering={FadeIn.duration(300)}
              style={styles.slowWarning}
            >
              Taking longer than expected...
            </Animated.Text>
          )}
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
    </>
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
    gap: Spacing.lg,
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
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  statusMessage: {
    color: '#FFFFFF',
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
    textAlign: 'center',
  },
  stepText: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
  },
  slowWarning: {
    color: Colors.warning,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
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
  errorTitle: {
    color: '#FFFFFF',
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
    marginTop: Spacing.lg,
  },
  errorSubtitle: {
    color: 'rgba(255, 255, 255, 0.6)',
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    marginTop: Spacing.sm,
  },
  retryButton: {
    marginTop: Spacing.xl,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
  },
  retryText: {
    color: '#FFFFFF',
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
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
