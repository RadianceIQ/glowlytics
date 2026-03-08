import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { useStore } from '../../src/store/useStore';
import { createDemoSeed } from '../../src/services/demoData';

export default function DemoSetup() {
  const router = useRouter();
  const store = useStore();

  const loadDemo = () => {
    const { user, protocol, products, records, outputs } = createDemoSeed();

    store.createUser(user);
    store.updateUser({ onboarding_complete: true });

    // Set protocol directly via store internals
    useStore.setState({
      protocol,
      products,
      dailyRecords: records,
      modelOutputs: outputs,
    });

    store.persistData();
    router.replace('/(tabs)/today');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Demo Mode</Text>
        <Text style={styles.subtitle}>
          Load 21 days of simulated scan data to explore the full app experience.
        </Text>
        <Text style={styles.detail}>
          Includes:{'\n'}
          - User profile (age 25-34, NYC){'\n'}
          - Primary goal: Acne{'\n'}
          - 4 skincare products{'\n'}
          - 21 days of scan history{'\n'}
          - Trend data with cycle correlation
        </Text>
      </View>
      <View style={styles.bottom}>
        <Button title="Load Demo Data" onPress={loadDemo} />
        <Button title="Back" variant="ghost" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: 80,
    paddingBottom: Spacing.xxl,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
    marginBottom: Spacing.lg,
  },
  detail: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 22,
    backgroundColor: Colors.surfaceLight,
    padding: Spacing.md,
    borderRadius: 12,
  },
  bottom: {
    gap: Spacing.md,
  },
});
