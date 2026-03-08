import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { FaceMap } from '../../src/components/FaceMap';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { useStore } from '../../src/store/useStore';
import type { ScanRegion, PrimaryGoal } from '../../src/types';

const getRecommended = (goal: string): ScanRegion => {
  switch (goal) {
    case 'acne':
      return 'left_cheek';
    case 'sun_damage':
      return 'temple';
    case 'skin_age':
      return 'crows_feet';
    default:
      return 'left_cheek';
  }
};

export default function Region() {
  const router = useRouter();
  const { goal } = useLocalSearchParams<{ goal: string }>();
  const setProtocol = useStore((s) => s.setProtocol);
  const recommended = getRecommended(goal || 'acne');
  const [selected, setSelected] = useState<ScanRegion>(recommended);

  const handleConfirm = () => {
    setProtocol(goal as PrimaryGoal, selected);
    router.push('/onboarding/products');
  };

  return (
    <View style={styles.container}>
      <OnboardingHero
        total={7}
        current={2}
        eyebrow="Step 3 · Scan Area"
        title="Pick the area you’ll scan consistently."
        subtitle="RadianceIQ recommends a spot based on your goal, but you can choose the region that matters most."
      />

      <View style={styles.mapCard}>
        <View style={styles.recommendationBadge}>
          <Text style={styles.recommendationText}>
            Recommended: {recommended.replace(/_/g, ' ')}
          </Text>
        </View>
        <FaceMap
          selected={selected}
          onSelect={setSelected}
          recommended={recommended}
        />
      </View>

      <View style={styles.footer}>
        <Button title="Confirm scanning area" onPress={handleConfirm} />
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
  mapCard: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
  },
  recommendationBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent + '18',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  recommendationText: {
    color: Colors.accent,
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansBold,
    textTransform: 'capitalize',
  },
  footer: {
    marginTop: Spacing.lg,
  },
});
