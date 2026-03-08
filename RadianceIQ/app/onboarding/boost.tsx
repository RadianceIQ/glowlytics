import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, FontSize, FontFamily, Spacing, BorderRadius } from '../../src/constants/theme';
import { Button } from '../../src/components/Button';
import { OptionSelector } from '../../src/components/OptionSelector';
import { OnboardingHero } from '../../src/components/OnboardingHero';
import { useStore } from '../../src/store/useStore';
import { connectHealthData, getHealthSourceLabel } from '../../src/services/healthPermissions';

const getStatusTone = (status?: string) => {
  switch (status) {
    case 'granted':
      return { label: 'Connected', color: Colors.success };
    case 'denied':
      return { label: 'Permission denied', color: Colors.warning };
    case 'blocked':
      return { label: 'Open settings', color: Colors.warning };
    case 'unavailable':
      return { label: 'Unavailable', color: Colors.textMuted };
    default:
      return { label: 'Optional', color: Colors.primaryLight };
  }
};

export default function Boost() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const updateUser = useStore((s) => s.updateUser);
  const updateHealthConnection = useStore((s) => s.updateHealthConnection);

  const [smoker, setSmoker] = useState<string | null>(
    user?.smoker_status === undefined ? null : user.smoker_status ? 'yes' : 'no'
  );
  const [drinks, setDrinks] = useState<string | null>(user?.drink_baseline_frequency || null);
  const [isConnecting, setIsConnecting] = useState(false);

  const healthState = user?.health_connection;
  const statusTone = getStatusTone(healthState?.status);

  const handleDone = () => {
    updateUser({
      smoker_status: smoker === 'yes',
      drink_baseline_frequency: drinks || undefined,
      onboarding_complete: true,
    });

    updateHealthConnection({
      sync_skipped: healthState?.status !== 'granted',
      last_checked_at: new Date().toISOString(),
    });

    router.replace('/(tabs)/today');
  };

  const handleSkip = () => {
    updateHealthConnection({
      sync_skipped: true,
      last_checked_at: new Date().toISOString(),
    });
    updateUser({ onboarding_complete: true });
    router.replace('/(tabs)/today');
  };

  const handleConnectHealth = async () => {
    setIsConnecting(true);

    try {
      const nextState = await connectHealthData(healthState?.status);
      updateHealthConnection(nextState);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <OnboardingHero
        total={7}
        current={6}
        eyebrow="Step 7 · Accuracy"
        title="Add a little context for better trend readouts."
        subtitle="Keep this lightweight. Anything here is optional and meant to sharpen the story behind your scores."
      />

      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Lifestyle baseline</Text>
        <Text style={styles.helperText}>These answers stay coarse and help interpret longer-term changes.</Text>

        <Text style={styles.fieldLabel}>Do you smoke?</Text>
        <OptionSelector
          options={[
            { label: 'Yes', value: 'yes' },
            { label: 'No', value: 'no' },
          ]}
          selected={smoker}
          onSelect={setSmoker}
          horizontal
        />

        <Text style={styles.fieldLabel}>Weekly drink frequency</Text>
        <OptionSelector
          options={[
            { label: '0', value: '0' },
            { label: '1-2', value: '1-2' },
            { label: '3+', value: '3+' },
          ]}
          selected={drinks}
          onSelect={setDrinks}
          horizontal
        />
      </View>

      <View style={styles.sectionCard}>
        <View style={styles.cardHeader}>
          <Text style={styles.sectionTitle}>{getHealthSourceLabel(healthState?.source)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusTone.color + '16' }]}>
            <Text style={[styles.statusText, { color: statusTone.color }]}>{statusTone.label}</Text>
          </View>
        </View>
        <Text style={styles.helperText}>
          Health data remains optional. When connected, it helps RadianceIQ compare skin changes with sleep and resting-heart context.
        </Text>
        <Text style={styles.healthNote}>
          {healthState?.availability_note || 'If you skip this, daily check-ins still work with manual context.'}
        </Text>

        <View style={styles.healthActions}>
          <Button
            title={healthState?.status === 'granted' ? 'Refresh health access' : 'Connect health data'}
            variant={healthState?.status === 'granted' ? 'secondary' : 'primary'}
            onPress={handleConnectHealth}
            loading={isConnecting}
            disabled={healthState?.status === 'unavailable'}
          />
          {(healthState?.status === 'denied' || healthState?.status === 'blocked') && (
            <Button title="Open Settings" variant="ghost" onPress={() => Linking.openSettings()} />
          )}
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Finish onboarding" onPress={handleDone} />
        <Button title="Skip for now" variant="ghost" onPress={handleSkip} />
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontFamily: FontFamily.sansBold,
  },
  helperText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  fieldLabel: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontFamily: FontFamily.sansSemiBold,
    marginTop: Spacing.sm,
  },
  healthNote: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  healthActions: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
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
  footer: {
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
});
