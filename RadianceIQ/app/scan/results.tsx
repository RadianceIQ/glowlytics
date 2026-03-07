import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScoreTile } from '../../src/components/ScoreTile';
import { ActionCard } from '../../src/components/ActionCard';
import { ConfidenceBadge } from '../../src/components/ConfidenceBadge';
import { useStore } from '../../src/store/useStore';
import { getExplanation } from '../../src/services/skinAnalysis';

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
    const records = dailyRecords.filter((r) => r.date >= cutoffStr);
    const dailyIds = new Set(records.map((r) => r.daily_id));
    return allOutputs.filter((o) => dailyIds.has(o.daily_id));
  }, [dailyRecords, allOutputs]);

  if (!latestOutput) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>No results yet</Text>
        <Button title="Go back" onPress={() => router.back()} />
      </View>
    );
  }

  const baseline = allOutputs.length > 0 ? allOutputs[0] : null;
  const acneDelta = baseline ? latestOutput.acne_score - baseline.acne_score : 0;
  const sunDelta = baseline ? latestOutput.sun_damage_score - baseline.sun_damage_score : 0;
  const ageDelta = baseline ? latestOutput.skin_age_score - baseline.skin_age_score : 0;

  const acneHistory = outputHistory.map((o) => o.acne_score);
  const sunHistory = outputHistory.map((o) => o.sun_damage_score);
  const ageHistory = outputHistory.map((o) => o.skin_age_score);

  // Get latest daily record for context
  const latestDaily = dailyRecords.length > 0 ? dailyRecords[dailyRecords.length - 1] : null;

  const explanation = getExplanation(latestOutput, {
    sunscreen: latestDaily?.sunscreen_used ?? true,
    cycleWindow: latestOutput.primary_driver === 'cycle window',
    newProduct: latestDaily?.new_product_added ?? false,
    sleepQuality: latestDaily?.sleep_quality,
  });

  const handleDone = () => {
    disconnectScanner();
    router.replace('/home');
  };

  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Today's Results</Text>

      {/* Confidence */}
      <ConfidenceBadge level={latestOutput.confidence} />

      {/* Score tiles */}
      <View style={styles.tiles}>
        <ScoreTile
          label="Acne"
          score={latestOutput.acne_score}
          delta={acneDelta}
          color={Colors.acne}
          sparklineData={acneHistory}
        />
        <ScoreTile
          label="Sun Damage"
          score={latestOutput.sun_damage_score}
          delta={sunDelta}
          color={Colors.sunDamage}
          sparklineData={sunHistory}
        />
        <ScoreTile
          label="Skin Age"
          score={latestOutput.skin_age_score}
          delta={ageDelta}
          color={Colors.skinAge}
          sparklineData={ageHistory}
        />
      </View>

      {/* Explanation */}
      <View style={styles.explanationCard}>
        <Text style={styles.explanationTitle}>What this means</Text>
        <Text style={styles.explanationText}>{explanation}</Text>
      </View>

      {/* Action card */}
      <ActionCard
        driver={latestOutput.primary_driver || 'insight'}
        action={latestOutput.recommended_action}
        escalation={latestOutput.escalation_flag}
      />

      {/* Escalation */}
      {latestOutput.escalation_flag && (
        <View style={styles.escalationCard}>
          <Text style={styles.escalationText}>
            Your metrics changed rapidly and the trend is unusual for your baseline.
            This isn't a diagnosis, but it may be worth sharing a report with a clinician for context.
          </Text>
          <Button
            title="Share Report"
            variant="secondary"
            onPress={() => router.push('/report/generate')}
            small
          />
        </View>
      )}

      {/* Disconnect scanner toast */}
      <View style={styles.disconnectCard}>
        <Text style={styles.disconnectText}>Scan complete. Disconnect scanner?</Text>
        <View style={styles.disconnectButtons}>
          <Button
            title="Disconnect now"
            onPress={handleDone}
            small
          />
          <Button
            title="Keep connected"
            variant="ghost"
            onPress={() => router.replace('/home')}
            small
          />
        </View>
      </View>

      <View style={styles.bottom}>
        <Button title="Log done" onPress={handleDone} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  tiles: {
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  explanationCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  explanationTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  explanationText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  escalationCard: {
    backgroundColor: Colors.warning + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.md,
    gap: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.warning,
  },
  escalationText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  disconnectCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  disconnectText: {
    color: Colors.text,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  disconnectButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  bottom: {
    marginTop: Spacing.lg,
  },
});
