import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dimensions, FlatList, StyleSheet, Text, TouchableOpacity, View, ViewToken } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { ActionCard } from '../../src/components/ActionCard';
import { Button } from '../../src/components/Button';
import { FacialMesh } from '../../src/components/FacialMesh';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  scoreColor,
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

const { height: SCREEN_H } = Dimensions.get('window');

// ---------------------------------------------------------------------------
// Story page wrapper — each page fills the viewport
// ---------------------------------------------------------------------------
function StoryPage({ children, insets }: { children: React.ReactNode; insets: { top: number; bottom: number } }) {
  return (
    <View style={[storyStyles.page, { height: SCREEN_H }]}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundDeep, Colors.backgroundWarm]}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[storyStyles.pageContent, { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xxl }]}>
        {children}
      </View>
    </View>
  );
}

const storyStyles = StyleSheet.create({
  page: {
    width: '100%',
  },
  pageContent: {
    flex: 1,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
  },
});

// ---------------------------------------------------------------------------
// Progress dots
// ---------------------------------------------------------------------------
function ProgressDots({ count, active }: { count: number; active: number }) {
  return (
    <View style={dotStyles.container}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={[
            dotStyles.dot,
            i === active && dotStyles.dotActive,
            i < active && dotStyles.dotCompleted,
          ]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: Spacing.md,
    top: '40%',
    gap: Spacing.sm,
    zIndex: 10,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.textDim,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 6,
    height: 18,
    borderRadius: 3,
  },
  dotCompleted: {
    backgroundColor: Colors.primaryLight,
  },
});

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function Results({ hideBottomAction: hideBottomActionProp }: { hideBottomAction?: boolean }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
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

  const [activePage, setActivePage] = useState(0);
  const listRef = useRef<FlatList>(null);

  // Empty state
  if (!latestOutput) {
    return (
      <View style={{ flex: 1, backgroundColor: Colors.background, justifyContent: 'center', paddingHorizontal: Spacing.xl }}>
        <Text style={styles.emptyTitle}>No results yet</Text>
        <Text style={styles.emptyCopy}>Capture a scan first.</Text>
        <Button title="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const generatedInsights = latestOutput.generated_insights;
  const templateExplanation = getExplanation(latestOutput, {
    sunscreen: latestDaily?.sunscreen_used ?? true,
    cycleWindow: latestOutput.primary_driver === 'cycle window',
    newProduct: latestDaily?.new_product_added ?? false,
    sleepQuality: latestDaily?.sleep_quality,
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

  const handleDone = () => router.replace('/(tabs)/today');

  // Build story pages
  const pages: { key: string; render: () => React.ReactNode }[] = [];

  // Page 1: Score reveal
  pages.push({
    key: 'score',
    render: () => (
      <StoryPage insets={insets}>
        <Animated.View entering={ZoomIn.duration(600)} style={styles.scoreCenter}>
          <Text style={[styles.bigScore, { color: scoreColor(overallInsight?.score ?? 0) }]}>
            {overallInsight?.score ?? 0}
          </Text>
          <Text style={styles.scoreStatus}>{overallInsight?.statusLabel}</Text>
        </Animated.View>
        <Animated.View entering={FadeInUp.duration(500).delay(400)}>
          <Text style={styles.scoreAction}>
            {generatedInsights?.overall_score_context || overallInsight?.actionStatement}
          </Text>
        </Animated.View>
        <Animated.View entering={FadeIn.duration(400).delay(800)} style={styles.swipeHint}>
          <Text style={styles.swipeText}>Swipe up for details</Text>
          <Feather name="chevron-up" size={16} color={Colors.textDim} />
        </Animated.View>
      </StoryPage>
    ),
  });

  // Page 2: Signal breakdown
  if (latestOutput.signal_scores) {
    pages.push({
      key: 'signals',
      render: () => (
        <StoryPage insets={insets}>
          <Text style={styles.pageTitle}>Your skin signals</Text>
          <View style={styles.signalList}>
            {(Object.keys(SIGNAL_LABELS) as Array<keyof typeof SIGNAL_LABELS>).map((key, i) => {
              const score = latestOutput.signal_scores?.[key as keyof typeof latestOutput.signal_scores];
              const confidence = latestOutput.signal_confidence?.[key as keyof typeof latestOutput.signal_confidence];
              if (score == null) return null;
              return (
                <Animated.View key={key} entering={FadeInDown.duration(300).delay(i * 80)} style={styles.signalItem}>
                  <View style={styles.signalRow}>
                    <View style={[styles.signalDot, { backgroundColor: SIGNAL_COLORS[key] }]} />
                    <Text style={styles.signalLabel}>{SIGNAL_LABELS[key]}</Text>
                    <Text style={[styles.signalScore, { color: SIGNAL_COLORS[key] }]}>{Math.min(score, 100)}</Text>
                  </View>
                  <View style={styles.signalBarBg}>
                    <View style={[styles.signalBarFill, { width: `${Math.min(score, 100)}%`, backgroundColor: SIGNAL_COLORS[key] }]} />
                  </View>
                </Animated.View>
              );
            })}
          </View>
        </StoryPage>
      ),
    });
  }

  // Page 3: Insights + action
  pages.push({
    key: 'insights',
    render: () => (
      <StoryPage insets={insets}>
        <Text style={styles.pageTitle}>What to do</Text>
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <ActionCard
            driver={latestOutput.primary_driver || 'daily insight'}
            action={explanation}
            supportingText={latestOutput.recommended_action}
          />
        </Animated.View>
        {generatedInsights?.action_plan && generatedInsights.action_plan.length > 0 && (
          <Animated.View entering={FadeInDown.duration(400).delay(300)} style={styles.actionPlan}>
            <Text style={styles.actionPlanTitle}>Action plan</Text>
            {generatedInsights.action_plan.slice(0, 3).map((action, i) => (
              <View key={i} style={styles.actionPlanItem}>
                <Text style={styles.actionPlanNumber}>{i + 1}</Text>
                <Text style={styles.actionPlanText}>{action}</Text>
              </View>
            ))}
          </Animated.View>
        )}
      </StoryPage>
    ),
  });

  // Page 4: Deep dive (face mesh + lesions) — only if there's data
  if (latestOutput.conditions?.length || lesionGroups.length > 0 || latestOutput.rag_recommendations?.length) {
    pages.push({
      key: 'deepdive',
      render: () => (
        <StoryPage insets={insets}>
          <Text style={styles.pageTitle}>The full picture</Text>
          <View style={styles.deepDiveScroll}>
            <FacialMesh
              acneScore={latestOutput.acne_score}
              sunDamageScore={latestOutput.sun_damage_score}
              skinAgeScore={latestOutput.skin_age_score}
              conditions={latestOutput.conditions}
              lesions={latestOutput.lesions}
              signalConfidence={latestOutput.signal_confidence}
            />
            {lesionGroups.length > 0 && (
              <View style={styles.lesionCards}>
                {lesionGroups.map((group) => (
                  <View key={group.class} style={[styles.lesionCard, { borderLeftColor: group.info.color }]}>
                    <View style={styles.lesionCardHeader}>
                      <View style={[styles.lesionDot, { backgroundColor: group.info.color }]} />
                      <Text style={styles.lesionCardTitle}>
                        {group.count} {group.info.label}{group.count !== 1 ? 's' : ''}
                      </Text>
                    </View>
                    <Text style={styles.lesionCardDesc}>{group.info.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </StoryPage>
      ),
    });
  }

  // Page 5: Done
  pages.push({
    key: 'done',
    render: () => (
      <StoryPage insets={insets}>
        <View style={styles.doneCenter}>
          <Animated.View entering={ZoomIn.duration(400)}>
            <Feather name="check-circle" size={56} color={Colors.success} />
          </Animated.View>
          <Animated.View entering={FadeInUp.duration(400).delay(200)} style={styles.doneText}>
            <Text style={styles.doneTitle}>Scan complete</Text>
            <Text style={styles.doneCopy}>
              Your data has been saved. Check your signals on the Today tab to track changes over time.
            </Text>
          </Animated.View>

          {latestOutput.escalation_flag && (
            <Animated.View entering={FadeInDown.duration(400).delay(400)} style={styles.alertStrip}>
              <Feather name="alert-triangle" size={18} color={Colors.warning} />
              <Text style={styles.alertCopy}>
                Your trend changed quickly. Consider sharing a report with your clinician.
              </Text>
              <Button
                title="Share report"
                variant="secondary"
                size="sm"
                onPress={() => router.push('/report/generate')}
              />
            </Animated.View>
          )}

          {!hideBottomAction && (
            <Animated.View entering={FadeIn.duration(300).delay(600)} style={styles.doneAction}>
              <Button title="Done" onPress={handleDone} size="lg" />
            </Animated.View>
          )}
        </View>
      </StoryPage>
    ),
  });

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    if (viewableItems.length > 0 && viewableItems[0].index != null) {
      setActivePage(viewableItems[0].index);
    }
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: Colors.background }}>
      <FlatList
        ref={listRef}
        data={pages}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) => <>{item.render()}</>}
        pagingEnabled
        showsVerticalScrollIndicator={false}
        snapToInterval={SCREEN_H}
        decelerationRate="fast"
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        getItemLayout={(_, index) => ({ length: SCREEN_H, offset: SCREEN_H * index, index })}
      />
      <ProgressDots count={pages.length} active={activePage} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Page 1: Score
  scoreCenter: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  bigScore: {
    fontFamily: FontFamily.sansBold,
    fontSize: 120,
    lineHeight: 120,
    letterSpacing: -4,
  },
  scoreStatus: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
    marginTop: Spacing.xs,
  },
  scoreAction: {
    color: Colors.text,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.lg,
    lineHeight: 26,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  swipeHint: {
    position: 'absolute',
    bottom: Spacing.xxl,
    alignSelf: 'center',
    alignItems: 'center',
    gap: Spacing.xxs,
  },
  swipeText: {
    color: Colors.textDim,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },

  // Page 2: Signals
  pageTitle: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginBottom: Spacing.lg,
  },
  signalList: {
    gap: Spacing.lg,
  },
  signalItem: {
    gap: Spacing.xs,
  },
  signalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  signalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  signalLabel: {
    flex: 1,
    color: Colors.text,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.md,
  },
  signalScore: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  signalBarBg: {
    height: 6,
    backgroundColor: Colors.divider,
    borderRadius: 3,
    overflow: 'hidden',
  },
  signalBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // Page 3: Insights
  actionPlan: {
    marginTop: Spacing.lg,
    gap: Spacing.md,
  },
  actionPlanTitle: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
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

  // Page 4: Deep dive
  deepDiveScroll: {
    flex: 1,
    gap: Spacing.md,
  },
  lesionCards: {
    gap: Spacing.sm,
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
    borderRadius: 3,
  },
  lesionCardTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  lesionCardDesc: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    marginLeft: Spacing.xs + 6,
  },

  // Page 5: Done
  doneCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.lg,
  },
  doneText: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  doneTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  doneCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 23,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
  },
  doneAction: {
    width: '100%',
    paddingHorizontal: Spacing.lg,
  },
  alertStrip: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: 'rgba(255, 243, 224, 0.92)',
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.warning + '40',
    padding: Spacing.md,
  },
  alertCopy: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },

  // Empty
  emptyTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
    marginBottom: Spacing.sm,
  },
  emptyCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
});
