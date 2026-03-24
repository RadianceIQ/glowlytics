import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { router as globalRouter } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AtmosphereScreen } from '../src/components/AtmosphereScreen';
import { Button } from '../src/components/Button';
import { SkinScoreHero } from '../src/components/SkinScoreHero';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Surfaces,
  Spacing,
} from '../src/constants/theme';
import { signalColorByRouteKey } from '../src/constants/signals';
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

  const getStreak = useStore((s) => s.getStreak);
  const streak = useMemo(() => getStreak(), [dailyRecords, getStreak]);


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
              accessibilityRole="button"
              accessibilityLabel={`${stat.label} signal, score ${stat.value ?? 'no data'}`}
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

      {streak > 0 && (
        <View style={styles.streakRow}>
          <Text style={styles.streakValue}>{streak} day streak</Text>
          <Text style={styles.streakDot}> · </Text>
          <Text style={styles.streakHint}>
            {protocol?.scan_region
              ? `${protocol.scan_region.replace(/_/g, ' ')} region`
              : 'Keep scanning daily'}
          </Text>
        </View>
      )}

      {latestOutput ? (
        <View style={styles.metricRow}>
          {[
            { label: 'Acne', score: latestOutput.acne_score, color: Colors.acne },
            { label: 'Sun Damage', score: latestOutput.sun_damage_score, color: Colors.sunDamage },
            { label: 'Skin Age', score: latestOutput.skin_age_score, color: Colors.skinAge },
          ].map((m) => (
            <TouchableOpacity
              key={m.label}
              style={styles.metricPill}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel={`${m.label} score ${m.score}`}
              onPress={() => router.push('/skin-metrics')}
            >
              <View style={[styles.metricDot, { backgroundColor: m.color }]} />
              <Text style={styles.metricPillLabel}>{m.label}</Text>
              <Text style={[styles.metricPillScore, { color: m.color }]}>{m.score}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No scan data yet</Text>
          <Text style={styles.emptyCopy}>
            Your first baseline will unlock trends and the detailed assessment flow.
          </Text>
        </View>
      )}
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
    ...Surfaces.hero,
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
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.xs,
  },
  streakValue: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  streakDot: {
    color: Colors.textDim,
    fontSize: FontSize.sm,
  },
  streakHint: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
  },
  metricRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  metricPill: {
    flex: 1,
    ...Surfaces.recessed,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm + 2,
    gap: Spacing.xs,
  },
  metricDot: {
    width: 6,
    height: 6,
    borderRadius: BorderRadius.xs,
  },
  metricPillLabel: {
    flex: 1,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xxs,
  },
  metricPillScore: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.sm,
  },
  emptyState: {
    ...Surfaces.standard,
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
});
