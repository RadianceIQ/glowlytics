import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScoreTile } from '../../src/components/ScoreTile';
import { useStore } from '../../src/store/useStore';

type TimeRange = 7 | 14 | 30;

export default function GenerateReport() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const products = useStore((s) => s.products);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const modelOutputs = useStore((s) => s.modelOutputs);

  const [timeRange, setTimeRange] = useState<TimeRange>(14);
  const [showPreview, setShowPreview] = useState(false);

  // Filter data by time range
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeRange);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const filteredRecords = dailyRecords.filter((r) => r.date >= cutoffStr);
  const filteredOutputIds = new Set(filteredRecords.map((r) => r.daily_id));
  const filteredOutputs = modelOutputs.filter((o) => filteredOutputIds.has(o.daily_id));

  // Stats
  const totalScans = filteredRecords.length;
  const sunscreenDays = filteredRecords.filter((r) => r.sunscreen_used).length;
  const sunscreenRate = totalScans > 0 ? Math.round((sunscreenDays / totalScans) * 100) : 0;

  // Score trends
  const acneScores = filteredOutputs.map((o) => o.acne_score);
  const sunScores = filteredOutputs.map((o) => o.sun_damage_score);
  const ageScores = filteredOutputs.map((o) => o.skin_age_score);

  const avg = (arr: number[]) => arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
  const trend = (arr: number[]) => {
    if (arr.length < 2) return 0;
    return arr[arr.length - 1] - arr[0];
  };

  const passCount = filteredRecords.filter((r) => r.scanner_quality_flag === 'pass').length;
  const confidenceRate = totalScans > 0 ? Math.round((passCount / totalScans) * 100) : 0;

  if (!showPreview) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Share Report</Text>
        <Text style={styles.subtitle}>
          Generate a clinician-ready report from your scan history.
        </Text>

        {/* Time range selector */}
        <Text style={styles.sectionLabel}>Select time range</Text>
        <View style={styles.rangeRow}>
          {([7, 14, 30] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.rangeButton,
                timeRange === range && styles.rangeButtonActive,
              ]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[
                styles.rangeText,
                timeRange === range && styles.rangeTextActive,
              ]}>
                {range} days
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.stats}>
          <Text style={styles.statText}>{totalScans} scans in range</Text>
          <Text style={styles.statText}>{sunscreenRate}% sunscreen adherence</Text>
        </View>

        <View style={styles.bottom}>
          <Button
            title="Generate Report Preview"
            onPress={() => setShowPreview(true)}
            disabled={totalScans === 0}
          />
          <Button
            title="Back"
            variant="ghost"
            onPress={() => router.back()}
          />
        </View>
      </View>
    );
  }

  // Report preview
  return (
    <ScrollView style={styles.scrollContainer} contentContainerStyle={styles.previewContainer}>
      {/* Report header */}
      <View style={styles.reportHeader}>
        <Text style={styles.reportTitle}>RadianceIQ Skin Report</Text>
        <Text style={styles.reportDate}>
          {cutoffStr} to {new Date().toISOString().split('T')[0]}
        </Text>
      </View>

      {/* User summary */}
      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>Patient Summary</Text>
        <Text style={styles.reportText}>Age Range: {user?.age_range || 'N/A'}</Text>
        <Text style={styles.reportText}>Location: {user?.location_coarse || 'N/A'}</Text>
      </View>

      {/* Scan protocol */}
      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>Scan Protocol</Text>
        <Text style={styles.reportText}>
          Region: {protocol?.scan_region?.replace(/_/g, ' ') || 'N/A'}
        </Text>
        <Text style={styles.reportText}>Cadence: Daily</Text>
        <Text style={styles.reportText}>
          Scans completed: {totalScans} / {timeRange}
        </Text>
        <Text style={styles.reportText}>
          Quality pass rate: {confidenceRate}%
        </Text>
      </View>

      {/* Trend charts (simplified) */}
      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>Trend Summary</Text>
        <View style={styles.trendRow}>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Acne</Text>
            <Text style={[styles.trendAvg, { color: Colors.acne }]}>{avg(acneScores)}</Text>
            <Text style={styles.trendDelta}>
              {trend(acneScores) > 0 ? '+' : ''}{trend(acneScores)} over period
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Sun Damage</Text>
            <Text style={[styles.trendAvg, { color: Colors.sunDamage }]}>{avg(sunScores)}</Text>
            <Text style={styles.trendDelta}>
              {trend(sunScores) > 0 ? '+' : ''}{trend(sunScores)} over period
            </Text>
          </View>
          <View style={styles.trendItem}>
            <Text style={styles.trendLabel}>Skin Age</Text>
            <Text style={[styles.trendAvg, { color: Colors.skinAge }]}>{avg(ageScores)}</Text>
            <Text style={styles.trendDelta}>
              {trend(ageScores) > 0 ? '+' : ''}{trend(ageScores)} over period
            </Text>
          </View>
        </View>
      </View>

      {/* Sparklines */}
      {acneScores.length > 1 && (
        <View style={styles.reportSection}>
          <Text style={styles.reportSectionTitle}>Score Trends</Text>
          <View style={styles.chartPlaceholder}>
            <ScoreTile
              label="Acne Trend"
              score={avg(acneScores)}
              delta={trend(acneScores)}
              color={Colors.acne}
              sparklineData={acneScores}
            />
          </View>
          <View style={styles.chartPlaceholder}>
            <ScoreTile
              label="Sun Damage Trend"
              score={avg(sunScores)}
              delta={trend(sunScores)}
              color={Colors.sunDamage}
              sparklineData={sunScores}
            />
          </View>
          <View style={styles.chartPlaceholder}>
            <ScoreTile
              label="Skin Age Trend"
              score={avg(ageScores)}
              delta={trend(ageScores)}
              color={Colors.skinAge}
              sparklineData={ageScores}
            />
          </View>
        </View>
      )}

      {/* Products */}
      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>Products Used</Text>
        {products.map((p) => (
          <View key={p.user_product_id} style={styles.productRow}>
            <Text style={styles.productName}>{p.product_name}</Text>
            <Text style={styles.productDetail}>
              {p.ingredients_list.join(', ')} | {p.usage_schedule} | Since {p.start_date}
            </Text>
          </View>
        ))}
        {products.length === 0 && (
          <Text style={styles.reportText}>No products logged.</Text>
        )}
      </View>

      {/* Context overlays */}
      <View style={styles.reportSection}>
        <Text style={styles.reportSectionTitle}>Context</Text>
        <Text style={styles.reportText}>
          Sunscreen adherence: {sunscreenRate}% ({sunscreenDays}/{totalScans} days)
        </Text>
        {user?.period_applicable === 'yes' && (
          <Text style={styles.reportText}>
            Menstrual cycle: Tracked (cycle length: {user.cycle_length_days} days)
          </Text>
        )}
        {filteredRecords.some((r) => r.sleep_quality) && (
          <Text style={styles.reportText}>
            Sleep data: Self-reported
          </Text>
        )}
      </View>

      {/* Disclaimer */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Non-diagnostic metrics; for clinician interpretation.
          Generated by RadianceIQ on {new Date().toISOString().split('T')[0]}.
        </Text>
      </View>

      {/* Share actions */}
      <View style={styles.shareActions}>
        <Button title="Export PDF" onPress={() => {
          // Stub: in production, generate actual PDF
          Alert.alert('Export', 'PDF report would be generated here.');
        }} />
        <Button title="Share via Email" variant="secondary" onPress={() => {
          Alert.alert('Share', 'Email sharing would be triggered here.');
        }} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  scrollContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  previewContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: 60,
    paddingBottom: Spacing.xxl,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  rangeButton: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surfaceLight,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  rangeButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '15',
  },
  rangeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  rangeTextActive: {
    color: Colors.primary,
  },
  stats: {
    marginTop: Spacing.lg,
    gap: Spacing.xs,
  },
  statText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  bottom: {
    marginTop: 'auto',
    gap: Spacing.md,
  },
  // Report preview styles
  reportHeader: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
    paddingBottom: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reportTitle: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
  },
  reportDate: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginTop: Spacing.xs,
  },
  reportSection: {
    marginBottom: Spacing.lg,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  reportSectionTitle: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reportText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  trendRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  trendItem: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  trendLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  trendAvg: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  trendDelta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  chartPlaceholder: {
    marginBottom: Spacing.sm,
  },
  productRow: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  productName: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  productDetail: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    marginTop: 2,
  },
  disclaimer: {
    backgroundColor: Colors.surfaceHighlight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  disclaimerText: {
    color: Colors.textMuted,
    fontSize: FontSize.xs,
    textAlign: 'center',
    fontStyle: 'italic',
    lineHeight: 18,
  },
  shareActions: {
    gap: Spacing.md,
  },
});
