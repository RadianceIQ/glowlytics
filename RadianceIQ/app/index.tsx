import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { AtmosphereScreen } from '../src/components/AtmosphereScreen';
import { Button } from '../src/components/Button';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../src/constants/theme';
import { useStore } from '../src/store/useStore';

export default function Index() {
  const router = useRouter();
  const onboardingComplete = useStore((s) => s.user?.onboarding_complete ?? false);
  const navigated = useRef(false);

  useEffect(() => {
    if (onboardingComplete && !navigated.current) {
      navigated.current = true;
      router.replace('/(tabs)/today');
    }
  }, [onboardingComplete]);

  return (
    <AtmosphereScreen scroll={false} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.brand}>RadianceIQ</Text>
        <View style={styles.headerDot} />
      </View>

      <View style={styles.hero}>
        <LinearGradient
          colors={[Colors.glowSecondary, Colors.glowPrimary]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.orbShell}
        >
          <View style={styles.orbRing}>
            <View style={styles.orbInner}>
              <Text style={styles.orbLetter}>R</Text>
            </View>
          </View>
        </LinearGradient>

        <Text style={styles.kicker}>Premium skin trend tracking</Text>
        <Text style={styles.title}>
          Your skin,{'\n'}
          <Text style={styles.titleAccent}>measured.</Text>
        </Text>
        <Text style={styles.subtitle}>
          Guided scans, contextual insights, and a calmer daily rhythm built for demo-ready clarity.
        </Text>

        <View style={styles.safetyCard}>
          <Text style={styles.safetyEyebrow}>Safety framing</Text>
          <Text style={styles.safetyText}>
            RadianceIQ measures skin metrics and trends over time. It does not diagnose conditions.
          </Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Button
          title="Start your baseline"
          onPress={() => router.push('/onboarding/essentials')}
          size="lg"
        />
        <Button
          title="Load demo data"
          onPress={() => router.push('/onboarding/demo-setup')}
          variant="secondary"
        />
        <Text style={styles.footerNote}>
          Demo mode seeds a finished journey so you can review home, results, and report states quickly.
        </Text>
      </View>
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    justifyContent: 'space-between',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brand: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
  },
  headerDot: {
    width: 10,
    height: 10,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  hero: {
    gap: Spacing.lg,
    paddingTop: Spacing.lg,
  },
  orbShell: {
    width: 148,
    height: 148,
    borderRadius: BorderRadius.full,
    padding: 1,
    alignSelf: 'center',
  },
  orbRing: {
    flex: 1,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9, 16, 26, 0.82)',
  },
  orbInner: {
    width: 88,
    height: 88,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surfaceOverlay,
    borderWidth: 1,
    borderColor: 'rgba(199,255,250,0.18)',
  },
  orbLetter: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.hero,
    lineHeight: 44,
  },
  kicker: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  title: {
    color: Colors.text,
    fontFamily: FontFamily.serifBold,
    fontSize: FontSize.display,
    lineHeight: 52,
  },
  titleAccent: {
    color: Colors.primaryLight,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 24,
    maxWidth: '88%',
  },
  safetyCard: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  safetyEyebrow: {
    color: Colors.warning,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  safetyText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.md,
    lineHeight: 23,
  },
  footer: {
    gap: Spacing.md,
  },
  footerNote: {
    color: Colors.textDim,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    paddingHorizontal: Spacing.md,
  },
});
