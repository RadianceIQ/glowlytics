import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import Animated, {
  Easing,
  FadeInDown,
  useSharedValue,
  useAnimatedProps,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import {
  toSignalKey,
  signalColorByRouteKey,
  signalLabelByRouteKey,
} from '../../src/constants/signals';
import { useStore } from '../../src/store/useStore';
import { buildOverallSkinInsight, getLatestDailyForOutput } from '../../src/services/skinInsights';
import { useCalmFadeIn } from '../../src/utils/animations';
import { AnimatedFillBar } from '../../src/components/AnimatedFillBar';
import type { CompositeSignals } from '../../src/services/skinInsights';

type SignalKey = 'hydration' | 'elasticity' | 'inflammation' | 'sun_damage' | 'structure';

const signalProperty = (key: SignalKey): keyof CompositeSignals => toSignalKey(key);

// ---------------------------------------------------------------------------
// Signal descriptions — one-line explanations of what each signal measures
// ---------------------------------------------------------------------------
const SIGNAL_DESCRIPTIONS: Record<SignalKey, string> = {
  hydration: 'Measures your skin\u2019s moisture retention and barrier function.',
  inflammation: 'Tracks redness, irritation, and inflammatory markers across your skin.',
  sun_damage: 'Assesses UV-induced pigmentation changes and photoaging indicators.',
  structure: 'Evaluates skin texture, pore density, and overall dermal integrity.',
  elasticity: 'Measures skin firmness, bounce-back resilience, and collagen health.',
};

// ---------------------------------------------------------------------------
// Contributing factor weights + data source mapping per signal
// ---------------------------------------------------------------------------
interface WeightFactor {
  label: string;
  weight: number;
  /** Which field from ModelOutput or scanner_indices to read the actual value */
  sourceField: string;
}

const WEIGHT_FACTORS: Record<SignalKey, WeightFactor[]> = {
  structure: [
    { label: 'Texture Index', weight: 0.55, sourceField: 'texture_index' },
    { label: 'Skin Age', weight: 0.45, sourceField: 'skin_age_score' },
  ],
  hydration: [
    { label: 'Texture Index', weight: 0.5, sourceField: 'texture_index' },
    { label: 'Acne Risk', weight: 0.2, sourceField: 'acne_score' },
    { label: 'Stress Level', weight: 0.15, sourceField: 'stress_level' },
    { label: 'Sleep Quality', weight: 0.15, sourceField: 'sleep_quality' },
  ],
  inflammation: [
    { label: 'Inflammation Index', weight: 0.8, sourceField: 'inflammation_index' },
    { label: 'Acne Risk', weight: 0.2, sourceField: 'acne_score' },
  ],
  sun_damage: [
    { label: 'Sun Damage Score', weight: 0.82, sourceField: 'sun_damage_score' },
    { label: 'Pigmentation Index', weight: 0.18, sourceField: 'pigmentation_index' },
  ],
  elasticity: [
    { label: 'Skin Age', weight: 0.62, sourceField: 'skin_age_score' },
    { label: 'Texture Index', weight: 0.38, sourceField: 'texture_index' },
  ],
};

// ---------------------------------------------------------------------------
// Level helpers
// ---------------------------------------------------------------------------
const levelFromScore = (score: number) => {
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'Poor';
};

const levelColor = (score: number) => {
  if (score >= 75) return Colors.success;
  if (score >= 50) return Colors.primary;
  if (score >= 25) return Colors.warning;
  return Colors.error;
};

// ---------------------------------------------------------------------------
// Recommendations per signal per level
// ---------------------------------------------------------------------------
type Level = 'Excellent' | 'Good' | 'Fair' | 'Poor';

const RECOMMENDATIONS: Record<SignalKey, Record<Level, string[]>> = {
  hydration: {
    Excellent: [
      'Maintain your current routine -- your barrier function is thriving.',
      'Continue using humectant-based moisturizers to sustain hydration levels.',
    ],
    Good: [
      'Consider layering a hyaluronic acid serum under your moisturizer for a minor boost.',
      'Track water intake -- aim for at least 2L daily to support trans-epidermal hydration.',
    ],
    Fair: [
      'Increase water intake and introduce a ceramide-based barrier repair cream at night.',
      'Switch to a gentle, non-foaming cleanser to preserve natural lipids.',
      'Add a humectant serum (hyaluronic acid or glycerin) to your AM routine.',
    ],
    Poor: [
      'Priority: repair your skin barrier immediately with a rich ceramide moisturizer.',
      'Avoid all exfoliating actives (AHAs, BHAs, retinoids) until hydration stabilizes.',
      'Use a humidifier while sleeping and apply occlusive balm over your moisturizer at night.',
      'Drink at least 2.5L of water daily and reduce caffeine and alcohol intake.',
    ],
  },
  inflammation: {
    Excellent: [
      'Your inflammation markers are well controlled -- maintain your current gentle routine.',
      'Continue avoiding known irritants and keep stress management practices in place.',
    ],
    Good: [
      'Consider adding niacinamide (4-5%) to your routine for mild anti-inflammatory support.',
      'Monitor for flare triggers -- track diet and stress alongside scan data.',
    ],
    Fair: [
      'Introduce an anti-inflammatory active like azelaic acid (10%) or centella extract.',
      'Reduce stress through breathing exercises, meditation, or gentle movement.',
      'Switch to fragrance-free, minimal-ingredient products to reduce irritation sources.',
    ],
    Poor: [
      'Priority: simplify your routine to cleanser, moisturizer, and SPF only.',
      'Stop all active ingredients for 2 weeks to let inflammation settle.',
      'Apply cold compresses to inflamed areas and avoid touching your face.',
      'Consider consulting a dermatologist if inflammation persists beyond 10 days.',
    ],
  },
  sun_damage: {
    Excellent: [
      'Excellent UV protection! Maintain daily SPF 30+ and reapply every 2 hours outdoors.',
      'Continue using antioxidant serums (vitamin C, vitamin E) in your morning routine.',
    ],
    Good: [
      'Ensure you are applying enough sunscreen -- a full teaspoon for the face.',
      'Consider adding a vitamin C serum in the AM for additional photoprotection.',
    ],
    Fair: [
      'Apply broad-spectrum SPF 30+ every morning, even on cloudy days.',
      'Add an antioxidant serum (L-ascorbic acid 15-20%) to neutralize free radicals.',
      'Wear a wide-brim hat and seek shade during peak UV hours (10 AM - 4 PM).',
    ],
    Poor: [
      'Priority: start using SPF 50+ daily and reapply every 90 minutes when outdoors.',
      'Wear protective clothing, wide-brim hat, and UV-blocking sunglasses.',
      'Introduce a potent antioxidant blend (vitamins C + E + ferulic acid) each morning.',
      'Avoid direct sun exposure during peak hours and seek professional assessment.',
    ],
  },
  structure: {
    Excellent: [
      'Your skin structure is strong -- keep up your retinoid and peptide routine.',
      'Maintain consistent sleep and hydration to preserve collagen integrity.',
    ],
    Good: [
      'Consider adding a low-strength retinoid (retinaldehyde or retinol 0.3%) 2-3 nights per week.',
      'Introduce peptide serums to support collagen synthesis alongside your current routine.',
    ],
    Fair: [
      'Start a retinoid (retinol 0.5%) on alternating nights, building tolerance gradually.',
      'Add copper peptides or matrixyl to your PM routine for structural support.',
      'Maintain a consistent routine -- avoid frequent product swaps.',
    ],
    Poor: [
      'Priority: begin with a gentle retinoid (retinyl palmitate) and increase strength over 8 weeks.',
      'Use peptide-rich serums nightly to stimulate collagen and elastin production.',
      'Ensure adequate protein and vitamin C intake to support collagen synthesis from within.',
      'Keep your routine stable for at least 6 weeks before evaluating changes.',
    ],
  },
  elasticity: {
    Excellent: [
      'Your elasticity is excellent -- maintain collagen support with retinoids and peptides.',
      'Continue prioritizing 7-9 hours of sleep for optimal skin repair.',
    ],
    Good: [
      'Consider adding a collagen-boosting supplement (vitamin C, collagen peptides).',
      'Ensure you are getting 7+ hours of quality sleep to support overnight repair.',
    ],
    Fair: [
      'Start a retinoid 2-3 nights per week to stimulate collagen and improve elasticity.',
      'Prioritize sleep hygiene -- aim for 7-9 hours of uninterrupted sleep.',
      'Introduce peptide serums (palmitoyl pentapeptide) for targeted firmness support.',
    ],
    Poor: [
      'Priority: begin a retinoid protocol and commit to nightly peptide application.',
      'Sleep is critical -- optimize for 8+ hours and keep a consistent schedule.',
      'Add bakuchiol as a gentle retinol alternative if your skin is too sensitive for retinoids.',
      'Consider professional treatments (microneedling, LED therapy) for accelerated results.',
    ],
  },
};

// ---------------------------------------------------------------------------
// Gauge — Circle-based for smooth native animation via strokeDashoffset
// ---------------------------------------------------------------------------
const GAUGE_SIZE = 240;
const GAUGE_STROKE = 12;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CENTER = GAUGE_SIZE / 2;
const GAUGE_CIRCUMFERENCE = 2 * Math.PI * GAUGE_RADIUS;
const ARC_FRACTION = 0.75; // 270° arc
const ARC_SPAN = GAUGE_CIRCUMFERENCE * ARC_FRACTION;
const ARC_GAP = GAUGE_CIRCUMFERENCE - ARC_SPAN;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function GaugeArc({ score, color }: { score: number; color: string }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(300, withTiming(score / 100, {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    }));
  }, [score]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ARC_SPAN * (1 - progress.value),
  }));

  return (
    <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
      {/* Background arc */}
      <Circle
        cx={GAUGE_CENTER}
        cy={GAUGE_CENTER}
        r={GAUGE_RADIUS}
        fill="none"
        stroke={Colors.surfaceHighlight}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${ARC_SPAN} ${ARC_GAP}`}
        rotation={135}
        origin={`${GAUGE_CENTER}, ${GAUGE_CENTER}`}
      />
      {/* Animated fill arc */}
      <AnimatedCircle
        cx={GAUGE_CENTER}
        cy={GAUGE_CENTER}
        r={GAUGE_RADIUS}
        fill="none"
        stroke={color}
        strokeWidth={GAUGE_STROKE}
        strokeLinecap="round"
        strokeDasharray={`${ARC_SPAN} ${ARC_GAP}`}
        rotation={135}
        origin={`${GAUGE_CENTER}, ${GAUGE_CENTER}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}

