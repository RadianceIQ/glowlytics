import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router as globalRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AtmosphereScreen } from '../src/components/AtmosphereScreen';
import { Button } from '../src/components/Button';
import { GamificationCard } from '../src/components/GamificationCard';
import { ScoreTile } from '../src/components/ScoreTile';
import { SkinScoreHero } from '../src/components/SkinScoreHero';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../src/constants/theme';
import { formatMetricStatus, signalColorByRouteKey } from '../src/constants/signals';
import {
  buildOverallSkinInsight,
  getLatestDailyForOutput,
} from '../src/services/skinInsights';
import { useStore } from '../src/store/useStore';
import { presentPaywall, checkSubscriptionStatus } from '../src/services/subscription';

interface TopStat {
  key: string;
  label: string;
  value: number | null;
  color: string;
  icon: string;
}

const clampScore = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

const ringSize = 78;
const ringStroke = 5;

const TopStatRing: React.FC<{ value: number | null; color: string; icon: string }> = ({ value, color, icon }) => {
  const hasData = value !== null;
  const displayValue = hasData ? clampScore(value) : 0;
  const radius = (ringSize - ringStroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ringSpan = circumference * 0.84;
  const gap = circumference - ringSpan;
  const progressSpan = hasData ? ringSpan * (displayValue / 100) : 0;
  const center = ringSize / 2;
  const rotation = `rotate(128 ${center} ${center})`;

  return (
    <View style={styles.statRingWrap}>
      <Svg width={ringSize} height={ringSize}>
        <Circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={Colors.borderStrong}
          strokeWidth={ringStroke}
          strokeLinecap="round"
          strokeDasharray={`${ringSpan} ${gap}`}
          transform={rotation}
        />
        {hasData && (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={ringStroke}
            strokeLinecap="round"
            strokeDasharray={`${progressSpan} ${circumference}`}
            transform={rotation}
          />
        )}
      </Svg>
      <View style={styles.statRingCenter} pointerEvents="none">
        <Text style={[styles.statValue, !hasData && { color: Colors.textDim }]}>
          {hasData ? displayValue : '--'}
        </Text>
        <MaterialCommunityIcons name={icon as any} size={18} color={hasData ? color : Colors.textDim} />
      </View>
    </View>
  );
};

export default function Home() {
  const router = globalRouter;
  const protocol = useStore((s) => s.protocol);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const modelOutputs = useStore((s) => s.modelOutputs);
  const gamification = useStore((s) => s.gamification);
  const canPerformScan = useStore((s) => s.canPerformScan);

  const handleScanPress = async (path: string) => {
    if (!canPerformScan()) {
      const purchased = await presentPaywall();
      if (purchased) {
        const sub = await checkSubscriptionStatus(useStore.getState().subscription);
        useStore.getState().setSubscription(sub);
      }
      if (!useStore.getState().canPerformScan()) return;
    }
    router.push(path as any);
  };

  const latestOutput = modelOutputs.length > 0 ? modelOutputs[modelOutputs.length - 1] : null;
  const baseline = modelOutputs.length > 0 ? modelOutputs[0] : null;
  const latestDaily = getLatestDailyForOutput(latestOutput, dailyRecords);

  const streak = useMemo(() => {
    const sorted = [...dailyRecords].sort((a, b) => b.date.localeCompare(a.date));
    if (sorted.length === 0) return 0;

    let value = 0;
    const today = new Date();

    for (let i = 0; i < sorted.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      if (sorted.find((record) => record.date === expectedStr)) {
        value += 1;
      } else {
        break;
      }
    }

    return value;
  }, [dailyRecords]);

  const outputHistory = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const records = dailyRecords.filter((record) => record.date >= cutoffStr);
    const ids = new Set(records.map((record) => record.daily_id));
    return modelOutputs.filter((output) => ids.has(output.daily_id));
  }, [dailyRecords, modelOutputs]);

  const acneHistory = useMemo(() => outputHistory.map((o) => o.acne_score), [outputHistory]);
  const sunHistory = useMemo(() => outputHistory.map((o) => o.sun_damage_score), [outputHistory]);
  const ageHistory = useMemo(() => outputHistory.map((o) => o.skin_age_score), [outputHistory]);

  const overallInsight = useMemo(
    () =>
      buildOverallSkinInsight({
        latestOutput,
        baselineOutput: baseline,
        latestDaily,
        serverSignalScores: latestOutput?.signal_scores,
        serverSignalFeatures: latestOutput?.signal_features,
        serverSignalConfidence: latestOutput?.signal_confidence,
        serverLesions: latestOutput?.lesions,
      }),
    [latestOutput, baseline, latestDaily]
  );

  const topStats = useMemo<TopStat[]>(() => {
    const s = overallInsight?.signals;
    return [
      { key: 'hydration', label: 'Hydration', value: s?.hydration ?? null, color: signalColorByRouteKey('hydration'), icon: 'water-outline' },
      { key: 'elasticity', label: 'Elasticity', value: s?.elasticity ?? null, color: signalColorByRouteKey('elasticity'), icon: 'arrow-expand-horizontal' },
      { key: 'inflammation', label: 'Inflammation', value: s?.inflammation ?? null, color: signalColorByRouteKey('inflammation'), icon: 'fire' },
      { key: 'sun_damage', label: 'Sun Damage', value: s?.sunDamage ?? null, color: signalColorByRouteKey('sun_damage'), icon: 'weather-sunny' },
      { key: 'structure', label: 'Structure', value: s?.structure ?? null, color: signalColorByRouteKey('structure'), icon: 'waves' },
    ];
  }, [overallInsight]);

  return (
    <AtmosphereScreen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Today</Text>
        <Text style={styles.date}>
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
      </View>

      <View style={styles.summaryRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.summaryRowContent}>
          {topStats.map((stat) => (
            <TouchableOpacity
              key={stat.key}
              style={styles.summaryStat}
              activeOpacity={0.7}
              onPress={() => router.push({ pathname: '/signal/[key]', params: { key: stat.key } })}
            >
              <TopStatRing value={stat.value} color={stat.color} icon={stat.icon} />
              <Text style={styles.summaryLabel}>{stat.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {overallInsight ? (
        <SkinScoreHero
          score={overallInsight.score}
          statusLabel={overallInsight.statusLabel}
          actionStatement={overallInsight.actionStatement}
          trendDelta={overallInsight.trendDelta}
          signals={overallInsight.signals}
          onViewResults={() => router.push('/scan/results')}
        />
      ) : (
        <View style={styles.emptyHero}>
          <Text style={styles.emptyHeroTitle}>Build your first baseline</Text>
          <Text style={styles.emptyHeroCopy}>
            Your overall skin score unlocks after your first scan. Start now to track structure, hydration, inflammation, sun damage, and elasticity.
          </Text>
          <View style={styles.emptyHeroActions}>
            <Button title="Start first scan" onPress={() => handleScanPress('/scan/camera')} />
          </View>
        </View>
      )}

      <View style={styles.infoCard}>
        <Text style={styles.infoEyebrow}>Cadence</Text>
        <Text style={styles.infoValue}>{streak} day streak</Text>
        <Text style={styles.infoCopy}>
          {protocol?.scan_region
            ? `Same-region scans on ${protocol.scan_region.replace(/_/g, ' ')} keep the trend cleaner.`
            : 'Choose a consistent region for cleaner signal tracking.'}
        </Text>
      </View>

      <GamificationCard gamification={gamification} streak={streak} />

      {latestOutput ? (
        <View style={styles.metricStack}>
          <ScoreTile
            label="Acne"
            score={latestOutput.acne_score}
            delta={baseline ? latestOutput.acne_score - baseline.acne_score : undefined}
            color={Colors.acne}
            sparklineData={acneHistory}
            compact
            lowLabel="Baseline"
            highLabel="Today"
            statusLabel={formatMetricStatus(latestOutput.acne_score)}
          />
          <ScoreTile
            label="Sun Damage"
            score={latestOutput.sun_damage_score}
            delta={baseline ? latestOutput.sun_damage_score - baseline.sun_damage_score : undefined}
            color={Colors.sunDamage}
            sparklineData={sunHistory}
            compact
            lowLabel="Baseline"
            highLabel="Today"
            statusLabel={formatMetricStatus(latestOutput.sun_damage_score)}
          />
          <ScoreTile
            label="Skin Age"
            score={latestOutput.skin_age_score}
            delta={baseline ? latestOutput.skin_age_score - baseline.skin_age_score : undefined}
            color={Colors.skinAge}
            sparklineData={ageHistory}
            compact
            lowLabel="Baseline"
            highLabel="Today"
            statusLabel={formatMetricStatus(latestOutput.skin_age_score)}
          />
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No scan data yet</Text>
          <Text style={styles.emptyCopy}>
            Your first baseline will unlock this dashboard and the detailed assessment flow.
          </Text>
        </View>
      )}


      <View style={styles.utilityStrip}>
        <TouchableOpacity style={styles.utilityAction} onPress={() => router.push('/report/generate')}>
          <Text style={styles.utilityLabel}>Share report</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.utilityAction} onPress={() => router.push('/onboarding/products')}>
          <Text style={styles.utilityLabel}>Products</Text>
        </TouchableOpacity>
      </View>
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  date: {
    marginTop: Spacing.xs,
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  summaryRow: {
    marginBottom: Spacing.lg,
    marginHorizontal: -Spacing.lg,
  },
  summaryRowContent: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  summaryStat: {
    width: 86,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statRingWrap: {
    width: ringSize,
    height: ringSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statRingCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  statValue: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
    lineHeight: 24,
    marginBottom: 1,
  },
  summaryLabel: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    letterSpacing: 0.4,
    textAlign: 'center',
  },
  emptyHero: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  emptyHeroTitle: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.xxl,
  },
  emptyHeroCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
  },
  emptyHeroActions: {
    gap: Spacing.sm,
  },
  infoCard: {
    backgroundColor: Colors.glass,
    marginBottom: Spacing.lg,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  infoEyebrow: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
    textTransform: 'capitalize',
  },
  infoCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  metricStack: {
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyState: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
  },
  emptyCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  utilityStrip: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  utilityAction: {
    flex: 1,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    alignItems: 'center',
  },
  utilityLabel: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
});
