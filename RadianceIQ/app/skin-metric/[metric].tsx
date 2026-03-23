import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { Button } from '../../src/components/Button';
import { FaceAssessmentMap } from '../../src/components/FaceAssessmentMap';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../../src/constants/theme';
import {
  buildMetricDetailInsight,
  getLatestDailyForOutput,
  type SeverityLevel,
  type SkinMetricKey,
} from '../../src/services/skinInsights';
import { useStore } from '../../src/store/useStore';

const validMetrics: SkinMetricKey[] = ['acne', 'sun_damage', 'skin_age'];

const severityMeta: Record<SeverityLevel, { label: string; color: string }> = {
  low: { label: 'Low Concern', color: Colors.success },
  moderate: { label: 'Moderate Concern', color: Colors.warning },
  high: { label: 'High Concern', color: Colors.error },
};

const toMetricLabel = (metric: SkinMetricKey) =>
  metric === 'sun_damage' ? 'Sun Damage' : metric === 'skin_age' ? 'Skin Age' : 'Acne';

export default function MetricAssessmentDetail() {
  const router = useRouter();
  const params = useLocalSearchParams<{ metric?: string | string[] }>();
  const modelOutputs = useStore((s) => s.modelOutputs);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const products = useStore((s) => s.products);

  const resolvedMetricParam = Array.isArray(params.metric) ? params.metric[0] : params.metric;
  const metric = validMetrics.includes(resolvedMetricParam as SkinMetricKey)
    ? (resolvedMetricParam as SkinMetricKey)
    : null;

  const latestOutput = modelOutputs.length > 0 ? modelOutputs[modelOutputs.length - 1] : null;
  const latestDaily = getLatestDailyForOutput(latestOutput, dailyRecords);

  const detail = useMemo(
    () =>
      metric
        ? buildMetricDetailInsight({
            metric,
            latestOutput,
            latestDaily,
            products,
          })
        : null,
    [metric, latestOutput, latestDaily, products]
  );

  const [selectedZone, setSelectedZone] = useState('');

  useEffect(() => {
    if (detail?.zones.length) {
      setSelectedZone(detail.zones[0].key);
    }
  }, [detail]);

  const activeZone = detail?.zones.find((zone) => zone.key === selectedZone) || detail?.zones[0];
  const zoneReportMotion = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    zoneReportMotion.setValue(0);
    Animated.timing(zoneReportMotion, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [activeZone?.key, zoneReportMotion]);

  const zoneReportStyle = {
    opacity: zoneReportMotion,
    transform: [
      {
        translateY: zoneReportMotion.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };

  if (!metric) {
    return (
      <AtmosphereScreen scroll={false} contentContainerStyle={styles.invalidLayout}>
        <View style={styles.invalidState}>
          <Text style={styles.invalidTitle}>Unknown metric</Text>
          <Text style={styles.invalidCopy}>This assessment route is invalid. Return to metric insights.</Text>
        </View>
        <Button title="Back to learn more" onPress={() => router.replace('/skin-metrics')} />
      </AtmosphereScreen>
    );
  }

  if (!detail) {
    return (
      <AtmosphereScreen scroll={false} contentContainerStyle={styles.invalidLayout}>
        <View style={styles.invalidState}>
          <Text style={styles.invalidTitle}>{toMetricLabel(metric)} insights unavailable</Text>
          <Text style={styles.invalidCopy}>
            Run at least one scan to unlock this detailed assessment.
          </Text>
        </View>
        <Button title="Start scan" onPress={() => router.push('/scan/camera')} />
      </AtmosphereScreen>
    );
  }

  const severityInfo = severityMeta[detail.severity];

  return (
    <AtmosphereScreen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>{detail.title} assessment</Text>
        <Text style={styles.title}>{detail.title} detailed view</Text>
        <Text style={styles.subtitle}>
          Face-model overlays show where this metric is most active right now.
        </Text>
      </View>

      <View style={styles.scoreCard}>
        <Text style={styles.scoreLabel}>{detail.title} score</Text>
        <View style={styles.scoreRow}>
          <Text style={styles.scoreValue}>{detail.score}</Text>
          <Text style={[styles.severityPill, { color: severityInfo.color }]}>{severityInfo.label}</Text>
        </View>
        <Text style={styles.scoreSummary}>{detail.summary}</Text>
      </View>

      <View style={styles.mapCard}>
        <FaceAssessmentMap
          zones={detail.zones}
          selectedZoneKey={activeZone?.key || detail.zones[0].key}
          onSelectZone={setSelectedZone}
          lesions={latestOutput?.lesions?.length ? latestOutput.lesions : undefined}
        />
        <View style={styles.zoneTabs}>
          {detail.zones.map((zone) => {
            const selected = zone.key === activeZone?.key;
            return (
              <TouchableOpacity
                key={zone.key}
                activeOpacity={0.85}
                style={[styles.zoneTab, selected && styles.zoneTabActive]}
                onPress={() => setSelectedZone(zone.key)}
              >
                <Text style={[styles.zoneTabText, selected && styles.zoneTabTextActive]}>
                  {zone.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {activeZone ? (
        <Animated.View style={[styles.zoneReportCard, zoneReportStyle]}>
          <Text style={styles.zoneReportTitle}>{activeZone.label} finding</Text>
          <Text style={styles.zoneReportCopy}>{activeZone.summary}</Text>
          <Text style={styles.zoneAction}>{activeZone.recommendation}</Text>
        </Animated.View>
      ) : null}

      <View style={styles.productCard}>
        <Text style={styles.productTitle}>Detailed report and product guidance</Text>
        <Text style={styles.productBody}>{detail.report}</Text>
        <View style={styles.recommendationStack}>
          <View style={styles.recommendationRow}>
            <Text style={styles.recommendationLabel}>Stop using</Text>
            <Text style={styles.recommendationText}>
              {latestOutput?.generated_insights?.product_guidance?.stop || detail.stopUsing}
            </Text>
          </View>
          <View style={styles.recommendationRow}>
            <Text style={styles.recommendationLabel}>Consider using</Text>
            <Text style={styles.recommendationText}>
              {latestOutput?.generated_insights?.product_guidance?.consider || detail.considerUsing}
            </Text>
          </View>
          <View style={styles.recommendationRow}>
            <Text style={styles.recommendationLabel}>Continue</Text>
            <Text style={styles.recommendationText}>
              {latestOutput?.generated_insights?.product_guidance?.continue || detail.continueUsing}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.disclaimer}>
        For informational purposes only. Not medical advice. Consult a dermatologist for diagnosis and treatment.
      </Text>

      <Button title="Back to all metrics" variant="ghost" onPress={() => router.back()} />
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  title: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.hero,
    lineHeight: 41,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  scoreCard: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  scoreLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  scoreValue: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.display,
    lineHeight: 52,
  },
  severityPill: {
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  scoreSummary: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  mapCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  zoneTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  zoneTab: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  zoneTabActive: {
    backgroundColor: Colors.surfaceHighlight,
    borderColor: Colors.borderStrong,
  },
  zoneTabText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
  zoneTabTextActive: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
  },
  zoneReportCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  zoneReportTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  zoneReportCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  zoneAction: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  productCard: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  productTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  productBody: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  recommendationStack: {
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  recommendationRow: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.sm,
    gap: Spacing.xs,
  },
  recommendationLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.9,
  },
  recommendationText: {
    color: Colors.text,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  invalidLayout: {
    justifyContent: 'space-between',
  },
  invalidState: {
    gap: Spacing.sm,
  },
  invalidTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  invalidCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  disclaimer: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sans,
    fontStyle: 'italic',
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.5,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
});