// ---------------------------------------------------------------------------
// Trend chart constants
// ---------------------------------------------------------------------------
const CHART_WIDTH = 300;
const CHART_HEIGHT = 100;
const CHART_PADDING = 8;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function SignalDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();

  const signalKey = (key || 'structure') as SignalKey;
  const color = signalColorByRouteKey(signalKey);
  const label = signalLabelByRouteKey(signalKey);

  const dailyRecords = useStore((s) => s.dailyRecords);
  const modelOutputs = useStore((s) => s.modelOutputs);
  const getLatestOutput = useStore((s) => s.getLatestOutput);

  const latestOutput = getLatestOutput();
  const latestDaily = getLatestDailyForOutput(latestOutput, dailyRecords);

  const insight = useMemo(
    () =>
      buildOverallSkinInsight({
        latestOutput,
        baselineOutput: modelOutputs.length > 0 ? modelOutputs[0] : null,
        latestDaily,
        serverSignalScores: latestOutput?.signal_scores,
        serverSignalFeatures: latestOutput?.signal_features,
        serverSignalConfidence: latestOutput?.signal_confidence,
        serverLesions: latestOutput?.lesions,
      }),
    [latestOutput, latestDaily, modelOutputs],
  );

  const hasData = insight !== null;
  const signalValue = hasData ? insight.signals[signalProperty(signalKey)] : 0;
  const level = levelFromScore(signalValue) as Level;

  // Resolve actual measured values for contributing factors
  const factorValues = useMemo(() => {
    if (!latestOutput || !latestDaily) return {};
    const sources: Record<string, number | undefined> = {
      texture_index: latestDaily.scanner_indices?.texture_index,
      inflammation_index: latestDaily.scanner_indices?.inflammation_index,
      pigmentation_index: latestDaily.scanner_indices?.pigmentation_index,
      acne_score: latestOutput.acne_score,
      sun_damage_score: latestOutput.sun_damage_score,
      skin_age_score: latestOutput.skin_age_score,
      stress_level: latestDaily.stress_level != null ? Number(latestDaily.stress_level) * 20 : undefined,
      sleep_quality: latestDaily.sleep_quality != null ? Number(latestDaily.sleep_quality) * 20 : undefined,
    };
    return sources;
  }, [latestOutput, latestDaily]);

  // Trend data (last 14 days) with dates
  const trendEntries = useMemo(() => {
    const sorted = [...dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
    const last14 = sorted.slice(-14);
    return last14
      .map((record) => {
        const output = modelOutputs.find((o) => o.daily_id === record.daily_id);
        if (!output) return null;
        const dayInsight = buildOverallSkinInsight({
          latestOutput: output,
          baselineOutput: modelOutputs.length > 0 ? modelOutputs[0] : null,
          latestDaily: record,
          serverSignalScores: output?.signal_scores,
          serverSignalFeatures: output?.signal_features,
          serverSignalConfidence: output?.signal_confidence,
          serverLesions: output?.lesions,
        });
        if (!dayInsight) return null;
        return { date: record.date, value: dayInsight.signals[signalProperty(signalKey)] };
      })
      .filter((v): v is { date: string; value: number } => v !== null);
  }, [dailyRecords, modelOutputs, signalKey]);

  const trendData = trendEntries.map((e) => e.value);

  // Trend delta
  const trendDelta = trendData.length >= 2 ? trendData[trendData.length - 1] - trendData[0] : null;
  const trendStartDate = trendEntries.length >= 2 ? trendEntries[0].date : null;
  const trendEndDate = trendEntries.length >= 2 ? trendEntries[trendEntries.length - 1].date : null;

  // Chart geometry
  const { trendPolyline, trendDots } = useMemo(() => {
    if (trendData.length < 2) return { trendPolyline: '', trendDots: [] };
    const minVal = Math.max(0, Math.min(...trendData) - 10);
    const maxVal = Math.min(100, Math.max(...trendData) + 10);
    const range = maxVal - minVal || 1;
    const stepX = (CHART_WIDTH - CHART_PADDING * 2) / (trendData.length - 1);
    const dots: { x: number; y: number }[] = [];
    const polyline = trendData
      .map((val, i) => {
        const x = CHART_PADDING + i * stepX;
        const y = CHART_HEIGHT - CHART_PADDING - ((val - minVal) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
        dots.push({ x, y });
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
    return { trendPolyline: polyline, trendDots: dots };
  }, [trendData]);

  // Entrance animations
  const headerAnim = useCalmFadeIn(0);
  const gaugeAnim = useCalmFadeIn(120);

  const recommendations = RECOMMENDATIONS[signalKey]?.[level] || [];
  const generatedInsight = latestOutput?.generated_insights?.signal_insights?.[signalProperty(signalKey)];

  const formatShortDate = (dateStr: string) => {
    const [, m, d] = dateStr.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Header ── */}
        <Animated.View style={[styles.headerRow, headerAnim]}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Feather name="arrow-left" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={[styles.eyebrow, { color }]}>
            {label.toUpperCase()} SIGNAL
          </Text>
          <View style={styles.headerSpacer} />
        </Animated.View>

        {/* ── Empty state ── */}
        {!hasData && (
          <Animated.View style={[styles.card, gaugeAnim]}>
            <Text style={[styles.cardTitle, styles.centeredText]}>No data yet</Text>
            <Text style={[styles.factorLabel, styles.centeredText]}>
              Complete your first scan to see your {label.toLowerCase()} signal analysis.
            </Text>
          </Animated.View>
        )}

        {hasData && (
          <>
            {/* ── Gauge (Circle with animated strokeDashoffset) ── */}
            <Animated.View style={[styles.gaugeContainer, gaugeAnim]}>
              <GaugeArc score={signalValue} color={color} />
              <View style={styles.gaugeCenter}>
                <Text style={[styles.gaugeScore, { color }]}>{signalValue}</Text>
                <Text style={[styles.gaugeLevel, { color: levelColor(signalValue) }]}>
                  {level}
                </Text>
              </View>
            </Animated.View>

            {/* ── Signal description ── */}
            <Animated.View entering={FadeInDown.delay(150).duration(400)} style={styles.descriptionWrap}>
              <Text style={styles.descriptionText}>
                {SIGNAL_DESCRIPTIONS[signalKey]}
              </Text>
            </Animated.View>

            {/* ── Contributing Factors (with actual values) ── */}
            <Animated.View entering={FadeInDown.delay(250).duration(400)} style={styles.section}>
              <Text style={styles.sectionEyebrow}>CONTRIBUTING FACTORS</Text>
              <Text style={styles.sectionSubtext}>
                These metrics combine to form your {label.toLowerCase()} score.
              </Text>
              {WEIGHT_FACTORS[signalKey].map((factor, i) => {
                const rawValue = factorValues[factor.sourceField];
                const displayVal = rawValue != null ? Math.round(rawValue) : null;
                return (
                  <View key={factor.label} style={styles.factorRow}>
                    <View style={styles.factorLabelRow}>
                      <Text style={styles.factorLabel}>{factor.label}</Text>
                      <View style={styles.factorValues}>
                        {displayVal != null && (
                          <Text style={[styles.factorActual, { color }]}>{displayVal}</Text>
                        )}
                        <Text style={styles.factorPercent}>
                          {Math.round(factor.weight * 100)}%
                        </Text>
                      </View>
                    </View>
                    <AnimatedFillBar score={factor.weight * 100} color={color} delay={350 + i * 100} />
                  </View>
                );
              })}
            </Animated.View>

            {/* ── 14-Day Trend ── */}
            <Animated.View entering={FadeInDown.delay(400).duration(400)} style={styles.card}>
              <View style={styles.trendHeader}>
                <Text style={styles.cardTitle}>14-Day Trend</Text>
                {trendDelta != null && (
                  <View style={styles.deltaChip}>
                    <Feather
                      name={trendDelta >= 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={trendDelta >= 0 ? Colors.success : Colors.error}
                    />
                    <Text style={[styles.deltaText, { color: trendDelta >= 0 ? Colors.success : Colors.error }]}>
                      {trendDelta >= 0 ? '+' : ''}{trendDelta} pts
                    </Text>
                  </View>
                )}
              </View>
              {trendData.length >= 2 ? (
                <>
                  <View style={styles.chartContainer}>
                    <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                      {[0.25, 0.5, 0.75].map((frac) => (
                        <Line
                          key={frac}
                          x1={CHART_PADDING}
                          y1={CHART_PADDING + frac * (CHART_HEIGHT - CHART_PADDING * 2)}
                          x2={CHART_WIDTH - CHART_PADDING}
                          y2={CHART_PADDING + frac * (CHART_HEIGHT - CHART_PADDING * 2)}
                          stroke={Colors.divider}
                          strokeWidth={1}
                        />
                      ))}
                      <Path
                        d={trendPolyline}
                        fill="none"
                        stroke={color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      {trendDots.map((dot, i) => (
                        <Circle key={i} cx={dot.x} cy={dot.y} r={3} fill={color} />
                      ))}
                    </Svg>
                  </View>
                  {/* Date labels */}
                  <View style={styles.chartDates}>
                    <Text style={styles.chartDate}>{formatShortDate(trendStartDate!)}</Text>
                    <Text style={styles.chartDate}>{formatShortDate(trendEndDate!)}</Text>
                  </View>
                </>
              ) : (
                <Text style={styles.noDataText}>
                  Complete at least 2 daily scans to see your trend.
                </Text>
              )}
            </Animated.View>

            {/* ── Recommendations ── */}
            <Animated.View
              entering={FadeInDown.delay(550).duration(400)}
              style={[styles.recsCard, { borderLeftColor: color }]}
            >
              <Text style={styles.cardTitle}>Recommendations</Text>
              {generatedInsight ? (
                <View style={styles.recRow}>
                  <View style={[styles.recDot, { backgroundColor: color }]} />
                  <View style={styles.recContent}>
                    <Text style={styles.recStatus}>{generatedInsight.status}</Text>
                    <Text style={styles.recDriver}>Driver: {generatedInsight.driver}</Text>
                    <Text style={styles.recText}>{generatedInsight.action}</Text>
                  </View>
                </View>
              ) : (
                recommendations.map((rec, i) => (
                  <View key={i} style={styles.recRow}>
                    <View style={[styles.recDot, { backgroundColor: color }]} />
                    <Text style={styles.recText}>{rec}</Text>
                  </View>
                ))
              )}
              <Text style={styles.disclaimer}>
                For informational purposes only. Not medical advice. Consult a dermatologist for diagnosis and treatment.
              </Text>
            </Animated.View>

            {/* ── Clinical Guidelines from RAG ── */}
            {latestOutput?.rag_recommendations && latestOutput.rag_recommendations.length > 0 && (
              <Animated.View
                entering={FadeInDown.delay(700).duration(400)}
                style={[styles.recsCard, { borderLeftColor: Colors.primary }]}
              >
                <Text style={styles.cardTitle}>Clinical Guidelines</Text>
                {latestOutput.rag_recommendations.map((rec, i) => (
                  <View key={i} style={styles.recRow}>
                    <View style={[styles.recDot, { backgroundColor: Colors.primary }]} />
                    <View style={styles.recContent}>
                      <Text style={styles.ragCategory}>
                        {rec.category.replace(/_/g, ' ').toUpperCase()}
                      </Text>
                      <Text style={styles.recText}>{rec.text}</Text>
                    </View>
                  </View>
                ))}
              </Animated.View>
            )}
          </>
        )}

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
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
  scroll: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },

  // Header
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyebrow: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.sm,
    letterSpacing: 2,
  },
  headerSpacer: {
    width: 40,
  },

  // Gauge
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  gaugeCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gaugeScore: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.display,
    lineHeight: FontSize.display + 4,
  },
  gaugeLevel: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.lg,
    marginTop: Spacing.xxs,
  },

  // Signal description
  descriptionWrap: {
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xl,
  },
  descriptionText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: FontSize.sm * 1.6,
  },

  // Sections
  section: {
    marginBottom: Spacing.lg,
  },
  sectionEyebrow: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xxs,
    color: Colors.textMuted,
    letterSpacing: 1.4,
    marginBottom: Spacing.xs,
  },
  sectionSubtext: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },

  // Cards
  card: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  cardTitle: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  centeredText: {
    textAlign: 'center',
  },

  // Contributing factors
  factorRow: {
    marginBottom: Spacing.md,
  },
  factorLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.xs,
  },
  factorLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  factorValues: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  factorActual: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.sm,
  },
  factorPercent: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textDim,
  },

  // Trend chart
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  deltaChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.surfaceOverlay,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
  },
  deltaText: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
  },
  chartContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  chartDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
  },
  chartDate: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xxs,
    color: Colors.textDim,
  },
  noDataText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },

  // Recommendations
  recsCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    borderLeftWidth: 3,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.xs,
    marginTop: 7,
    marginRight: Spacing.sm,
  },
  recContent: {
    flex: 1,
  },
  recStatus: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: FontSize.md * 1.5,
    marginBottom: Spacing.xs,
  },
  recDriver: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: FontSize.sm * 1.5,
    marginBottom: Spacing.xs,
  },
  recText: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: FontSize.md * 1.5,
  },
  ragCategory: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    letterSpacing: 0.8,
    marginBottom: Spacing.xxs,
  },
  disclaimer: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
    lineHeight: FontSize.xs * 1.5,
    marginTop: Spacing.sm,
  },

  bottomPad: {
    height: Spacing.xxl,
  },
});
