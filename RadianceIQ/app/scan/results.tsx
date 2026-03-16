import React, { useEffect, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { ActionCard } from '../../src/components/ActionCard';
import { Button } from '../../src/components/Button';
import { FacialMesh } from '../../src/components/FacialMesh';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../../src/constants/theme';
import { getExplanation } from '../../src/services/skinAnalysis';
import {
  buildOverallSkinInsight,
  getLatestDailyForOutput,
  type SkinMetricKey,
} from '../../src/services/skinInsights';
import { useStore } from '../../src/store/useStore';
import { trackEvent } from '../../src/services/analytics';
import type { SignalConfidenceLevel } from '../../src/types';

const SIGNAL_COLORS: Record<string, string> = {
  structure: '#3A9E8F',
  hydration: '#3B7FC4',
  inflammation: '#D14343',
  sunDamage: '#C07B2A',
  elasticity: '#7B5FC2',
};

const SIGNAL_LABELS: Record<string, string> = {
  structure: 'Structure',
  hydration: 'Hydration',
  inflammation: 'Inflammation',
  sunDamage: 'Sun Damage',
  elasticity: 'Elasticity',
};

const confidenceBadgeColor = (level: SignalConfidenceLevel) => {
  switch (level) {
    case 'high': return Colors.success;
    case 'med': return Colors.warning;
    case 'low': return Colors.error;
  }
};

const getStatusLabel = (value: number) => {
  if (value <= 25) return 'Calm';
  if (value <= 50) return 'Stable';
  if (value <= 75) return 'Elevated';
  return 'Watch';
};

const metricGuide: {
  key: SkinMetricKey;
  title: string;
  subtitle: string;
  detail: string;
  color: string;
}[] = [
  {
    key: 'acne',
    title: 'Acne',
    subtitle: 'Inflammation + congestion signal',
    detail: 'Combines breakout trend, inflammation index, and confounders like new products.',
    color: Colors.acne,
  },
  {
    key: 'sun_damage',
    title: 'Sun Damage',
    subtitle: 'UV and pigmentation load',
    detail: 'Tracks photodamage risk using pigmentation index and sun-protection consistency.',
    color: Colors.sunDamage,
  },
  {
    key: 'skin_age',
    title: 'Skin Age',
    subtitle: 'Texture + elasticity drift',
    detail: 'Reflects visible texture and firmness trend relative to your baseline scan.',
    color: Colors.skinAge,
  },
];

export default function Results({ hideBottomAction: hideBottomActionProp }: { hideBottomAction?: boolean }) {
  const router = useRouter();
  const searchParams = useLocalSearchParams<{ hideBottomAction?: string }>();
  const hideBottomAction = hideBottomActionProp || searchParams.hideBottomAction === 'true';
  const allOutputs = useStore((s) => s.modelOutputs);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const latestOutput = allOutputs.length > 0 ? allOutputs[allOutputs.length - 1] : null;
  const baselineOutput = allOutputs.length > 0 ? allOutputs[0] : null;
  const latestDaily = getLatestDailyForOutput(latestOutput, dailyRecords);

  const overallInsight = useMemo(
    () => buildOverallSkinInsight({ latestOutput, baselineOutput, latestDaily }),
    [latestOutput, baselineOutput, latestDaily],
  );

  useEffect(() => {
    if (latestOutput) {
      trackEvent('scan_results_viewed', {
        acne_score: latestOutput.acne_score,
        sun_damage_score: latestOutput.sun_damage_score,
        skin_age_score: latestOutput.skin_age_score,
        escalation_flag: latestOutput.escalation_flag,
      });
    }
  }, [latestOutput?.output_id]);

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

  const latestDailyRecord = dailyRecords.length > 0 ? dailyRecords[dailyRecords.length - 1] : null;
  const templateExplanation = getExplanation(latestOutput, {
    sunscreen: latestDailyRecord?.sunscreen_used ?? true,
    cycleWindow: latestOutput.primary_driver === 'cycle window',
    newProduct: latestDailyRecord?.new_product_added ?? false,
    sleepQuality: latestDailyRecord?.sleep_quality,
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
        <Text style={styles.title}>Your scan results</Text>
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
          lesions={latestOutput.lesions}
          signalConfidence={latestOutput.signal_confidence}
        />
      </Animated.View>

      {/* Signal Scores: per-signal breakdown with confidence indicators */}
      {latestOutput.signal_scores && (
        <Animated.View entering={FadeInDown.duration(500).delay(300)} style={styles.signalSection}>
          <Text style={styles.signalSectionTitle}>Signal Breakdown</Text>
          <View style={styles.signalGrid}>
            {(Object.keys(SIGNAL_LABELS) as Array<keyof typeof SIGNAL_LABELS>).map((key) => {
              const score = latestOutput.signal_scores?.[key as keyof typeof latestOutput.signal_scores];
              const confidence = latestOutput.signal_confidence?.[key as keyof typeof latestOutput.signal_confidence];
              if (score == null) return null;
              return (
                <View key={key} style={styles.signalItem}>
                  <View style={styles.signalRow}>
                    <View style={[styles.signalDot, { backgroundColor: SIGNAL_COLORS[key] }]} />
                    <Text style={styles.signalLabel}>{SIGNAL_LABELS[key]}</Text>
                    {confidence && (
                      <View style={[styles.confidenceBadge, { backgroundColor: confidenceBadgeColor(confidence) + '30' }]}>
                        <Text style={[styles.confidenceText, { color: confidenceBadgeColor(confidence) }]}>
                          {confidence}
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.signalBarBg}>
                    <View style={[styles.signalBarFill, { width: `${score}%`, backgroundColor: SIGNAL_COLORS[key] }]} />
                  </View>
                  <Text style={[styles.signalScore, { color: SIGNAL_COLORS[key] }]}>{score}</Text>
                </View>
              );
            })}
          </View>
          {latestOutput.lesions && latestOutput.lesions.length > 0 && (
            <View style={styles.lesionSummary}>
              <Text style={styles.lesionSummaryText}>
                {latestOutput.lesions.length} lesion{latestOutput.lesions.length !== 1 ? 's' : ''} detected across{' '}
                {[...new Set(latestOutput.lesions.map(l => l.zone))].length} zone{[...new Set(latestOutput.lesions.map(l => l.zone))].length !== 1 ? 's' : ''}
              </Text>
            </View>
          )}
        </Animated.View>
      )}

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

      {/* Overall score card */}
      {overallInsight && (
        <Animated.View entering={FadeInDown.duration(500).delay(600)} style={styles.overallCard}>
          <Text style={styles.overallLabel}>Overall score</Text>
          <Text style={styles.overallScore}>
            {overallInsight.score} <Text style={styles.overallStatus}>{overallInsight.statusLabel}</Text>
          </Text>
          <Text style={styles.overallAction}>{overallInsight.actionStatement}</Text>
          <View style={styles.signalChipRow}>
            <Text style={styles.signalChip}>Structure {overallInsight.signals.structure}</Text>
            <Text style={styles.signalChip}>Hydration {overallInsight.signals.hydration}</Text>
            <Text style={styles.signalChip}>Inflammation {overallInsight.signals.inflammation}</Text>
            <Text style={styles.signalChip}>Sun Damage {overallInsight.signals.sunDamage}</Text>
            <Text style={styles.signalChip}>Elasticity {overallInsight.signals.elasticity}</Text>
          </View>
        </Animated.View>
      )}

      {/* Metric guide cards */}
      <View style={styles.metricStack}>
        {metricGuide.map((metric, i) => {
          const score =
            metric.key === 'acne'
              ? latestOutput.acne_score
              : metric.key === 'sun_damage'
                ? latestOutput.sun_damage_score
                : latestOutput.skin_age_score;

          return (
            <Animated.View key={metric.key} entering={FadeInRight.duration(500).delay(700 + i * 100)}>
              <TouchableOpacity
                activeOpacity={0.85}
                style={styles.metricCard}
                onPress={() =>
                  router.push({
                    pathname: '/skin-metric/[metric]',
                    params: { metric: metric.key },
                  })
                }
              >
                <View style={styles.metricCardHeader}>
                  <Text style={styles.metricTitle}>{metric.title}</Text>
                  <Text style={[styles.metricScore, { color: metric.color }]}>
                    {score}/100
                  </Text>
                </View>
                <Text style={styles.metricSubtitle}>{metric.subtitle}</Text>
                <Text style={styles.metricDetail}>{metric.detail}</Text>
                <Text style={styles.metricCta}>Open detailed assessment</Text>
              </TouchableOpacity>
            </Animated.View>
          );
        })}
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
    backgroundColor: 'rgba(255, 243, 224, 0.92)',
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
  signalSection: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  signalSectionTitle: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  signalGrid: {
    gap: Spacing.md,
  },
  signalItem: {
    gap: Spacing.xxs,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  signalDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  signalLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
  signalScore: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textAlign: 'right',
  },
  signalBarBg: {
    height: 4,
    backgroundColor: Colors.surfaceOverlay,
    borderRadius: 2,
    overflow: 'hidden',
  },
  signalBarFill: {
    height: 4,
    borderRadius: 2,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  confidenceText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: 9,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lesionSummary: {
    backgroundColor: Colors.surfaceOverlay,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
    marginTop: Spacing.xs,
  },
  lesionSummaryText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },
  overallCard: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  overallLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  overallScore: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.display,
    lineHeight: 52,
  },
  overallStatus: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  overallAction: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  signalChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  signalChip: {
    color: Colors.text,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    overflow: 'hidden',
  },
  metricCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  metricCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  metricTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
  },
  metricScore: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  metricSubtitle: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  metricDetail: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  metricCta: {
    marginTop: Spacing.xs,
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
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
