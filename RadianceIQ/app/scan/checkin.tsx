import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { useStore } from '../../src/store/useStore';
import { analyzeSkiN } from '../../src/services/skinAnalysis';

export default function DailyCheckin() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    inflammation: string;
    pigmentation: string;
    texture: string;
    photoUri: string;
  }>();

  const store = useStore();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const modelOutputs = useStore((s) => s.modelOutputs);

  const [sunscreen, setSunscreen] = useState<string | null>(null);
  const [newProduct, setNewProduct] = useState<string | null>(null);
  const [periodAccurate, setPeriodAccurate] = useState<string | null>(null);
  const [showContext, setShowContext] = useState(false);
  const [sleep, setSleep] = useState<string | null>(null);
  const [stress, setStress] = useState<string | null>(null);
  const [drinks, setDrinks] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estimate cycle day
  const estimatedCycleDay = (() => {
    if (user?.period_applicable !== 'yes' || !user?.period_last_start_date) return null;
    const start = new Date(user.period_last_start_date);
    const today = new Date();
    const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    const cycleLen = user.cycle_length_days || 28;
    return ((diff % cycleLen) + cycleLen) % cycleLen + 1;
  })();

  const canContinue = sunscreen !== null && newProduct !== null;

  const persistPhoto = async (tempUri: string): Promise<string | undefined> => {
    try {
      const photosDir = `${FileSystem.documentDirectory}scan_photos/`;
      const dirInfo = await FileSystem.getInfoAsync(photosDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(photosDir, { intermediates: true });
      }
      const filename = `scan_${Date.now()}.jpg`;
      const destUri = `${photosDir}${filename}`;
      await FileSystem.copyAsync({ from: tempUri, to: destUri });
      return destUri;
    } catch {
      return undefined;
    }
  };

  const handleSeeResults = async () => {
    if (!user || !protocol) return;
    setLoading(true);

    const scannerData = {
      inflammation_index: parseFloat(params.inflammation || '40'),
      pigmentation_index: parseFloat(params.pigmentation || '30'),
      texture_index: parseFloat(params.texture || '35'),
    };

    // Persist photo to permanent storage
    let savedPhotoUri: string | undefined;
    if (params.photoUri) {
      savedPhotoUri = await persistPhoto(params.photoUri);
    }

    const analysis = await analyzeSkiN({
      scannerData,
      userProfile: user,
      protocol,
      previousOutputs: modelOutputs,
      dailyContext: {
        sunscreen_used: sunscreen === 'yes',
        new_product_added: newProduct === 'yes',
        cycle_day_estimated: estimatedCycleDay || undefined,
        sleep_quality: sleep || undefined,
        stress_level: stress || undefined,
      },
    });

    const dailyRecord = store.addDailyRecord({
      date: new Date().toISOString().split('T')[0],
      scanner_reading_id: `scan_${Date.now()}`,
      scanner_indices: scannerData,
      scanner_quality_flag: 'pass',
      scan_region: protocol.scan_region,
      photo_uri: savedPhotoUri,
      photo_quality_flag: 'pass',
      sunscreen_used: sunscreen === 'yes',
      new_product_added: newProduct === 'yes',
      period_status_confirmed: periodAccurate as any,
      cycle_day_estimated: estimatedCycleDay || undefined,
      sleep_quality: sleep as any,
      stress_level: stress as any,
      drinks_yesterday: drinks || undefined,
    });

    store.addModelOutput({
      daily_id: dailyRecord.daily_id,
      ...analysis,
    });

    setLoading(false);
    router.push('/scan/results');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Quick check-in</Text>
      <Text style={styles.subtitle}>A few quick taps before your results.</Text>

      {/* Sunscreen */}
      <Text style={styles.sectionLabel}>Sunscreen today?</Text>
      <OptionSelector
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
        selected={sunscreen}
        onSelect={setSunscreen}
        horizontal
      />

      {/* New product */}
      <Text style={styles.sectionLabel}>Any new product since yesterday?</Text>
      <OptionSelector
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
        selected={newProduct}
        onSelect={setNewProduct}
        horizontal
      />

      {/* Period status */}
      {user?.period_applicable === 'yes' && estimatedCycleDay && (
        <>
          <Text style={styles.sectionLabel}>Period status</Text>
          <View style={styles.cycleDayCard}>
            <Text style={styles.cycleDayText}>
              Estimated: Day {estimatedCycleDay}
            </Text>
            <OptionSelector
              options={[
                { label: 'Accurate', value: 'accurate' },
                { label: 'Not accurate', value: 'not_accurate' },
              ]}
              selected={periodAccurate}
              onSelect={setPeriodAccurate}
              horizontal
            />
          </View>
        </>
      )}

      {/* Optional context */}
      {!showContext ? (
        <TouchableOpacity
          style={styles.contextToggle}
          onPress={() => setShowContext(true)}
        >
          <Text style={styles.contextToggleText}>Add context (optional)</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.contextSection}>
          <Text style={styles.sectionLabel}>Sleep (yesterday)</Text>
          <OptionSelector
            options={[
              { label: 'Poor', value: 'poor' },
              { label: 'OK', value: 'ok' },
              { label: 'Great', value: 'great' },
            ]}
            selected={sleep}
            onSelect={setSleep}
            horizontal
          />

          <Text style={styles.sectionLabel}>Stress (yesterday)</Text>
          <OptionSelector
            options={[
              { label: 'Low', value: 'low' },
              { label: 'Med', value: 'med' },
              { label: 'High', value: 'high' },
            ]}
            selected={stress}
            onSelect={setStress}
            horizontal
          />

          <Text style={styles.sectionLabel}>Drinks yesterday</Text>
          <OptionSelector
            options={[
              { label: '0', value: '0' },
              { label: '1-2', value: '1-2' },
              { label: '3+', value: '3+' },
            ]}
            selected={drinks}
            onSelect={setDrinks}
            horizontal
          />
        </View>
      )}

      <View style={styles.bottom}>
        <Button
          title="See results"
          onPress={handleSeeResults}
          disabled={!canContinue}
          loading={loading}
        />
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
  title: {
    fontSize: FontSize.xxl,
    fontFamily: FontFamily.sansBold,
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    marginBottom: Spacing.lg,
  },
  sectionLabel: {
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  cycleDayCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  cycleDayText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
  },
  contextToggle: {
    marginTop: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
  },
  contextToggleText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  contextSection: {
    marginTop: Spacing.md,
  },
  bottom: {
    marginTop: Spacing.xl,
  },
});
