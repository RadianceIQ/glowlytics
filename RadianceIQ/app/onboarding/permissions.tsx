import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { useStore } from '../../src/store/useStore';
import {
  connectHealthData,
  getHealthConnectionState,
  getHealthSourceLabel,
} from '../../src/services/healthPermissions';

const getStatusCopy = (status?: string) => {
  switch (status) {
    case 'granted':
      return { label: 'Connected', color: Colors.success };
    case 'denied':
      return { label: 'Not granted', color: Colors.warning };
    case 'blocked':
      return { label: 'Needs settings', color: Colors.warning };
    case 'unavailable':
      return { label: 'Unavailable here', color: Colors.textMuted };
    default:
      return { label: 'Optional', color: Colors.primaryLight };
  }
};

export default function Permissions() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const updateHealthConnection = useStore((s) => s.updateHealthConnection);

  const [isChecking, setIsChecking] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const healthState = user?.health_connection;
  const healthBadge = getStatusCopy(healthState?.status);

  const checkedRef = React.useRef(false);

  useEffect(() => {
    if (checkedRef.current || !user) return;
    checkedRef.current = true;

    let isMounted = true;

    const hydrateHealthStatus = async () => {
      try {
        const nextState = await getHealthConnectionState(user.health_connection.status);
        if (isMounted) {
          updateHealthConnection({
            ...nextState,
            sync_skipped:
              user.health_connection.status !== 'granted' && user.health_connection.sync_skipped,
          });
        }
      } catch {
        if (isMounted) {
          updateHealthConnection({
            status: 'unavailable',
            availability_note: 'Health permissions require a device build to test.',
          });
        }
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    void hydrateHealthStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  const healthActionTitle = useMemo(() => {
    if (healthState?.status === 'granted') {
      return `Refresh ${getHealthSourceLabel(healthState.source)}`;
    }

    return user?.health_connection.source === 'apple_health' || !user?.health_connection.source
      ? 'Connect Apple Health'
      : 'Connect Health Connect';
  }, [healthState?.source, healthState?.status, user?.health_connection.source]);

  const handleContinue = () => {
    updateHealthConnection({
      sync_skipped: healthState?.status !== 'granted',
      last_checked_at: new Date().toISOString(),
    });
    router.push('/onboarding/baseline-scan');
  };

  const handleConnectHealth = async () => {
    setIsConnecting(true);

    try {
      const nextState = await connectHealthData(healthState?.status);
      updateHealthConnection(nextState);
    } catch (error) {
      updateHealthConnection({
        status: 'unavailable',
        availability_note:
          error instanceof Error
            ? error.message
            : 'Health permissions are unavailable in the current build.',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <OnboardingHero
        total={7}
        current={4}
        eyebrow="Step 5 · Permissions"
        title="Prepare for your first scan."
        subtitle="We’ll request access in context: camera for the scan itself, and optional health data for extra trend context."
      />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Camera</Text>
          <View style={[styles.statusBadge, { backgroundColor: Colors.primary + '16' }]}>
            <Text style={[styles.statusText, { color: Colors.primaryLight }]}>Required</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Camera access is requested on the next step, right when you start the guided baseline scan.
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Used for baseline and daily scan photos.</Text>
          <Text style={styles.bulletItem}>• You can keep using the app even if health access is skipped.</Text>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{getHealthSourceLabel(healthState?.source)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: healthBadge.color + '16' }]}>
            <Text style={[styles.statusText, { color: healthBadge.color }]}>{healthBadge.label}</Text>
          </View>
        </View>
        <Text style={styles.cardBody}>
          Read-only access helps RadianceIQ interpret skin trends with sleep and resting-heart context.
        </Text>
        <View style={styles.bulletList}>
          <Text style={styles.bulletItem}>• Read-only: sleep, resting heart rate, and HRV.</Text>
          <Text style={styles.bulletItem}>• No write access, no broad historical import, no cycle sync.</Text>
        </View>
        {isChecking ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={Colors.primary} />
            <Text style={styles.loadingText}>Checking device support…</Text>
          </View>
        ) : (
          <Text style={styles.supportNote}>
            {healthState?.availability_note || 'Connect if you want richer context later.'}
          </Text>
        )}

        <View style={styles.healthActions}>
          <Button
            title={healthActionTitle}
            variant={healthState?.status === 'granted' ? 'secondary' : 'primary'}
            onPress={handleConnectHealth}
            loading={isConnecting}
            disabled={isChecking}
          />
          {(healthState?.status === 'denied' || healthState?.status === 'blocked') && (
            <Button
              title="Open Settings"
              variant="ghost"
              onPress={() => Linking.openSettings()}
            />
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerNote}>
          Health access stays optional. Your first result should never depend on it.
        </Text>
        <Button title="Continue to baseline scan" onPress={handleContinue} />
        <Button title="Not now" variant="ghost" onPress={handleContinue} />
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
  card: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  cardTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansBold,
  },
  cardBody: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  bulletList: {
    gap: Spacing.xs,
  },
  bulletItem: {
    color: Colors.text,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  statusBadge: {
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  statusText: {
    fontSize: FontSize.xs,
    fontFamily: FontFamily.sansBold,
    textTransform: 'uppercase',
  },
  supportNote: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  healthActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  footer: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  footerNote: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
});
