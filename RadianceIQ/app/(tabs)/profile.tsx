import React, { useState } from 'react';
import { Alert, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
  Surfaces,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import {
  presentPaywall,
  presentCustomerCenter,
  checkSubscriptionStatus,
  restorePurchases,
  isTrialActive,
  trialDaysRemaining,
} from '../../src/services/subscription';
import { scheduleDailyReminder, cancelDailyReminder } from '../../src/services/notifications';
import { trackEvent, resetAnalytics } from '../../src/services/analytics';
import { createDemoSeed } from '../../src/services/demoData';
import { GamificationCard } from '../../src/components/GamificationCard';
import { LevelProgressBar } from '../../src/components/LevelProgressBar';
import { BadgeShowcase } from '../../src/components/BadgeShowcase';

let useUser: (() => { user: { primaryEmailAddress?: { emailAddress?: string } } | null | undefined }) | undefined;
let useClerk: (() => { signOut: () => Promise<void> }) | undefined;

try {
  const clerk = require('@clerk/clerk-expo');
  useUser = clerk.useUser;
  useClerk = clerk.useClerk;
} catch {
  // Clerk not available
}

const InfoRow: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <View style={styles.infoRow}>
    <Text style={styles.infoLabel}>{label}</Text>
    <Text style={styles.infoValue}>{value}</Text>
  </View>
);

