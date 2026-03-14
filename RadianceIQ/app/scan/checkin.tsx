import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import Animated, { FadeIn, FadeOut, FadeInDown } from 'react-native-reanimated';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { useStore } from '../../src/store/useStore';

export default function DailyCheckin() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inflammation: string;
    pigmentation: string;
    texture: string;
    photoUri: string;
  }>();

  const store = useStore();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const pendingScanResult = useStore((s) => s.pendingScanResult);

  const [sunscreen, setSunscreen] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<string | null>(null);
  const [periodAccurate, setPeriodAccurate] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [sleep, setSleep] = useState<string | null>(null);
  const [stress, setStress] = useState<string | null>(null);
  const [drinks, setDrinks] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [xpFeedback, setXpFeedback] = useState<{ xp: number; badge?: string } | null>(null);

  // Auto-expand optional context for first 3 scans as a nudge
  useEffect(() => {
    if (dailyRecords.length < 3) {
      setShowContext(true);
    }
  }, []);

  // Estimate cycle day
  const estimatedCycleDay = (() => {
    if (user?.period_applicable !== 'yes' || !user?.period_last_start_date) return null;
    const start = new Date(user.period_last_start_date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cycleLen = user.cycle_length_days || 28;
    return ((diff % cycleLen) + cycleLen) % cycleLen + 1;
  })();

  const canContinue = sunscreen !== null && newProduct !== null;

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

  const handleSeeResults = async () => {
    if (!user || !protocol) return;
    setLoading(true);

    const scannerData = {
      inflammation_index: parseFloat(params.inflammation || '40'),
      pigmentation_index: parseFloat(params.pigmentation || '30'),
      texture_index: parseFloat(params.texture || '35'),
    };

    // Persist photo to permanent storage
    let savedPhotoUri: string | undefined;
    if (params.photoUri) {
      savedPhotoUri = await persistPhoto(params.photoUri);
    }

    // Use analysis from processing screen (pendingScanResult) or fallback
    const analysis = pendingScanResult || {
      acne_score: 50,
      sun_damage_score: 40,
      skin_age_score: 45,
      confidence: 'low' as const,
      primary_driver: 'general tracking',
      recommended_action: 'Continue daily scans for more data.',
      escalation_flag: false,
    };

    // Capture XP and badge count before the scan
    const xpBefore = store.gamification.xp;
    const badgesBefore = store.gamification.badges.length;

    const dailyRecord = store.addDailyRecord({
      date: new Date().toISOString().split('T')[0],
      scanner_reading_id: `scan_${Date.now()}`,
      scanner_indices: scannerData,
      scanner_quality_flag: 'pass',
      scan_region: protocol.scan_region,
      photo_uri: savedPhotoUri,
      photo_quality_flag: 'pass',
      sunscreen_used: sunscreen === 'yes',
      new_product_added: newProduct === 'yes',
      period_status_confirmed: periodAccurate as any,
      cycle_day_estimated: estimatedCycleDay || undefined,
      sleep_quality: sleep as any,
      stress_level: stress as any,
      drinks_yesterday: drinks || undefined,
    });

    store.addModelOutput({
      daily_id: dailyRecord.daily_id,
      acne_score: analysis.acne_score ?? 50,
      sun_damage_score: analysis.sun_damage_score ?? 40,
      skin_age_score: analysis.skin_age_score ?? 45,
      confidence: (analysis as any).confidence || 'low',
      primary_driver: (analysis as any).primary_driver,
      recommended_action: (analysis as any).recommended_action || '',
      escalation_flag: (analysis as any).escalation_flag || false,
      conditions: (analysis as any).conditions,
      rag_recommendations: (analysis as any).rag_recommendations,
      personalized_feedback: (analysis as any).personalized_feedback,
    });

    // Clear pending result
    store.clearPendingScanResult();

    setLoading(false);

    // Check for XP gains and new badges
    const currentState = useStore.getState();
    const xpGained = currentState.gamification.xp - xpBefore;
    const newBadges = currentState.gamification.badges.slice(badgesBefore);
    const latestBadgeName = newBadges.length > 0 ? newBadges[newBadges.length - 1].name : undefined;

    if (xpGained > 0 || latestBadgeName) {
      setXpFeedback({ xp: xpGained, badge: latestBadgeName });
      setTimeout(() => {
        setXpFeedback(null);
        router.push('/scan/results');
      }, 1500);
    } else {
      router.push('/scan/results');
    }
  };

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
    <AtmosphereScreen>
      <Animated.View entering={FadeInDown.duration(400).delay(0)}>
        <Text style={styles.title}>Quick check-in</Text>
        <Text style={styles.subtitle}>A few quick taps before your results.</Text>
      </Animated.View>

      {/* Sunscreen */}
      <Animated.View entering={FadeInDown.duration(400).delay(100)}>
        <Text style={styles.sectionLabel}>Sunscreen today?</Text>
        <OptionSelector
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ]}
          selected={sunscreen}
          onSelect={setSunscreen}
          horizontal
        />
      </Animated.View>

      {/* New product */}
      <Animated.View entering={FadeInDown.duration(400).delay(200)}>
        <Text style={styles.sectionLabel}>Any new product since yesterday?</Text>
        <OptionSelector
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ]}
          selected={newProduct}
          onSelect={setNewProduct}
          horizontal
        />
      </Animated.View>

      {/* Period status */}
      {user?.period_applicable === 'yes' && estimatedCycleDay && (
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Text style={styles.sectionLabel}>Period status</Text>
          <View style={styles.cycleDayCard}>
            <Text style={styles.cycleDayText}>
              Estimated: Day {estimatedCycleDay}
            </Text>
            <OptionSelector
              options={[
                { label: 'Accurate', value: 'accurate' },
                { label: 'Not accurate', value: 'not_accurate' },
              ]}
              selected={periodAccurate}
              onSelect={setPeriodAccurate}
              horizontal
            />
          </View>
        </Animated.View>
      )}

      {/* Optional context */}
      {!showContext ? (
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <TouchableOpacity
            style={styles.contextToggle}
            onPress={() => setShowContext(true)}
          >
            <Text style={styles.contextToggleText}>Add context (optional)</Text>
          </TouchableOpacity>
        </Animated.View>
      ) : (
        <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.contextSection}>
          <Text style={styles.sectionLabel}>Sleep (yesterday)</Text>
          <OptionSelector
            options={[
              { label: 'Poor', value: 'poor' },
              { label: 'OK', value: 'ok' },
              { label: 'Great', value: 'great' },
            ]}
            selected={sleep}
            onSelect={setSleep}
            horizontal
          />

          <Text style={styles.sectionLabel}>Stress (yesterday)</Text>
          <OptionSelector
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Med', value: 'med' },
              { label: 'High', value: 'high' },
            ]}
            selected={stress}
            onSelect={setStress}
            horizontal
          />

          <Text style={styles.sectionLabel}>Drinks yesterday</Text>
          <OptionSelector
            options={[
              { label: '0', value: '0' },
              { label: '1-2', value: '1-2' },
              { label: '3+', value: '3+' },
            ]}
            selected={drinks}
            onSelect={setDrinks}
            horizontal
          />
        </Animated.View>
      )}

      <View style={styles.bottom}>
        <Button
          title="See results"
          onPress={handleSeeResults}
          disabled={!canContinue}
          loading={loading}
        />
      </View>
    </AtmosphereScreen>
    </>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.sansBold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cycleDayCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cycleDayText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
  },
  contextToggle: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  contextToggleText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  contextSection: {
    marginTop: Spacing.md,
  },
  bottom: {
    marginTop: Spacing.xl,
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
