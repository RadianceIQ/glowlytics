import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { Button } from '../../src/components/Button';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';

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
  const products = useStore((s) => s.products);
  const dailyRecords = useStore((s) => s.dailyRecords);

  const periodLabel =
    user?.period_applicable === 'yes'
      ? 'Tracking'
      : user?.period_applicable === 'no'
        ? 'Not applicable'
        : 'Prefer not to say';

  return (
    <AtmosphereScreen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Profile</Text>
        <Text style={styles.title}>Your details</Text>
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
          products.map((p) => (
            <View key={p.user_product_id} style={styles.productRow}>
              <View style={styles.productInfo}>
                <Text style={styles.productName}>{p.product_name}</Text>
                <Text style={styles.productMeta}>{p.usage_schedule} · {p.ingredients_list.length} ingredients</Text>
              </View>
            </View>
          ))
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

      {/* Reset */}
      <View style={styles.footer}>
        <Button
          title="Reset demo"
          variant="ghost"
          size="sm"
          onPress={() => {
            useStore.getState().resetAll();
            router.replace('/');
          }}
        />
      </View>
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
  productName: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
  },
  productMeta: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
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
  footer: {
    alignItems: 'center',
    marginTop: Spacing.lg,
    paddingBottom: Spacing.xl,
  },
});
