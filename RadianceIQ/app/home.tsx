import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../src/constants/theme';
import { Button } from '../src/components/Button';
import { ScoreTile } from '../src/components/ScoreTile';
import { ActionCard } from '../src/components/ActionCard';
import { ConfidenceBadge } from '../src/components/ConfidenceBadge';
import { useStore } from '../src/store/useStore';

export default function Home() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const latestOutput = useStore((s) => s.getLatestOutput());
  const streak = useStore((s) => s.getStreak());
  const outputHistory = useStore((s) => s.getOutputHistory(7));
  const dailyRecords = useStore((s) => s.dailyRecords);

  const todayStr = new Date().toISOString().split('T')[0];
  const scannedToday = dailyRecords.some((r) => r.date === todayStr);

  const acneHistory = outputHistory.map((o) => o.acne_score);
  const sunHistory = outputHistory.map((o) => o.sun_damage_score);
  const ageHistory = outputHistory.map((o) => o.skin_age_score);

  // Calculate deltas from baseline (first output)
  const allOutputs = useStore((s) => s.modelOutputs);
  const baseline = allOutputs.length > 0 ? allOutputs[0] : null;
  const acneDelta = latestOutput && baseline
    ? latestOutput.acne_score - baseline.acne_score : undefined;
  const sunDelta = latestOutput && baseline
    ? latestOutput.sun_damage_score - baseline.sun_damage_score : undefined;
  const ageDelta = latestOutput && baseline
    ? latestOutput.skin_age_score - baseline.skin_age_score : undefined;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>RadianceIQ</Text>
          <Text style={styles.date}>
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', month: 'long', day: 'numeric',
            })}
          </Text>
        </View>
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => router.push('/report/generate')}
        >
          <Text style={styles.profileIcon}>R</Text>
        </TouchableOpacity>
      </View>

      {/* Streak */}
      <View style={styles.streakCard}>
        <View style={styles.streakRow}>
          <View>
            <Text style={styles.streakNumber}>{streak}</Text>
            <Text style={styles.streakLabel}>Day Streak</Text>
          </View>
          <View style={styles.streakDots}>
            {[...Array(7)].map((_, i) => (
              <View
                key={i}
                style={[styles.streakDot, i < streak && styles.streakDotActive]}
              />
            ))}
          </View>
        </View>
      </View>

      {/* CTA */}
      <Button
        title={scannedToday ? "View Today's Results" : "Today's Scan"}
        onPress={() => {
          if (scannedToday && latestOutput) {
            router.push('/scan/results');
          } else {
            router.push('/scan/connect');
          }
        }}
      />

      {/* Latest scores */}
      {latestOutput && (
        <>
          <View style={styles.scoresSection}>
            <Text style={styles.sectionTitle}>Latest Scores</Text>
            {latestOutput.confidence && (
              <ConfidenceBadge level={latestOutput.confidence} />
            )}
          </View>

          <View style={styles.tilesRow}>
            <ScoreTile
              label="Acne"
              score={latestOutput.acne_score}
              delta={acneDelta}
              color={Colors.acne}
              sparklineData={acneHistory}
            />
          </View>
          <View style={styles.tilesRow}>
            <ScoreTile
              label="Sun Damage"
              score={latestOutput.sun_damage_score}
              delta={sunDelta}
              color={Colors.sunDamage}
              sparklineData={sunHistory}
            />
          </View>
          <View style={styles.tilesRow}>
            <ScoreTile
              label="Skin Age"
              score={latestOutput.skin_age_score}
              delta={ageDelta}
              color={Colors.skinAge}
              sparklineData={ageHistory}
            />
          </View>

          {/* Action card */}
          {latestOutput.recommended_action && (
            <View style={styles.actionSection}>
              <ActionCard
                driver={latestOutput.primary_driver || 'insight'}
                action={latestOutput.recommended_action}
                escalation={latestOutput.escalation_flag}
              />
            </View>
          )}
        </>
      )}

      {!latestOutput && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No scans yet</Text>
          <Text style={styles.emptyDesc}>
            Complete your first scan to see your scores and trends.
          </Text>
        </View>
      )}

      {/* Quick actions */}
      <View style={styles.quickActions}>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/report/generate')}
        >
          <Text style={styles.quickActionIcon}>PDF</Text>
          <Text style={styles.quickActionLabel}>Share Report</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => router.push('/onboarding/products')}
        >
          <Text style={styles.quickActionIcon}>+</Text>
          <Text style={styles.quickActionLabel}>Products</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.quickAction}
          onPress={() => {
            useStore.getState().resetAll();
            router.replace('/');
          }}
        >
          <Text style={styles.quickActionIcon}>X</Text>
          <Text style={styles.quickActionLabel}>Reset</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  date: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileIcon: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  streakCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  streakNumber: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.accent,
  },
  streakLabel: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  streakDots: {
    flexDirection: 'row',
    gap: 4,
  },
  streakDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.surfaceHighlight,
  },
  streakDotActive: {
    backgroundColor: Colors.accent,
  },
  scoresSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.xl,
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  tilesRow: {
    marginBottom: Spacing.sm,
  },
  actionSection: {
    marginTop: Spacing.md,
  },
  emptyState: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    marginTop: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  emptyDesc: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  quickAction: {
    alignItems: 'center',
    gap: Spacing.xs,
  },
  quickActionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surfaceLight,
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 44,
    overflow: 'hidden',
  },
  quickActionLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
  },
});
