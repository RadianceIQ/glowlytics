import React, { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { ActionCard } from '../../src/components/ActionCard';
import { Button } from '../../src/components/Button';
import { ConfidenceBadge } from '../../src/components/ConfidenceBadge';
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

export default function Results() {
  const router = useRouter();
  const allOutputs = useStore((s) => s.modelOutputs);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const disconnectScanner = useStore((s) => s.disconnectScanner);

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
            Capture a scan first so RadianceIQ can generate your trend summary.
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
  const explanation = getExplanation(latestOutput, {
    sunscreen: latestDaily?.sunscreen_used ?? true,
    cycleWindow: latestOutput.primary_driver === 'cycle window',
    newProduct: latestDaily?.new_product_added ?? false,
    sleepQuality: latestDaily?.sleep_quality,
  });

  const handleDone = () => {
    disconnectScanner();
    router.replace('/(tabs)/today');
  };

  return (
    <AtmosphereScreen>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>Results</Text>
          <Text style={styles.title}>Today’s scan outcome</Text>
        </View>
        <TouchableOpacity style={styles.inlineAction} onPress={() => router.push('/report/generate')}>
          <Text style={styles.inlineActionText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.metaRow}>
        <ConfidenceBadge level={latestOutput.confidence} />
        <Text style={styles.metaText}>
          Driver: {(latestOutput.primary_driver || 'daily insight').replace(/_/g, ' ')}
        </Text>
      </View>

      <ActionCard
        driver={latestOutput.primary_driver || 'daily insight'}
        action={explanation}
        supportingText={latestOutput.recommended_action}
        mode="hero"
      />

      <View style={styles.metricStack}>
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
      </View>

      {latestOutput.escalation_flag ? (
        <View style={styles.alertStrip}>
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
        </View>
      ) : null}

      <View style={styles.disconnectStrip}>
        <View>
          <Text style={styles.disconnectTitle}>Scanner session</Text>
          <Text style={styles.disconnectCopy}>
            Disconnect now, or keep the simulated device live for another pass.
          </Text>
        </View>
        <View style={styles.disconnectActions}>
          <Button title="Disconnect" onPress={handleDone} size="sm" />
          <Button title="Keep live" variant="ghost" onPress={() => router.replace('/(tabs)/today')} size="sm" />
        </View>
      </View>

      <View style={styles.bottomAction}>
        <Button title="Log done" onPress={handleDone} size="lg" />
      </View>
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
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
  inlineAction: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  inlineActionText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
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
  disconnectStrip: {
    marginTop: Spacing.lg,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  disconnectTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  disconnectCopy: {
    marginTop: Spacing.xs,
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  disconnectActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
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
