import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { ProgressDots } from '../../src/components/ProgressDots';
import { useStore } from '../../src/store/useStore';
import type { PeriodApplicable } from '../../src/types';

const ageRanges = [
  { label: '13-17', value: '13-17' },
  { label: '18-24', value: '18-24' },
  { label: '25-34', value: '25-34' },
  { label: '35-44', value: '35-44' },
  { label: '45-54', value: '45-54' },
  { label: '55+', value: '55+' },
];

export default function Essentials() {
  const router = useRouter();
  const { createUser, user } = useStore();

  const [age, setAge] = useState<string | null>(user?.age_range || null);
  const [zip, setZip] = useState(user?.location_coarse || '');
  const [periodApplicable, setPeriodApplicable] = useState<string | null>(
    user?.period_applicable || null
  );
  const [lastPeriod, setLastPeriod] = useState(user?.period_last_start_date || '');
  const [cycleLength, setCycleLength] = useState(
    user?.cycle_length_days?.toString() || '28'
  );

  const canContinue = age && zip.length >= 3 && periodApplicable;

  const handleContinue = () => {
    createUser({
      age_range: age!,
      location_coarse: zip,
      period_applicable: periodApplicable as PeriodApplicable,
      period_last_start_date: periodApplicable === 'yes' ? lastPeriod || undefined : undefined,
      cycle_length_days: periodApplicable === 'yes' ? parseInt(cycleLength) || 28 : 28,
    });
    router.push('/onboarding/goal');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <ProgressDots total={6} current={0} />

      <Text style={styles.title}>Let's get started</Text>
      <Text style={styles.subtitle}>Just a few basics to personalize your experience.</Text>

      {/* Age */}
      <Text style={styles.sectionLabel}>Age Range</Text>
      <OptionSelector
        options={ageRanges}
        selected={age}
        onSelect={setAge}
        horizontal
      />

      {/* Location */}
      <Text style={styles.sectionLabel}>Location (ZIP Code)</Text>
      <TextInput
        style={styles.input}
        value={zip}
        onChangeText={setZip}
        placeholder="Enter ZIP code"
        placeholderTextColor={Colors.textMuted}
        keyboardType="number-pad"
        maxLength={5}
      />

      {/* Period */}
      <Text style={styles.sectionLabel}>Do you get periods?</Text>
      <OptionSelector
        options={[
          { label: 'Yes', value: 'yes' },
          { label: 'No', value: 'no' },
          { label: 'Prefer not to say', value: 'prefer_not' },
        ]}
        selected={periodApplicable}
        onSelect={setPeriodApplicable}
        horizontal
      />

      {periodApplicable === 'yes' && (
        <>
          <Text style={styles.sectionLabel}>Last period start date</Text>
          <TextInput
            style={styles.input}
            value={lastPeriod}
            onChangeText={setLastPeriod}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={Colors.textMuted}
          />
          <Text style={styles.sectionLabel}>Typical cycle length (days)</Text>
          <TextInput
            style={styles.input}
            value={cycleLength}
            onChangeText={setCycleLength}
            placeholder="28"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
          />
        </>
      )}

      <View style={styles.buttonContainer}>
        <Button
          title="Continue"
          onPress={handleContinue}
          disabled={!canContinue}
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
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  input: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  buttonContainer: {
    marginTop: Spacing.xl,
  },
});
