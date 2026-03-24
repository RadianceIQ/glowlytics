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
import {
  SIGNAL_COLORS,
  SIGNAL_LABELS,
  confidenceBadgeColor,
  METRIC_GUIDE,
} from '../../src/constants/signals';
import { getExplanation } from '../../src/services/skinAnalysis';
import {
  buildOverallSkinInsight,
  getLatestDailyForOutput,
} from '../../src/services/skinInsights';
import { groupLesionsByType, LESION_INFO } from '../../src/constants/lesions';
import { useStore } from '../../src/store/useStore';
import { trackEvent } from '../../src/services/analytics';
import type { LesionClass } from '../../src/types';

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
    () => buildOverallSkinInsight({
      latestOutput,
      baselineOutput,
      latestDaily,
      serverSignalScores: latestOutput?.signal_scores,
      serverSignalFeatures: latestOutput?.signal_features,
      serverSignalConfidence: latestOutput?.signal_confidence,
      serverLesions: latestOutput?.lesions,
    }),
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

  const latestDailyRecord = latestDaily;
  const generatedInsights = latestOutput.generated_insights;
  const templateExplanation = getExplanation(latestOutput, {
    sunscreen: latestDailyRecord?.sunscreen_used ?? true,
    cycleWindow: latestOutput.primary_driver === 'cycle window',
    newProduct: latestDailyRecord?.new_product_added ?? false,
    sleepQuality: latestDailyRecord?.sleep_quality,
  });
  const explanation = generatedInsights?.overall_summary
    || latestOutput.personalized_feedback
    || templateExplanation;

  const lesionGroups = useMemo(
    () => latestOutput.lesions && latestOutput.lesions.length > 0
      ? groupLesionsByType(latestOutput.lesions as Array<{ class: LesionClass; zone: string; confidence: number; tier?: string }>)
      : [],
    [latestOutput.lesions],
  );

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
                      <View style={[styles.confidenceBadge, { backgroundColor: (confidenceBadgeColor(confidence) || Colors.textMuted) + '30' }]}>
                        <Text style={[styles.confidenceText, { color: confidenceBadgeColor(confidence) || Colors.textMuted }]}>
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
          {lesionGroups.length > 0 && (
            <View style={styles.lesionCards}>
              {lesionGroups.map((group) => (
                <View key={group.class} style={[styles.lesionCard, { borderLeftColor: group.info.color }]}>
                  <View style={styles.lesionCardHeader}>
                    <View style={[styles.lesionDot, { backgroundColor: group.info.color }]} />
                    <Text style={styles.lesionCardTitle}>
                      {group.count} {group.info.label}{group.count !== 1 ? 's' : ''}
                    </Text>
                    <Text style={styles.lesionCardZones}>
                      {group.zones.join(', ')}
                    </Text>
                  </View>
                  <Text style={styles.lesionCardDesc}>{group.info.description}</Text>
                  <Text style={styles.lesionCardImpact}>{group.info.signalImpact}</Text>
                </View>
              ))}
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

      {/* Action plan from generated insights */}
      {generatedInsights?.action_plan && generatedInsights.action_plan.length > 0 && (
        <Animated.View entering={FadeInDown.duration(500).delay(550)} style={styles.actionPlanSection}>
          <Text style={styles.ragTitle}>Your action plan</Text>
          {generatedInsights.action_plan.map((action, i) => (
            <View key={i} style={styles.actionPlanItem}>
              <Text style={styles.actionPlanNumber}>{i + 1}</Text>
              <Text style={styles.actionPlanText}>{action}</Text>
            </View>
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
          <Text style={styles.overallAction}>
            {generatedInsights?.overall_score_context || overallInsight.actionStatement}
          </Text>
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
        {METRIC_GUIDE.map((metric, i) => {
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
                accessibilityRole="button"
                accessibilityLabel={`${metric.title} score ${score} out of 100, open detailed assessment`}
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
    borderRadius: BorderRadius.xs,
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
    borderRadius: BorderRadius.xs,
    overflow: 'hidden',
  },
  signalBarFill: {
    height: 4,
    borderRadius: BorderRadius.xs,
  },
  confidenceBadge: {
    paddingHorizontal: Spacing.xs,
    paddingVertical: 1,
    borderRadius: BorderRadius.sm,
  },
  confidenceText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  lesionCards: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  lesionCard: {
    backgroundColor: Colors.surfaceOverlay,
    borderRadius: BorderRadius.md,
    borderLeftWidth: 3,
    padding: Spacing.sm,
    gap: 2,
  },
  lesionCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  lesionDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.xs,
  },
  lesionCardTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  lesionCardZones: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    flex: 1,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  lesionCardDesc: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    marginLeft: Spacing.xs + 6,
  },
  lesionCardImpact: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    marginLeft: Spacing.xs + 6,
  },
  actionPlanSection: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  actionPlanItem: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  actionPlanNumber: {
    color: Colors.primary,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.sm,
    width: 20,
  },
  actionPlanText: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
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
