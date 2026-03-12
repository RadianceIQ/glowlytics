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
import { computeProductEffectiveness } from '../../src/services/ingredientDB';
import {
  buildOverallSkinInsight,
  getLatestDailyForOutput,
} from '../../src/services/skinInsights';

let useUser: (() => { user: { primaryEmailAddress?: { emailAddress?: string } } | null | undefined }) | undefined;
let useClerk: (() => { signOut: () => Promise<void> }) | undefined;

try {
  const clerk = require('@clerk/clerk-expo');
  useUser = clerk.useUser;
  useClerk = clerk.useClerk;
} catch {
  // Clerk not available in demo mode
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
  const loadDemoData = useStore((s) => s.loadDemoData);
  const resetAll = useStore((s) => s.resetAll);

  const clerkUser = useUser ? useUser() : null;
  const clerk = useClerk ? useClerk() : null;
  const clerkEmail = clerkUser?.user?.primaryEmailAddress?.emailAddress;

  const isDemo = dailyRecords.length >= 14;

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
    return buildOverallSkinInsight({ latestOutput, baselineOutput: baseline, latestDaily });
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
              await clerk.signOut();
              resetAll();
              router.replace('/');
            },
          },
        ],
      );
    } else {
      handleSwitchToNew();
    }
  };

  const handleSwitchToNew = () => {
    Alert.alert(
      'Switch to new user',
      'This will clear all data and start fresh from the welcome screen.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            resetAll();
            router.replace('/');
          },
        },
      ],
    );
  };

  const handleLoadDemo = () => {
    Alert.alert(
      'Load demo data',
      'This will replace your current data with 21 days of simulated scan history.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Load',
          onPress: () => {
            loadDemoData();
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

      {/* User Mode Toggle */}
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>User mode</Text>
          <View style={styles.modeBadge}>
            <View style={[styles.modeDot, isDemo ? styles.modeDotDemo : styles.modeDotCustom]} />
            <Text style={styles.modeBadgeText}>{isDemo ? 'Demo' : 'Custom'}</Text>
          </View>
        </View>

        <Text style={styles.modeDescription}>
          {isDemo
            ? 'Running with simulated scan history. Switch to new user to start fresh.'
            : 'Running with your own data. Load demo to explore the full experience.'}
        </Text>

        <View style={styles.modeActions}>
          {isDemo ? (
            <TouchableOpacity style={styles.modeButton} onPress={handleSwitchToNew} activeOpacity={0.7}>
              <Feather name="user-plus" size={16} color={Colors.primaryLight} />
              <Text style={styles.modeButtonText}>Switch to new user</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.modeButton} onPress={handleLoadDemo} activeOpacity={0.7}>
              <Feather name="database" size={16} color={Colors.primaryLight} />
              <Text style={styles.modeButtonText}>Load demo data</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.modeButton, styles.modeButtonSecondary]}
            onPress={handleSwitchToNew}
            activeOpacity={0.7}
          >
            <Feather name="refresh-cw" size={16} color={Colors.warning} />
            <Text style={[styles.modeButtonText, { color: Colors.warning }]}>Reset all data</Text>
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

  // Mode toggle
  modeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  modeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  modeDotDemo: {
    backgroundColor: Colors.secondary,
  },
  modeDotCustom: {
    backgroundColor: Colors.primary,
  },
  modeBadgeText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  modeDescription: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  modeActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
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
  modeButtonSecondary: {
    borderColor: 'rgba(255, 200, 87, 0.2)',
    backgroundColor: 'rgba(255, 200, 87, 0.06)',
  },
  modeButtonText: {
    color: Colors.primaryLight,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  footerSpacer: {
    height: Spacing.xl,
  },
});
