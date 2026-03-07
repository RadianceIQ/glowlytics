import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { ProgressDots } from '../../src/components/ProgressDots';
import { useStore } from '../../src/store/useStore';

export default function Boost() {
  const router = useRouter();
  const updateUser = useStore((s) => s.updateUser);

  const [smoker, setSmoker] = useState<string | null>(null);
  const [drinks, setDrinks] = useState<string | null>(null);
  const [sleep, setSleep] = useState<string | null>(null);
  const [stress, setStress] = useState<string | null>(null);

  const handleDone = () => {
    updateUser({
      smoker_status: smoker === 'yes',
      drink_baseline_frequency: drinks || undefined,
      onboarding_complete: true,
    });
    router.replace('/home');
  };

  const handleSkip = () => {
    updateUser({ onboarding_complete: true });
    router.replace('/home');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ProgressDots total={6} current={5} />

      <Text style={styles.title}>Boost accuracy</Text>
      <Text style={styles.subtitle}>
        Improve insights with 30 seconds of context. Skip anytime.
      </Text>

      {/* Smoker */}
      <Text style={styles.sectionLabel}>Do you smoke?</Text>
      <OptionSelector
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
        ]}
        selected={smoker}
        onSelect={setSmoker}
        horizontal
      />

      {/* Drinks */}
      <Text style={styles.sectionLabel}>Weekly drink frequency</Text>
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

      {/* Sleep */}
      <Text style={styles.sectionLabel}>Sleep quality (yesterday)</Text>
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

      {/* Stress */}
      <Text style={styles.sectionLabel}>Stress level (yesterday)</Text>
      <OptionSelector
        options={[
          { label: 'Low', value: 'low' },
          { label: 'Medium', value: 'med' },
          { label: 'High', value: 'high' },
        ]}
        selected={stress}
        onSelect={setStress}
        horizontal
      />

      {/* Wearable */}
      <View style={styles.wearableCard}>
        <Text style={styles.wearableTitle}>Connect a wearable</Text>
        <Text style={styles.wearableDesc}>
          We use sleep + stress proxies from Apple Health to interpret trends.
        </Text>
        <Button
          title="Connect Apple Health"
          variant="secondary"
          onPress={() => {
            updateUser({ wearable_connected: true, wearable_source: 'Apple Health' });
          }}
          small
        />
      </View>

      <View style={styles.bottom}>
        <Button title="Done" onPress={handleDone} />
        <Button title="Skip" variant="ghost" onPress={handleSkip} />
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
    fontWeight: '700',
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
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  wearableCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginTop: Spacing.xl,
    gap: Spacing.sm,
  },
  wearableTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  wearableDesc: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  bottom: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
});
