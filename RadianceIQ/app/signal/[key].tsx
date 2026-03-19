import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle, Path, Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  Easing,
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
import type { CompositeSignals } from '../../src/services/skinInsights';

type SignalKey = 'hydration' | 'elasticity' | 'inflammation' | 'sun_damage' | 'structure';

/** Map route key to the CompositeSignals property name. */
const signalProperty = (key: SignalKey): keyof CompositeSignals => toSignalKey(key);

// ---------------------------------------------------------------------------
// Contributing factor weights per signal
// ---------------------------------------------------------------------------

interface WeightFactor {
  label: string;
  weight: number; // 0-1
}

const WEIGHT_FACTORS: Record<SignalKey, WeightFactor[]> = {
  structure: [
    { label: 'Texture Index', weight: 0.55 },
    { label: 'Skin Age', weight: 0.45 },
  ],
  hydration: [
    { label: 'Texture Index', weight: 0.5 },
    { label: 'Acne Risk', weight: 0.2 },
    { label: 'Stress Level', weight: 0.15 },
    { label: 'Sleep Quality', weight: 0.15 },
  ],
  inflammation: [
    { label: 'Inflammation Index', weight: 0.8 },
    { label: 'Acne Risk', weight: 0.2 },
  ],
  sun_damage: [
    { label: 'Sun Damage Score', weight: 0.82 },
    { label: 'Pigmentation Index', weight: 0.18 },
  ],
  elasticity: [
    { label: 'Skin Age', weight: 0.62 },
    { label: 'Texture Index', weight: 0.38 },
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
// SVG arc gauge helpers
// ---------------------------------------------------------------------------

const GAUGE_SIZE = 280;
const GAUGE_STROKE = 14;
const GAUGE_RADIUS = (GAUGE_SIZE - GAUGE_STROKE) / 2;
const GAUGE_CENTER = GAUGE_SIZE / 2;

/** Degrees covered by the arc (270 degrees, gap at the bottom). */
const ARC_DEGREES = 270;
const ARC_START_ANGLE = 135; // start from lower-left

const polarToCartesian = (cx: number, cy: number, r: number, angleDeg: number) => {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
};

const describeArc = (cx: number, cy: number, r: number, startAngle: number, endAngle: number) => {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SignalDetailScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const router = useRouter();

  const signalKey = (key || 'structure') as SignalKey;
  const color = signalColorByRouteKey(signalKey);
  const label = signalLabelByRouteKey(signalKey);

  // ---- Store data ----
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

  const signalValue = insight ? insight.signals[signalProperty(signalKey)] : 0;
  const level = levelFromScore(signalValue) as Level;

  // ---- Gauge animation ----
  const animatedSweep = useSharedValue(0);

  useEffect(() => {
    animatedSweep.value = withDelay(
      300,
      withTiming(signalValue, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      }),
    );
  }, [signalValue]);

  // ---- Trend data (last 14 days) ----
  const trendData = useMemo(() => {
    const sorted = [...dailyRecords].sort((a, b) => a.date.localeCompare(b.date));
    const last14 = sorted.slice(-14);

    return last14.map((record) => {
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

      return dayInsight ? dayInsight.signals[signalProperty(signalKey)] : null;
    }).filter((v): v is number => v !== null);
  }, [dailyRecords, modelOutputs, signalKey]);

  // ---- Staggered entrance animations ----
  const headerAnim = useCalmFadeIn(0);
  const gaugeAnim = useCalmFadeIn(120);
  const factorsAnim = useCalmFadeIn(240);
  const trendAnim = useCalmFadeIn(360);
  const recsAnim = useCalmFadeIn(480);

  // ---- Gauge arc paths ----
  const bgArcPath = describeArc(
    GAUGE_CENTER,
    GAUGE_CENTER,
    GAUGE_RADIUS,
    ARC_START_ANGLE,
    ARC_START_ANGLE + ARC_DEGREES,
  );

  // We need to render the filled arc natively via reanimated props.
  // Since react-native-svg does not directly support Reanimated shared values
  // on Path 'd', we render a static arc based on signalValue and rely on the
  // container's opacity animation for the visual entrance. The actual arc fill
  // is animated by mounting with a useEffect-driven state approach.
  const [displayValue, setDisplayValue] = React.useState(0);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDisplayValue(signalValue);
    }, 350);
    return () => clearTimeout(timeout);
  }, [signalValue]);

  const fillSweep = (displayValue / 100) * ARC_DEGREES;
  const fillArcPath =
    fillSweep > 0.5
      ? describeArc(
          GAUGE_CENTER,
          GAUGE_CENTER,
          GAUGE_RADIUS,
          ARC_START_ANGLE,
          ARC_START_ANGLE + fillSweep,
        )
      : '';

  // ---- Trend chart polyline ----
  const CHART_WIDTH = 300;
  const CHART_HEIGHT = 100;
  const CHART_PADDING = 8;

  const trendPolyline = useMemo(() => {
    if (trendData.length < 2) return '';
    const minVal = Math.max(0, Math.min(...trendData) - 10);
    const maxVal = Math.min(100, Math.max(...trendData) + 10);
    const range = maxVal - minVal || 1;
    const stepX = (CHART_WIDTH - CHART_PADDING * 2) / (trendData.length - 1);

    return trendData
      .map((val, i) => {
        const x = CHART_PADDING + i * stepX;
        const y = CHART_HEIGHT - CHART_PADDING - ((val - minVal) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
        return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(' ');
  }, [trendData]);

  // ---- Recommendations (prefer server-generated, fall back to hardcoded) ----
  const serverSignalRecs = latestOutput?.signal_recommendations?.[signalKey];
  const recommendations = (serverSignalRecs && serverSignalRecs.length > 0)
    ? serverSignalRecs
    : (RECOMMENDATIONS[signalKey]?.[level] || []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        {/* ---- Header ---- */}
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
          <View style={{ width: 40 }} />
        </Animated.View>

        {/* ---- Gauge ---- */}
        <Animated.View style={[styles.gaugeContainer, gaugeAnim]}>
          <Svg width={GAUGE_SIZE} height={GAUGE_SIZE}>
            {/* Background arc */}
            <Path
              d={bgArcPath}
              fill="none"
              stroke={Colors.surfaceHighlight}
              strokeWidth={GAUGE_STROKE}
              strokeLinecap="round"
            />
            {/* Filled arc */}
            {fillArcPath.length > 0 && (
              <Path
                d={fillArcPath}
                fill="none"
                stroke={color}
                strokeWidth={GAUGE_STROKE}
                strokeLinecap="round"
              />
            )}
          </Svg>
          <View style={styles.gaugeCenter}>
            <Text style={[styles.gaugeScore, { color }]}>{signalValue}</Text>
            <Text style={[styles.gaugeLevel, { color: levelColor(signalValue) }]}>
              {level}
            </Text>
          </View>
        </Animated.View>

        {/* ---- Contributing Factors ---- */}
        <Animated.View style={[styles.card, factorsAnim]}>
          <Text style={styles.cardTitle}>Contributing Factors</Text>
          {WEIGHT_FACTORS[signalKey].map((factor, i) => (
            <View key={factor.label} style={styles.factorRow}>
              <View style={styles.factorLabelRow}>
                <Text style={styles.factorLabel}>{factor.label}</Text>
                <Text style={styles.factorPercent}>
                  {Math.round(factor.weight * 100)}%
                </Text>
              </View>
              <View style={styles.factorBarBg}>
                <View
                  style={[
                    styles.factorBarFill,
                    {
                      width: `${Math.round(factor.weight * 100)}%`,
                      backgroundColor: color,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </Animated.View>

        {/* ---- Trend Chart ---- */}
        <Animated.View style={[styles.card, trendAnim]}>
          <Text style={styles.cardTitle}>14-Day Trend</Text>
          {trendData.length >= 2 ? (
            <View style={styles.chartContainer}>
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                {/* Horizontal grid lines */}
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
                {/* Signal line */}
                <Path
                  d={trendPolyline}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {trendData.map((val, i) => {
                  const minVal = Math.max(0, Math.min(...trendData) - 10);
                  const maxVal = Math.min(100, Math.max(...trendData) + 10);
                  const range = maxVal - minVal || 1;
                  const stepX = (CHART_WIDTH - CHART_PADDING * 2) / (trendData.length - 1);
                  const x = CHART_PADDING + i * stepX;
                  const y =
                    CHART_HEIGHT -
                    CHART_PADDING -
                    ((val - minVal) / range) * (CHART_HEIGHT - CHART_PADDING * 2);
                  return (
                    <Circle
                      key={i}
                      cx={x}
                      cy={y}
                      r={3}
                      fill={color}
                    />
                  );
                })}
              </Svg>
            </View>
          ) : (
            <Text style={styles.noDataText}>
              Not enough data yet. Complete at least 2 daily scans to see your trend.
            </Text>
          )}
        </Animated.View>

        {/* ---- Recommendations ---- */}
        <Animated.View style={[styles.card, recsAnim]}>
          <Text style={styles.cardTitle}>Recommendations</Text>
          {recommendations.map((rec, i) => (
            <View key={i} style={styles.recRow}>
              <View style={[styles.recDot, { backgroundColor: color }]} />
              <Text style={styles.recText}>{rec}</Text>
            </View>
          ))}
        </Animated.View>

        {/* ---- Disclaimer ---- */}
        <Text style={styles.disclaimer}>
          For informational purposes only — not medical advice. Consult a dermatologist for diagnosis or treatment.
        </Text>

        {/* ---- Clinical Guidelines from RAG ---- */}
        {latestOutput?.rag_recommendations && latestOutput.rag_recommendations.length > 0 && (
          <Animated.View style={[styles.card, recsAnim]}>
            <Text style={styles.cardTitle}>Clinical Guidelines</Text>
            {latestOutput.rag_recommendations.map((rec, i) => (
              <View key={i} style={styles.recRow}>
                <View style={[styles.recDot, { backgroundColor: Colors.primary }]} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.recText, { fontSize: FontSize.xs, color: Colors.textMuted, marginBottom: 2 }]}>
                    {rec.category.replace(/_/g, ' ').toUpperCase()}
                  </Text>
                  <Text style={styles.recText}>{rec.text}</Text>
                </View>
              </View>
            ))}
          </Animated.View>
        )}

        <View style={{ height: Spacing.xxl }} />
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
    marginBottom: Spacing.lg,
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

  // Gauge
  gaugeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
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

  // Contributing factors
  factorRow: {
    marginBottom: Spacing.md,
  },
  factorLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  factorLabel: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  factorPercent: {
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  factorBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.surfaceHighlight,
    overflow: 'hidden',
  },
  factorBarFill: {
    height: 6,
    borderRadius: 3,
  },

  // Trend chart
  chartContainer: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  noDataText: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },

  // Recommendations
  recRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  recDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 7,
    marginRight: Spacing.sm,
  },
  recText: {
    flex: 1,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: FontSize.md * 1.5,
  },
  disclaimer: {
    fontFamily: FontFamily.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: FontSize.xs * 1.5,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.lg,
  },
});
