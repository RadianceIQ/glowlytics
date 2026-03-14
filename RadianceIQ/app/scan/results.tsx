import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { ActionCard } from '../../src/components/ActionCard';
import { Button } from '../../src/components/Button';
import { FacialMesh } from '../../src/components/FacialMesh';
import { ScoreTile } from '../../src/components/ScoreTile';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../../src/constants/theme';
import { getExplanation } from '../../src/services/skinAnalysis';
import { useStore } from '../../src/store/useStore';

const getStatusLabel = (value: number) => {
  if (value <= 25) return 'Calm';
  if (value <= 50) return 'Stable';
  if (value <= 75) return 'Elevated';
  return 'Watch';
};

export default function Results({ hideBottomAction }: { hideBottomAction?: boolean } = {}) {
  const router = useRouter();
  const allOutputs = useStore((s) => s.modelOutputs);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const latestOutput = allOutputs.length > 0 ? allOutputs[allOutputs.length - 1] : null;

  const outputHistory = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const records = dailyRecords.filter((record) => record.date >= cutoffStr);
    const ids = new Set(records.map((record) => record.daily_id));
    return allOutputs.filter((output) => ids.has(output.daily_id));
  }, [dailyRecords, allOutputs]);

  if (!latestOutput) {
    return (
      <AtmosphereScreen scroll={false} contentContainerStyle={styles.emptyLayout}>
        <View style={styles.emptyBlock}>
          <Text style={styles.emptyTitle}>No results yet</Text>
          <Text style={styles.emptyCopy}>
            Capture a scan first so Glowlytics can generate your trend summary.
          </Text>
        </View>
        <Button title="Go back" onPress={() => router.back()} />
      </AtmosphereScreen>
    );
  }

  const baseline = allOutputs.length > 0 ? allOutputs[0] : null;
  const acneDelta = baseline ? latestOutput.acne_score - baseline.acne_score : 0;
  const sunDelta = baseline ? latestOutput.sun_damage_score - baseline.sun_damage_score : 0;
  const ageDelta = baseline ? latestOutput.skin_age_score - baseline.skin_age_score : 0;

  const latestDaily = dailyRecords.length > 0 ? dailyRecords[dailyRecords.length - 1] : null;
  const templateExplanation = getExplanation(latestOutput, {
    sunscreen: latestDaily?.sunscreen_used ?? true,
    cycleWindow: latestOutput.primary_driver === 'cycle window',
    newProduct: latestDaily?.new_product_added ?? false,
    sleepQuality: latestDaily?.sleep_quality,
  });
  const explanation = latestOutput.personalized_feedback || templateExplanation;

  const handleDone = () => {
    router.replace('/(tabs)/today');
  };

  return (
    <AtmosphereScreen>
      {/* Header: FadeIn + slide from top, 0ms delay */}
      <Animated.View entering={FadeIn.duration(500)} style={styles.header}>
        <Text style={styles.eyebrow}>Results</Text>
        <Text style={styles.title}>Today's scan outcome</Text>
      </Animated.View>

      <Animated.View entering={FadeIn.duration(400).delay(100)} style={styles.metaRow}>
        <Text style={styles.metaText}>
          Driver: {(latestOutput.primary_driver || 'daily insight').replace(/_/g, ' ')}
        </Text>
      </Animated.View>

      {/* FacialMesh: scale-up + fade, 200ms delay */}
      <Animated.View entering={ZoomIn.duration(600).delay(200)}>
        <FacialMesh
          acneScore={latestOutput.acne_score}
          sunDamageScore={latestOutput.sun_damage_score}
          skinAgeScore={latestOutput.skin_age_score}
          conditions={latestOutput.conditions}
        />
      </Animated.View>

      {/* ActionCard: slide from bottom + fade, 400ms delay */}
      <Animated.View entering={FadeInDown.duration(500).delay(400)} style={{ marginTop: Spacing.lg }}>
        <ActionCard
          driver={latestOutput.primary_driver || 'daily insight'}
          action={explanation}
          supportingText={latestOutput.recommended_action}
        />
      </Animated.View>

      {/* RAG recommendations: cascade in from bottom, 100ms stagger */}
      {latestOutput.rag_recommendations && latestOutput.rag_recommendations.length > 0 && (
        <Animated.View entering={FadeInDown.duration(500).delay(500)} style={styles.ragSection}>
          <Text style={styles.ragTitle}>Evidence-based guidelines</Text>
          {latestOutput.rag_recommendations.map((rec, i) => (
            <Animated.View key={i} entering={FadeInDown.duration(400).delay(600 + i * 100)} style={styles.ragCard}>
              <View style={styles.ragCategoryBadge}>
                <Text style={styles.ragCategoryText}>
                  {rec.category.replace(/_/g, ' ')}
                </Text>
              </View>
              <Text style={styles.ragText}>{rec.text}</Text>
            </Animated.View>
          ))}
        </Animated.View>
      )}

      {/* ScoreTiles: slide from right, 100ms stagger, 600ms base delay */}
      <View style={styles.metricStack}>
        <Animated.View entering={FadeInRight.duration(500).delay(600)}>
          <ScoreTile
            label="Acne"
            score={latestOutput.acne_score}
            delta={acneDelta}
            color={Colors.acne}
            sparklineData={outputHistory.map((output) => output.acne_score)}
            compact
            lowLabel="Baseline"
            highLabel="Today"
            statusLabel={getStatusLabel(latestOutput.acne_score)}
          />
        </Animated.View>
        <Animated.View entering={FadeInRight.duration(500).delay(700)}>
          <ScoreTile
            label="Sun Damage"
            score={latestOutput.sun_damage_score}
            delta={sunDelta}
            color={Colors.sunDamage}
            sparklineData={outputHistory.map((output) => output.sun_damage_score)}
            compact
            lowLabel="Baseline"
            highLabel="Today"
            statusLabel={getStatusLabel(latestOutput.sun_damage_score)}
          />
        </Animated.View>
        <Animated.View entering={FadeInRight.duration(500).delay(800)}>
          <ScoreTile
            label="Skin Age"
            score={latestOutput.skin_age_score}
            delta={ageDelta}
            color={Colors.skinAge}
            sparklineData={outputHistory.map((output) => output.skin_age_score)}
            compact
            lowLabel="Baseline"
            highLabel="Today"
            statusLabel={getStatusLabel(latestOutput.skin_age_score)}
          />
        </Animated.View>
      </View>

      {/* Escalation alert: slide from bottom, 800ms delay */}
      {latestOutput.escalation_flag ? (
        <Animated.View entering={FadeInDown.duration(500).delay(900)} style={styles.alertStrip}>
          <Text style={styles.alertTitle}>Worth escalating</Text>
          <Text style={styles.alertCopy}>
            Your trend changed quickly for this baseline. This is not diagnostic, but it is worth packaging for clinician context.
          </Text>
          <Button
            title="Share report"
            variant="secondary"
            size="sm"
            onPress={() => router.push('/report/generate')}
          />
        </Animated.View>
      ) : null}

      {!hideBottomAction && (
        <Animated.View entering={FadeInDown.duration(400).delay(1000)} style={styles.bottomAction}>
          <Button title="Continue" onPress={handleDone} size="lg" />
        </Animated.View>
      )}
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.md,
  },
  eyebrow: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: Spacing.xs,
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.hero,
    lineHeight: 40,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  metaText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
  },
  metricStack: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  alertStrip: {
    marginTop: Spacing.lg,
    backgroundColor: 'rgba(72, 43, 16, 0.88)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  alertTitle: {
    color: Colors.warning,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  alertCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  ragSection: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  ragTitle: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  ragCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  ragCategoryBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.surfaceOverlay,
    borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  ragCategoryText: {
    color: Colors.primary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  ragText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  bottomAction: {
    marginTop: Spacing.lg,
  },
  emptyLayout: {
    justifyContent: 'space-between',
  },
  emptyBlock: {
    gap: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.hero,
  },
  emptyCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
  },
});
