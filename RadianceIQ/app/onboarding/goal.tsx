import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { OnboardingHero } from '../../src/components/OnboardingHero';

export default function Goal() {
  const router = useRouter();
  const [goal, setGoal] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <OnboardingHero
        total={7}
        current={1}
        eyebrow="Step 2 · Focus"
        title="Choose the trend you care about most."
        subtitle="We’ll use this to recommend the best scan region and tailor your first insights."
      />

      <View style={styles.optionsCard}>
        <OptionSelector
          options={[
            {
              label: 'Acne',
              value: 'acne',
              description: 'Track breakouts, inflammation, and day-to-day clarity.',
            },
            {
              label: 'Sun Damage',
              value: 'sun_damage',
              description: 'Monitor UV-related pigmentation and visible change over time.',
            },
            {
              label: 'Skin Age',
              value: 'skin_age',
              description: 'Focus on texture, fine lines, and skin vitality trends.',
            },
          ]}
          selected={goal}
          onSelect={setGoal}
        />
      </View>

      <View style={styles.footer}>
        <Button
          title="Next"
          onPress={() =>
            router.push({
              pathname: '/onboarding/region',
              params: { goal },
            })}
          disabled={!goal}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: 56,
    paddingBottom: Spacing.xxl,
  },
  optionsCard: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    flex: 1,
  },
  footer: {
    marginTop: Spacing.lg,
  },
});
