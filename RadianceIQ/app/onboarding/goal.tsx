import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { ProgressDots } from '../../src/components/ProgressDots';
import { useStore } from '../../src/store/useStore';

export default function Goal() {
  const router = useRouter();
  const [goal, setGoal] = useState<string | null>(null);

  return (
    <View style={styles.container}>
      <ProgressDots total={6} current={1} />

      <Text style={styles.title}>What's your primary goal?</Text>
      <Text style={styles.subtitle}>
        This helps us focus your scan and recommendations.
      </Text>

      <View style={styles.options}>
        <OptionSelector
          options={[
            {
              label: 'Acne',
              value: 'acne',
              description: 'Track breakouts, inflammation, and skin clarity.',
            },
            {
              label: 'Sun Damage',
              value: 'sun_damage',
              description: 'Monitor UV-related changes, pigmentation, and spots.',
            },
            {
              label: 'Skin Age',
              value: 'skin_age',
              description: 'Track texture, fine lines, and skin vitality over time.',
            },
          ]}
          selected={goal}
          onSelect={setGoal}
        />
      </View>

      <View style={styles.bottom}>
        <Button
          title="Next"
          onPress={() => router.push({
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
  options: {
    flex: 1,
  },
  bottom: {
    marginTop: Spacing.lg,
  },
});