export default function ProfileTab() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const gamification = useStore((s) => s.gamification);
  const subscription = useStore((s) => s.subscription);
  const setSubscription = useStore((s) => s.setSubscription);
  const notificationSettings = useStore((s) => s.notificationSettings);
  const setNotificationTime = useStore((s) => s.setNotificationTime);
  const resetAll = useStore((s) => s.resetAll);

  const [showTimePicker, setShowTimePicker] = useState(false);
  const getStreak = useStore((s) => s.getStreak);
  const streak = getStreak();

  const clerkUser = useUser ? useUser() : null;
  const clerk = useClerk ? useClerk() : null;
  const clerkEmail = clerkUser?.user?.primaryEmailAddress?.emailAddress;

  const periodLabel =
    user?.period_applicable === 'yes'
      ? 'Tracking'
      : user?.period_applicable === 'no'
        ? 'Not applicable'
        : 'Prefer not to say';

  const handleSignOut = async () => {
    if (clerk) {
      Alert.alert(
        'Sign out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out',
            style: 'destructive',
            onPress: async () => {
              trackEvent('auth_sign_out');
              resetAnalytics();
              await clerk.signOut();
              resetAll();
              router.replace('/');
            },
          },
        ],
      );
    }
  };

  const handleLoadDemo = () => {
    const demo = createDemoSeed();
    resetAll();
    const store = useStore.getState();
    store.createUser(demo.user);
    for (const p of demo.products) store.addProduct(p);
    // Load records and outputs directly into state
    useStore.setState({
      protocol: demo.protocol,
      dailyRecords: demo.records,
      modelOutputs: demo.outputs,
      gamification: demo.gamification,
    });
    store.persistData();
    Alert.alert('Demo loaded', '21 days of scan history, 4 products, and gamification data loaded.');
  };

  const handleResetAllData = () => {
    Alert.alert(
      'Reset all data',
      'This will permanently delete all your scan history, products, and settings. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete everything',
          style: 'destructive',
          onPress: () => {
            resetAll();
            router.replace('/');
          },
        },
      ],
    );
  };

  return (
    <AtmosphereScreen>
      {/* Identity header */}
      <View style={styles.identityHeader}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {(clerkEmail?.[0] || user?.age_range?.[0] || 'G').toUpperCase()}
          </Text>
        </View>
        <View style={styles.identityInfo}>
          {clerkEmail && <Text style={styles.identityEmail} numberOfLines={1}>{clerkEmail}</Text>}
          <View style={styles.identityMeta}>
            <View style={styles.tierBadge}>
              <Text style={styles.tierBadgeText}>
                {subscription.is_active ? 'Glow Pro' : isTrialActive(subscription) ? 'Trial' : 'Free'}
              </Text>
            </View>
            {streak > 0 && (
              <Text style={styles.identityStreak}>{streak} day streak</Text>
            )}
          </View>
        </View>
      </View>

      {/* Account & Subscription */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account & Plan</Text>
        {clerkEmail ? (
          <InfoRow label="Email" value={clerkEmail} />
        ) : null}
        <TouchableOpacity
          style={styles.modeButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Sign out of your account"
        >
          <Feather name="log-out" size={16} color={Colors.error} />
          <Text style={[styles.modeButtonText, { color: Colors.error }]}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => router.push('/privacy-policy')}
          activeOpacity={0.7}
          accessibilityRole="link"
          accessibilityLabel="Terms and Privacy Policy"
        >
          <Feather name="shield" size={16} color={Colors.primaryLight} />
          <Text style={styles.modeButtonText}>Terms & Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, styles.modeButtonDestructive]}
          onPress={handleResetAllData}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Reset all data"
        >
          <Feather name="trash-2" size={16} color={Colors.error} />
          <Text style={[styles.modeButtonText, { color: Colors.error }]}>Reset all data</Text>
        </TouchableOpacity>
        {__DEV__ && (
          <TouchableOpacity
            style={styles.modeButton}
            onPress={handleLoadDemo}
            activeOpacity={0.7}
          >
            <Feather name="database" size={16} color={Colors.primary} />
            <Text style={[styles.modeButtonText, { color: Colors.primary }]}>Load demo data</Text>
          </TouchableOpacity>
        )}
        {/* Subscription inline */}
        <View style={styles.divider} />
        {subscription.is_active ? (
          <>
            <InfoRow label="Plan" value="Glow Pro" />
            {subscription.expires_at && (
              <InfoRow
                label="Renews"
                value={new Date(subscription.expires_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              />
            )}
            <TouchableOpacity
              style={styles.modeButton}
              onPress={async () => {
                trackEvent('subscription_manage_tapped');
                try {
                  await presentCustomerCenter();
                } catch {
                  Alert.alert('Subscription', 'Unable to open subscription management. Please try again later.');
                }
              }}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Manage subscription"
            >
              <Feather name="settings" size={16} color={Colors.primaryLight} />
              <Text style={styles.modeButtonText}>Manage subscription</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <InfoRow
              label="Plan"
              value={isTrialActive(subscription) ? 'Free Trial' : 'Free'}
            />
            {isTrialActive(subscription) && (
              <InfoRow
                label="Trial days remaining"
                value={String(trialDaysRemaining(subscription))}
              />
            )}
            <TouchableOpacity
              style={styles.modeButton}
              accessibilityRole="button"
              accessibilityLabel="Upgrade to Glow Pro"
              onPress={async () => {
                try {
                  const purchased = await presentPaywall();
                  if (purchased) {
                    const sub = await checkSubscriptionStatus(subscription);
                    setSubscription(sub);
                  }
                } catch {
                  Alert.alert('Subscription', 'Unable to load upgrade options. Please try again later.');
                }
              }}
              activeOpacity={0.7}
            >
              <Feather name="zap" size={16} color={Colors.primary} />
              <Text style={[styles.modeButtonText, { color: Colors.primary }]}>Upgrade to Glow Pro</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeButton}
              onPress={async () => {
                try {
                  const sub = await restorePurchases(subscription);
                  setSubscription(sub);
                  if (sub.is_active) {
                    Alert.alert('Restored', 'Your subscription has been restored.');
                  } else {
                    Alert.alert('Nothing to restore', 'No previous purchases found.');
                  }
                } catch {
                  Alert.alert('Restore failed', 'Unable to restore purchases. Please try again later.');
                }
              }}
              activeOpacity={0.7}
            >
              <Feather name="refresh-cw" size={16} color={Colors.primaryLight} />
              <Text style={styles.modeButtonText}>Restore Purchases</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Notifications */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Notifications</Text>
        <TouchableOpacity
          style={styles.infoRow}
          onPress={() => {
            if (notificationSettings.notifications_enabled) {
              setShowTimePicker(true);
            }
          }}
          activeOpacity={notificationSettings.notifications_enabled ? 0.7 : 1}
        >
          <Text style={styles.infoLabel}>Daily reminder</Text>
          <Text style={styles.infoValue}>
            {notificationSettings.notifications_enabled && notificationSettings.notification_time
              ? notificationSettings.notification_time
              : 'Off'}
          </Text>
        </TouchableOpacity>
        {showTimePicker && (
          <DateTimePicker
            value={(() => {
              const [h, m] = (notificationSettings.notification_time || '08:00').split(':').map(Number);
              const d = new Date(2000, 0, 1, h, m);
              return d;
            })()}
            mode="time"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={async (_, selected) => {
              setShowTimePicker(Platform.OS === 'ios');
              if (selected) {
                const h = selected.getHours();
                const m = selected.getMinutes();
                const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                await scheduleDailyReminder(h, m);
                setNotificationTime(timeStr);
              }
            }}
            themeVariant="light"
          />
        )}
        {notificationSettings.notifications_enabled ? (
          <View style={{ gap: Spacing.sm }}>
            <TouchableOpacity
              style={styles.modeButton}
              onPress={() => setShowTimePicker(!showTimePicker)}
              activeOpacity={0.7}
            >
              <Feather name="clock" size={16} color={Colors.primary} />
              <Text style={[styles.modeButtonText, { color: Colors.primary }]}>Change time</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modeButton}
              onPress={async () => {
                await cancelDailyReminder();
                setNotificationTime(null);
                setShowTimePicker(false);
              }}
              activeOpacity={0.7}
            >
              <Feather name="bell-off" size={16} color={Colors.error} />
              <Text style={[styles.modeButtonText, { color: Colors.error }]}>Turn off reminders</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.modeButton}
            onPress={async () => {
              const defaultTime = '08:00';
              const [h, m] = defaultTime.split(':').map(Number);
              await scheduleDailyReminder(h, m);
              setNotificationTime(defaultTime);
            }}
            activeOpacity={0.7}
          >
            <Feather name="bell" size={16} color={Colors.primary} />
            <Text style={[styles.modeButtonText, { color: Colors.primary }]}>Enable daily reminder</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Your Profile — demographics + scan protocol combined */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Your Profile</Text>
        <InfoRow label="Age range" value={user?.age_range || '—'} />
        <InfoRow label="Location" value={user?.location_coarse || '—'} />
        <InfoRow label="Period tracking" value={periodLabel} />
        {user?.smoker_status !== undefined && (
          <InfoRow label="Smoker" value={user.smoker_status ? 'Yes' : 'No'} />
        )}
        {user?.drink_baseline_frequency && (
          <InfoRow label="Alcohol" value={user.drink_baseline_frequency} />
        )}
        <View style={styles.divider} />
        <InfoRow label="Goal" value={protocol?.primary_goal?.replace(/_/g, ' ') || '—'} />
        <InfoRow label="Region" value={protocol?.scan_region?.replace(/_/g, ' ') || '—'} />
        <InfoRow label="Total scans" value={String(dailyRecords.length)} />
      </View>

      {/* Progress — gamification + achievements unified */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Progress</Text>
        <GamificationCard gamification={gamification} streak={streak} />
        <View style={styles.divider} />
        <LevelProgressBar xp={gamification.xp} />
        <BadgeShowcase earnedBadges={gamification.badges} />
        <View style={styles.personalBests}>
          <InfoRow label="Longest streak" value={`${gamification.personal_bests.longest_streak} days`} />
          <InfoRow label="Lowest acne" value={gamification.personal_bests.lowest_acne < 100 ? String(gamification.personal_bests.lowest_acne) : '--'} />
          <InfoRow label="Best skin score" value={gamification.personal_bests.highest_skin_score > 0 ? String(gamification.personal_bests.highest_skin_score) : '--'} />
          <InfoRow label="Best week consistency" value={gamification.personal_bests.most_consistent_week > 0 ? `${gamification.personal_bests.most_consistent_week} / 7 days` : '--'} />
        </View>
      </View>

      <View style={styles.footerSpacer} />
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  identityHeader: {
    ...Surfaces.hero,
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.lg,
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
  },
  identityInfo: {
    flex: 1,
    gap: Spacing.xs,
  },
  identityEmail: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  identityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  tierBadge: {
    backgroundColor: Colors.surfaceOverlay,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xxs,
  },
  tierBadgeText: {
    color: Colors.primary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xxs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  identityStreak: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.divider,
    marginVertical: Spacing.xs,
  },
  card: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.md,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  infoLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
  },
  infoValue: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    textTransform: 'capitalize',
    flexShrink: 1,
    textAlign: 'right',
  },
  modeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  modeButtonDestructive: {
    borderColor: 'rgba(209, 67, 67, 0.18)',
    backgroundColor: 'rgba(209, 67, 67, 0.06)',
  },
  modeButtonText: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  personalBests: {
    marginTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    paddingTop: Spacing.sm,
  },
  footerSpacer: {
    height: Spacing.xl,
  },
});
