import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { ScannerAnimation } from '../../src/components/ScannerAnimation';

export default function ConnectionLost() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <ScannerAnimation phase="error" message="Connection lost" />
      <Text style={styles.title}>Reconnect required</Text>
      <Text style={styles.subtitle}>
        Connection lost. Reconnect to continue.
      </Text>
      <View style={styles.buttons}>
        <Button
          title="Reconnect"
          onPress={() => router.replace('/scan/connect')}
        />
        <Button
          title="Cancel scan"
          variant="ghost"
          onPress={() => router.replace('/home')}
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
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  buttons: {
    gap: Spacing.md,
  },
});
