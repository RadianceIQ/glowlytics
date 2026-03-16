import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { Button } from '../../src/components/Button';
import { ScoreTile } from '../../src/components/ScoreTile';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import { presentPaywall, checkSubscriptionStatus } from '../../src/services/subscription';
import { trackEvent } from '../../src/services/analytics';

type TimeRange = 7 | 14 | 30;

const average = (values: number[]) =>
  values.length > 0
    ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
    : 0;

const trend = (values: number[]) =>
  values.length < 2 ? 0 : values[values.length - 1] - values[0];

const ReportSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={styles.reportSection}>
    <Text style={styles.reportSectionTitle}>{title}</Text>
    {children}
  </View>
);

export default function GenerateReport() {
  const router = useRouter();
  const subscription = useStore((s) => s.subscription);
  const user = useStore((s) => s.user);

  // Gate reports behind premium
  useEffect(() => {
    if (!subscription.is_active) {
      (async () => {
        const purchased = await presentPaywall();
        if (purchased) {
          const sub = await checkSubscriptionStatus(useStore.getState().subscription);
          useStore.getState().setSubscription(sub);
        }
        if (!useStore.getState().subscription.is_active) {
          router.back();
        }
      })();
    }
  }, []);
  const protocol = useStore((s) => s.protocol);
  const products = useStore((s) => s.products);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const modelOutputs = useStore((s) => s.modelOutputs);

  const [timeRange, setTimeRange] = useState<TimeRange>(14);
  const [showPreview, setShowPreview] = useState(false);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - timeRange);
  const cutoffStr = cutoff.toISOString().split('T')[0];

  const filteredRecords = dailyRecords.filter((record) => record.date >= cutoffStr);
  const filteredIds = new Set(filteredRecords.map((record) => record.daily_id));
  const filteredOutputs = modelOutputs.filter((output) => filteredIds.has(output.daily_id));

  const totalScans = filteredRecords.length;
  const sunscreenDays = filteredRecords.filter((record) => record.sunscreen_used).length;
  const sunscreenRate = totalScans > 0 ? Math.round((sunscreenDays / totalScans) * 100) : 0;
  const passCount = filteredRecords.filter((record) => record.scanner_quality_flag === 'pass').length;
  const confidenceRate = totalScans > 0 ? Math.round((passCount / totalScans) * 100) : 0;

  const acneScores = filteredOutputs.map((output) => output.acne_score);
  const sunScores = filteredOutputs.map((output) => output.sun_damage_score);
  const ageScores = filteredOutputs.map((output) => output.skin_age_score);

  if (!showPreview) {
    return (
      <AtmosphereScreen scroll={false} contentContainerStyle={styles.builderLayout}>
        <View style={styles.builderHeader}>
          <Text style={styles.eyebrow}>Share report</Text>
          <Text style={styles.title}>Package your trend story.</Text>
          <Text style={styles.subtitle}>
            Choose a time window, review the summary, and generate a clinician-facing preview.
          </Text>
        </View>

        <View style={styles.segmentedControl}>
          {([7, 14, 30] as TimeRange[]).map((range) => (
            <TouchableOpacity
              key={range}
              style={[styles.segmentButton, timeRange === range && styles.segmentButtonActive]}
              onPress={() => setTimeRange(range)}
            >
              <Text style={[styles.segmentText, timeRange === range && styles.segmentTextActive]}>
                {range}d
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.spotlightCard}>
          <Text style={styles.spotlightEyebrow}>Export snapshot</Text>
          <Text style={styles.spotlightTitle}>
            {totalScans > 0 ? `${totalScans} scans ready to summarize.` : 'No scans in this range yet.'}
          </Text>
          <Text style={styles.spotlightCopy}>
            {totalScans > 0
              ? `Sunscreen adherence is ${sunscreenRate}% and capture quality passed ${confidenceRate}% of the time.`
              : 'Take a few scans first so the report has enough signal to be credible.'}
          </Text>

          <View style={styles.spotlightStats}>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{sunscreenRate}%</Text>
              <Text style={styles.statLabel}>Adherence</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{confidenceRate}%</Text>
              <Text style={styles.statLabel}>Quality</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statValue}>{timeRange}d</Text>
              <Text style={styles.statLabel}>Window</Text>
            </View>
          </View>
        </View>

        <View style={styles.builderActions}>
          <Button
            title="Generate preview"
            onPress={() => {
              trackEvent('report_generated', { time_range: timeRange, total_scans: totalScans });
              setShowPreview(true);
            }}
            disabled={totalScans === 0}
            size="lg"
          />
          <Button title="Back" variant="ghost" onPress={() => router.back()} />
        </View>
      </AtmosphereScreen>
    );
  }

  return (
    <AtmosphereScreen>
      <View style={styles.previewHeader}>
        <View>
          <Text style={styles.eyebrow}>Preview</Text>
          <Text style={styles.title}>Glowlytics clinician export</Text>
        </View>
        <Button title="Back to builder" variant="secondary" size="sm" onPress={() => setShowPreview(false)} />
      </View>

      <View style={styles.reportHero}>
        <Text style={styles.reportHeroTitle}>Trend summary for the last {timeRange} days</Text>
        <Text style={styles.reportHeroCopy}>
          {cutoffStr} to {new Date().toISOString().split('T')[0]}
        </Text>
      </View>

      <ReportSection title="Patient summary">
        <Text style={styles.reportText}>Age range: {user?.age_range || 'N/A'}</Text>
        <Text style={styles.reportText}>Location: {user?.location_coarse || 'N/A'}</Text>
      </ReportSection>

      <ReportSection title="Scan protocol">
        <Text style={styles.reportText}>Region: {protocol?.scan_region?.replace(/_/g, ' ') || 'N/A'}</Text>
        <Text style={styles.reportText}>Cadence: Daily</Text>
        <Text style={styles.reportText}>Scans completed: {totalScans} / {timeRange}</Text>
        <Text style={styles.reportText}>Quality pass rate: {confidenceRate}%</Text>
      </ReportSection>

      <ReportSection title="Trend snapshot">
        <View style={styles.metricStack}>
          <ScoreTile
            label="Acne trend"
            score={average(acneScores)}
            delta={trend(acneScores)}
            color={Colors.acne}
            sparklineData={acneScores}
            compact
            lowLabel="Start"
            highLabel="Now"
          />
          <ScoreTile
            label="Sun trend"
            score={average(sunScores)}
            delta={trend(sunScores)}
            color={Colors.sunDamage}
            sparklineData={sunScores}
            compact
            lowLabel="Start"
            highLabel="Now"
          />
          <ScoreTile
            label="Age trend"
            score={average(ageScores)}
            delta={trend(ageScores)}
            color={Colors.skinAge}
            sparklineData={ageScores}
            compact
            lowLabel="Start"
            highLabel="Now"
          />
        </View>
      </ReportSection>

      <ReportSection title="Representative photos">
        {(() => {
          const recordsWithPhotos = filteredRecords.filter((r) => r.photo_uri);
          if (recordsWithPhotos.length === 0) {
            return <Text style={styles.reportText}>No photos captured in this period.</Text>;
          }
          const selected: typeof recordsWithPhotos = [];
          selected.push(recordsWithPhotos[0]);
          if (recordsWithPhotos.length >= 3) {
            selected.push(recordsWithPhotos[Math.floor(recordsWithPhotos.length / 2)]);
          }
          if (recordsWithPhotos.length >= 2) {
            selected.push(recordsWithPhotos[recordsWithPhotos.length - 1]);
          }
          return (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoRow}>
              {selected.map((record) => (
                <View key={record.daily_id} style={styles.photoCard}>
                  <Image source={{ uri: record.photo_uri }} style={styles.photoImage} />
                  <Text style={styles.photoDate}>{record.date}</Text>
                </View>
              ))}
            </ScrollView>
          );
        })()}
      </ReportSection>

      <ReportSection title="Products used">
        {products.length > 0 ? (
          products.map((product) => (
            <View key={product.user_product_id} style={styles.productRow}>
              <Text style={styles.productName}>{product.product_name}</Text>
              <Text style={styles.productDetail}>
                {product.ingredients_list.join(', ')} | {product.usage_schedule} | Since {product.start_date}
              </Text>
            </View>
          ))
        ) : (
          <Text style={styles.reportText}>No products logged.</Text>
        )}
      </ReportSection>

      <ReportSection title="Context overlay">
        <Text style={styles.reportText}>
          Sunscreen adherence: {sunscreenRate}% ({sunscreenDays}/{totalScans} days)
        </Text>
        {user?.period_applicable === 'yes' ? (
          <Text style={styles.reportText}>Menstrual cycle: tracked ({user.cycle_length_days} day cycle)</Text>
        ) : null}
        {filteredRecords.some((record) => record.sleep_quality) ? (
          <Text style={styles.reportText}>Sleep context: self-reported or device-supported</Text>
        ) : null}
      </ReportSection>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Non-diagnostic metrics for clinician interpretation. Generated by Glowlytics on {new Date().toISOString().split('T')[0]}.
        </Text>
      </View>

      <View style={styles.shareActions}>
        <Button
          title="Export PDF"
          onPress={() => Alert.alert('Export', 'PDF report would be generated here.')}
        />
        <Button
          title="Share via email"
          variant="secondary"
          onPress={() => Alert.alert('Share', 'Email sharing would be triggered here.')}
        />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  builderLayout: {
    justifyContent: 'space-between',
  },
  builderHeader: {
    gap: Spacing.sm,
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
    lineHeight: 42,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
    maxWidth: '90%',
  },
  segmentedControl: {
    flexDirection: 'row',
    gap: Spacing.sm,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.xs,
  },
  segmentButton: {
    flex: 1,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  segmentButtonActive: {
    backgroundColor: Colors.surfaceHighlight,
  },
  segmentText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  segmentTextActive: {
    color: Colors.primaryLight,
  },
  spotlightCard: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  spotlightEyebrow: {
    color: Colors.secondaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  spotlightTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  spotlightCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  spotlightStats: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  statChip: {
    flex: 1,
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statValue: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
  },
  statLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  builderActions: {
    gap: Spacing.md,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  reportHero: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  reportHeroTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  reportHeroCopy: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
  },
  reportSection: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  reportSectionTitle: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.1,
  },
  reportText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  metricStack: {
    gap: Spacing.sm,
  },
  photoRow: {
    flexDirection: 'row',
    marginTop: Spacing.xs,
  },
  photoCard: {
    alignItems: 'center',
    marginRight: Spacing.md,
    gap: Spacing.xs,
  },
  photoImage: {
    width: 100,
    height: 130,
    borderRadius: 12,
    backgroundColor: Colors.surfaceHighlight,
  },
  photoDate: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    marginTop: Spacing.xxs,
  },
  productRow: {
    gap: Spacing.xs,
    paddingTop: Spacing.xs,
  },
  productName: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  productDetail: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  disclaimer: {
    backgroundColor: Colors.surfaceOverlay,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginTop: Spacing.sm,
  },
  disclaimerText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  shareActions: {
    gap: Spacing.md,
    marginTop: Spacing.lg,
  },
});
