import React, { useEffect, useState } from 'react';
import { Alert, Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as MailComposer from 'expo-mail-composer';
import * as FileSystemLegacy from 'expo-file-system/legacy';
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
import { gateWithPaywall } from '../../src/services/subscription';
import { trackEvent } from '../../src/services/analytics';
import { buildReportHtml, type ReportHtmlData } from '../../src/services/reportHtml';

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

  useEffect(() => {
    if (!subscription.is_active) {
      (async () => {
        const allowed = await gateWithPaywall();
        if (!allowed) router.back();
      })();
    }
  }, []);

  useEffect(() => {
    trackEvent('report_viewed', { time_range: timeRange });
  }, []);

  const protocol = useStore((s) => s.protocol);
  const products = useStore((s) => s.products);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const modelOutputs = useStore((s) => s.modelOutputs);

  const [timeRange, setTimeRange] = useState<TimeRange>(14);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

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

  const dateTo = new Date().toISOString().split('T')[0];

  const prepareReportData = async (): Promise<ReportHtmlData> => {
    const recordsWithPhotos = filteredRecords.filter((r) => r.photo_uri);
    const selected: typeof recordsWithPhotos = [];
    if (recordsWithPhotos.length > 0) {
      selected.push(recordsWithPhotos[0]);
      if (recordsWithPhotos.length >= 3) {
        selected.push(recordsWithPhotos[Math.floor(recordsWithPhotos.length / 2)]);
      }
      if (recordsWithPhotos.length >= 2) {
        selected.push(recordsWithPhotos[recordsWithPhotos.length - 1]);
      }
    }

    const photos: { date: string; base64: string }[] = [];
    for (const record of selected) {
      try {
        const base64 = await FileSystemLegacy.readAsStringAsync(record.photo_uri!, { encoding: FileSystemLegacy.EncodingType.Base64 });
        photos.push({ date: record.date, base64 });
      } catch {
        // Skip photos that can't be read (stale/missing files)
      }
    }

    return {
      timeRange,
      dateFrom: cutoffStr,
      dateTo,
      ageRange: user?.age_range || 'N/A',
      locationCoarse: user?.location_coarse || 'N/A',
      scanRegion: protocol?.scan_region?.replace(/_/g, ' ') || 'N/A',
      totalScans,
      confidenceRate,
      acneAvg: average(acneScores),
      acneDelta: trend(acneScores),
      acneScores,
      sunAvg: average(sunScores),
      sunDelta: trend(sunScores),
      sunScores,
      ageAvg: average(ageScores),
      ageDelta: trend(ageScores),
      ageScores,
      photos,
      products: products.map((p) => ({
        name: p.product_name,
        ingredients: p.ingredients_list.join(', '),
        schedule: p.usage_schedule,
        startDate: p.start_date,
      })),
      sunscreenRate,
      sunscreenDays,
      totalSunscreenDays: totalScans,
      periodApplicable: user?.period_applicable === 'yes',
      cycleLengthDays: user?.cycle_length_days,
      hasSleepContext: filteredRecords.some((r) => r.sleep_quality),
      generatedDate: dateTo,
    };
  };

  const generatePdfFile = async (): Promise<string> => {
    const reportData = await prepareReportData();
    const html = buildReportHtml(reportData);
    const { uri } = await Print.printToFileAsync({ html });
    const filename = `Glowlytics-Report-${dateTo}.pdf`;
    const newUri = `${FileSystemLegacy.documentDirectory}${filename}`;
    await FileSystemLegacy.moveAsync({ from: uri, to: newUri });
    return newUri;
  };

  const handleExportPdf = async () => {
    setIsGeneratingPdf(true);
    try {
      const pdfUri = await generatePdfFile();
      await Sharing.shareAsync(pdfUri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
      trackEvent('report_exported', { time_range: timeRange, total_scans: totalScans, has_photos: filteredRecords.some((r) => r.photo_uri) });
    } catch {
      Alert.alert('Export failed', 'Unable to generate or share the PDF. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const handleShareEmail = async () => {
    const available = await MailComposer.isAvailableAsync();
    if (!available) {
      Alert.alert('No email configured', 'Please set up an email account on this device first.');
      return;
    }
    setIsGeneratingPdf(true);
    try {
      const pdfUri = await generatePdfFile();
      await MailComposer.composeAsync({
        subject: `Glowlytics Skin Report - ${cutoffStr} to ${dateTo}`,
        body: `Please find attached the Glowlytics clinician report covering ${cutoffStr} to ${dateTo} (${totalScans} scans).`,
        attachments: [pdfUri],
      });
      trackEvent('report_shared_email', { time_range: timeRange, total_scans: totalScans, has_photos: filteredRecords.some((r) => r.photo_uri) });
    } catch {
      Alert.alert('Share failed', 'Unable to generate the PDF or open email. Please try again.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (totalScans === 0) {
    return (
      <AtmosphereScreen scroll={false} contentContainerStyle={styles.emptyLayout}>
        <View style={styles.emptyContent}>
          <Text style={styles.eyebrow}>Clinician report</Text>
          <Text style={styles.title}>No scans yet.</Text>
          <Text style={styles.emptySubtitle}>
            Take a few scans first so the report has enough signal to be credible.
          </Text>
        </View>
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </AtmosphereScreen>
    );
  }

  return (
    <AtmosphereScreen>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>Clinician report</Text>
          <Text style={styles.title}>Trend summary</Text>
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
      </View>

      <View style={styles.reportHero}>
        <Text style={styles.reportHeroTitle}>{cutoffStr} — {dateTo}</Text>
        <Text style={styles.reportHeroCopy}>
          {totalScans} scans · {confidenceRate}% quality · {sunscreenRate}% sunscreen adherence
        </Text>
      </View>

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

      <ReportSection title="Context">
        <Text style={styles.reportText}>Age range: {user?.age_range || 'N/A'}</Text>
        <Text style={styles.reportText}>Location: {user?.location_coarse || 'N/A'}</Text>
        <Text style={styles.reportText}>Region: {protocol?.scan_region?.replace(/_/g, ' ') || 'N/A'}</Text>
        {user?.period_applicable === 'yes' ? (
          <Text style={styles.reportText}>Menstrual cycle: {user.cycle_length_days} day cycle</Text>
        ) : null}
        {filteredRecords.some((record) => record.sleep_quality) ? (
          <Text style={styles.reportText}>Sleep context: self-reported</Text>
        ) : null}
      </ReportSection>

      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          Non-diagnostic metrics for clinician interpretation. Generated by Glowlytics on {dateTo}.
        </Text>
      </View>

      <View style={styles.shareActions}>
        <Button
          title="Export PDF"
          onPress={handleExportPdf}
          loading={isGeneratingPdf}
          disabled={isGeneratingPdf}
        />
        <Button
          title="Share via email"
          variant="secondary"
          onPress={handleShareEmail}
          loading={isGeneratingPdf}
          disabled={isGeneratingPdf}
        />
      </View>
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  emptyLayout: {
    justifyContent: 'space-between',
  },
  emptyContent: {
    gap: Spacing.sm,
  },
  emptySubtitle: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
    maxWidth: '85%',
  },
  header: {
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  headerText: {
    gap: Spacing.xs,
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
  reportHero: {
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.xs,
    marginBottom: Spacing.lg,
  },
  reportHeroTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
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
    borderRadius: BorderRadius.sm,
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
