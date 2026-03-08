import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { OnboardingHero } from '../../src/components/OnboardingHero';
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
      cycle_length_days: periodApplicable === 'yes' ? parseInt(cycleLength, 10) || 28 : 28,
    });
    router.push('/onboarding/goal');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <OnboardingHero
        total={7}
        current={0}
        eyebrow="Step 1 · Essentials"
        title="Start with the basics."
        subtitle="A few taps help RadianceIQ personalize your scan and trend context."
      />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Age range</Text>
        <OptionSelector
          options={ageRanges}
          selected={age}
          onSelect={setAge}
          horizontal
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Location</Text>
        <Text style={styles.helperText}>Used for coarse climate and UV context only.</Text>
        <TextInput
          style={styles.input}
          value={zip}
          onChangeText={setZip}
          placeholder="Enter ZIP code"
          placeholderTextColor={Colors.textMuted}
          keyboardType="number-pad"
          maxLength={5}
        />
      </View>

      <View style={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Cycle basics</Text>
        <Text style={styles.helperText}>Optional and self-entered for now.</Text>
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
          <View style={styles.inlineFields}>
            <View style={styles.fieldGroup}>
              <Text style={styles.inlineLabel}>Last period start</Text>
              <TextInput
                style={styles.input}
                value={lastPeriod}
                onChangeText={setLastPeriod}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={Colors.textMuted}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.inlineLabel}>Typical cycle length</Text>
              <TextInput
                style={styles.input}
                value={cycleLength}
                onChangeText={setCycleLength}
                placeholder="28"
                placeholderTextColor={Colors.textMuted}
                keyboardType="number-pad"
              />
            </View>
          </View>
        )}
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          Camera and health permissions come later, right when they add value.
        </Text>
        <Button title="Continue" onPress={handleContinue} disabled={!canContinue} />
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
    paddingTop: 56,
    paddingBottom: Spacing.xxl,
    gap: Spacing.md,
  },
  sectionCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansBold,
    color: Colors.text,
  },
  helperText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  input: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  inlineFields: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  fieldGroup: {
    gap: Spacing.sm,
  },
  inlineLabel: {
    fontSize: FontSize.sm,
    fontFamily: FontFamily.sansSemiBold,
    color: Colors.text,
  },
  footer: {
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  footerNote: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
