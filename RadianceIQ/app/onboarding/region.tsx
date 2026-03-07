import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Colors, FontSize, Spacing } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { FaceMap } from '../../src/components/FaceMap';
import { ProgressDots } from '../../src/components/ProgressDots';
import { useStore } from '../../src/store/useStore';
import type { ScanRegion, PrimaryGoal } from '../../src/types';

const getRecommended = (goal: string): ScanRegion => {
  switch (goal) {
    case 'acne': return 'left_cheek';
    case 'sun_damage': return 'temple';
    case 'skin_age': return 'crows_feet';
    default: return 'left_cheek';
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
      <ProgressDots total={6} current={2} />

      <Text style={styles.title}>Select scanning area</Text>
      <Text style={styles.subtitle}>
        We recommend a region based on your goal. You can change it anytime.
      </Text>

      <View style={styles.mapContainer}>
        <FaceMap
          selected={selected}
          onSelect={setSelected}
          recommended={recommended}
        />
      </View>

      <View style={styles.bottom}>
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
  mapContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  bottom: {
    marginTop: Spacing.lg,
  },
});
