import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, Spacing, BorderRadius } from '../src/constants/theme';
import { useStore } from '../src/store/useStore';
import { Button } from '../src/components/Button';

export default function Index() {
  const router = useRouter();
  const onboardingComplete = useStore((s) => s.user?.onboarding_complete ?? false);
  const navigated = useRef(false);

  useEffect(() => {
    if (onboardingComplete && !navigated.current) {
      navigated.current = true;
      router.replace('/home');
    }
  }, [onboardingComplete]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* Logo area */}
        <View style={styles.logoContainer}>
          <View style={styles.logoCircle}>
            <Text style={styles.logoText}>R</Text>
          </View>
        </View>

        <Text style={styles.title}>RadianceIQ</Text>
        <Text style={styles.subtitle}>Your skin, measured.</Text>

        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Measures skin metrics + trends.{'\n'}Not diagnostic.
          </Text>
        </View>
      </View>

      <View style={styles.bottom}>
        <Button
          title="Start"
          onPress={() => router.push('/onboarding/essentials')}
        />

        {/* Demo mode for hackathon */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={() => router.push('/onboarding/demo-setup')}
        >
          <Text style={styles.demoText}>Load Demo Data</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: 100,
    paddingBottom: Spacing.xxl,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    marginBottom: Spacing.xl,
  },
  logoCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  logoText: {
    fontSize: 48,
    fontWeight: '700',
    color: Colors.text,
  },
  title: {
    fontSize: FontSize.hero,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  subtitle: {
    fontSize: FontSize.lg,
    color: Colors.textSecondary,
    marginBottom: Spacing.xxl,
  },
  disclaimer: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    width: '100%',
    alignItems: 'center',
  },
  disclaimerText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  bottom: {
    gap: Spacing.md,
  },
  demoButton: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  demoText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textDecorationLine: 'underline',
  },
});
