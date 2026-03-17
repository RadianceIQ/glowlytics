import React, { useMemo } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import {
  presentPaywall,
  presentCustomerCenter,
  checkSubscriptionStatus,
  remainingFreeScans,
} from '../../src/services/subscription';
import { trackEvent, resetAnalytics } from '../../src/services/analytics';
import { createDemoSeed } from '../../src/services/demoData';
import { computeProductEffectiveness } from '../../src/services/ingredientDB';
import {
  buildOverallSkinInsight,
  getLatestDailyForOutput,
} from '../../src/services/skinInsights';
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

const EffectivenessBadge: React.FC<{ score: number }> = ({ score }) => {
  const color =
    score >= 75 ? Colors.success :
    score >= 55 ? Colors.primary :
    score >= 35 ? Colors.warning :
    Colors.error;

  return (
    <View style={[styles.effectivenessBadge, { backgroundColor: color + '20', borderColor: color + '40' }]}>
      <Text style={[styles.effectivenessText, { color }]}>{score}%</Text>
    </View>
  );
};

export default function ProfileTab() {
  const router = useRouter();
  const user = useStore((s) => s.user);
  const protocol = useStore((s) => s.protocol);
  const products = useStore((s) => s.products);
  const dailyRecords = useStore((s) => s.dailyRecords);
  const modelOutputs = useStore((s) => s.modelOutputs);
  const gamification = useStore((s) => s.gamification);
  const subscription = useStore((s) => s.subscription);
  const setSubscription = useStore((s) => s.setSubscription);
  const resetAll = useStore((s) => s.resetAll);

  const clerkUser = useUser ? useUser() : null;
  const clerk = useClerk ? useClerk() : null;
  const clerkEmail = clerkUser?.user?.primaryEmailAddress?.emailAddress;

  const periodLabel =
    user?.period_applicable === 'yes'
      ? 'Tracking'
      : user?.period_applicable === 'no'
        ? 'Not applicable'
        : 'Prefer not to say';

  // Compute overall insight for personalized scoring
  const overallInsight = useMemo(() => {
    const latestOutput = modelOutputs.length > 0 ? modelOutputs[modelOutputs.length - 1] : null;
    const baseline = modelOutputs.length > 0 ? modelOutputs[0] : null;
    const latestDaily = getLatestDailyForOutput(latestOutput, dailyRecords);
    return buildOverallSkinInsight({
      latestOutput,
      baselineOutput: baseline,
      latestDaily,
      serverSignalScores: latestOutput?.signal_scores,
      serverSignalFeatures: latestOutput?.signal_features,
      serverSignalConfidence: latestOutput?.signal_confidence,
      serverLesions: latestOutput?.lesions,
    });
  }, [modelOutputs, dailyRecords]);

  // Compute product effectiveness scores
  const productScores = useMemo(() => {
    if (!protocol?.primary_goal) return new Map<string, number>();
    const scores = new Map<string, number>();
    for (const p of products) {
      const result = computeProductEffectiveness(p, protocol.primary_goal, overallInsight?.signals);
      scores.set(p.user_product_id, result.score);
    }
    return scores;
  }, [products, protocol, overallInsight]);

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
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Your details</Text>
      </View>

      {/* Account */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        {clerkEmail ? (
          <InfoRow label="Email" value={clerkEmail} />
        ) : null}
        <TouchableOpacity
          style={styles.modeButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <Feather name="log-out" size={16} color={Colors.error} />
          <Text style={[styles.modeButtonText, { color: Colors.error }]}>Sign out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.modeButton}
          onPress={() => router.push('/privacy-policy')}
          activeOpacity={0.7}
        >
          <Feather name="shield" size={16} color={Colors.primaryLight} />
          <Text style={styles.modeButtonText}>Privacy Policy</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.modeButton, styles.modeButtonDestructive]}
          onPress={handleResetAllData}
          activeOpacity={0.7}
        >
          <Feather name="trash-2" size={16} color={Colors.error} />
          <Text style={[styles.modeButtonText, { color: Colors.error }]}>Reset all data</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.modeButton}
          onPress={handleLoadDemo}
          activeOpacity={0.7}
        >
          <Feather name="database" size={16} color={Colors.primary} />
          <Text style={[styles.modeButtonText, { color: Colors.primary }]}>Load demo data</Text>
        </TouchableOpacity>
      </View>

      {/* Subscription */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Subscription</Text>
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
            >
              <Feather name="settings" size={16} color={Colors.primaryLight} />
              <Text style={styles.modeButtonText}>Manage subscription</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <InfoRow label="Plan" value="Free" />
            <InfoRow
              label="Free scans remaining"
              value={String(remainingFreeScans(subscription))}
            />
            <TouchableOpacity
              style={styles.modeButton}
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
          </>
        )}
      </View>

      {/* Demographics */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Demographics</Text>
        <InfoRow label="Age range" value={user?.age_range || '—'} />
        <InfoRow label="Location" value={user?.location_coarse || '—'} />
        <InfoRow label="Period tracking" value={periodLabel} />
        {user?.smoker_status !== undefined && (
          <InfoRow label="Smoker" value={user.smoker_status ? 'Yes' : 'No'} />
        )}
        {user?.drink_baseline_frequency && (
          <InfoRow label="Alcohol" value={user.drink_baseline_frequency} />
        )}
      </View>

      {/* Scan protocol */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Scan protocol</Text>
        <InfoRow label="Goal" value={protocol?.primary_goal?.replace(/_/g, ' ') || '—'} />
        <InfoRow label="Region" value={protocol?.scan_region?.replace(/_/g, ' ') || '—'} />
        <InfoRow label="Total scans" value={String(dailyRecords.length)} />
      </View>

      {/* Achievements */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Achievements</Text>
        <LevelProgressBar xp={gamification.xp} />
        <BadgeShowcase earnedBadges={gamification.badges} />

        {/* Personal bests */}
        <View style={styles.personalBests}>
          <InfoRow label="Longest streak" value={`${gamification.personal_bests.longest_streak} days`} />
          <InfoRow label="Lowest acne" value={gamification.personal_bests.lowest_acne < 100 ? String(gamification.personal_bests.lowest_acne) : '--'} />
          <InfoRow label="Best skin score" value={gamification.personal_bests.highest_skin_score > 0 ? String(gamification.personal_bests.highest_skin_score) : '--'} />
          <InfoRow label="Best week consistency" value={gamification.personal_bests.most_consistent_week > 0 ? `${gamification.personal_bests.most_consistent_week} / 7 days` : '--'} />
        </View>
      </View>

      {/* Products */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>Products</Text>
          <Text style={styles.productCount}>{products.length}</Text>
        </View>

        {products.length > 0 ? (
          products.map((p) => {
            const score = productScores.get(p.user_product_id);
            return (
              <TouchableOpacity
                key={p.user_product_id}
                style={styles.productRow}
                activeOpacity={0.7}
                onPress={() => router.push({ pathname: '/product/[id]', params: { id: p.user_product_id } })}
              >
                <View style={styles.productInfo}>
                  <View style={styles.productNameRow}>
                    <Text style={styles.productName} numberOfLines={1}>{p.product_name}</Text>
                    {score !== undefined && <EffectivenessBadge score={score} />}
                  </View>
                  <Text style={styles.productMeta}>{p.usage_schedule} · {p.ingredients_list.length} ingredients</Text>
                </View>
                <Feather name="chevron-right" size={16} color={Colors.textMuted} />
              </TouchableOpacity>
            );
          })
        ) : (
          <Text style={styles.emptyText}>No products added yet.</Text>
        )}

        <View style={styles.productActions}>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => router.push('/onboarding/products')}
          >
            <Feather name="plus" size={16} color={Colors.primaryLight} />
            <Text style={styles.addButtonText}>Add a Product</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.footerSpacer} />
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  title: {
    marginTop: Spacing.xs,
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
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
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.md,
  },
  productCount: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
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
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  productInfo: {
    flex: 1,
    gap: 2,
  },
  productNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  productName: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    flexShrink: 1,
  },
  productMeta: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  effectivenessBadge: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  effectivenessText: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xs,
  },
  emptyText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    paddingVertical: Spacing.sm,
  },
  productActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  addButton: {
    flex: 1,
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
  addButtonText: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
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
