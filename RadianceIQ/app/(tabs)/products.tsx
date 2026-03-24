import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import { AtmosphereScreen } from '../../src/components/AtmosphereScreen';
import { ProductCard } from '../../src/components/ProductCard';
import { AddProductSheet } from '../../src/components/AddProductSheet';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Shadows,
  Spacing,
  Surfaces,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import { computeProductEffectiveness } from '../../src/services/ingredientDB';
import {
  buildOverallSkinInsight,
  getLatestDailyForOutput,
} from '../../src/services/skinInsights';
import { trackEvent } from '../../src/services/analytics';

const RING_SIZE = 72;
const RING_STROKE = 5;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function RoutineScoreRing({ score }: { score: number }) {
  const progress = Math.min(score, 100) / 100;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const color =
    score >= 75 ? Colors.success :
    score >= 55 ? Colors.primary :
    score >= 35 ? Colors.warning :
    Colors.error;

  return (
    <View style={ringStyles.container}>
      <Svg width={RING_SIZE} height={RING_SIZE}>
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={color + '20'}
          strokeWidth={RING_STROKE}
          fill="none"
        />
        <Circle
          cx={RING_SIZE / 2}
          cy={RING_SIZE / 2}
          r={RING_RADIUS}
          stroke={color}
          strokeWidth={RING_STROKE}
          fill="none"
          strokeDasharray={`${RING_CIRCUMFERENCE}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
        />
      </Svg>
      <Text style={[ringStyles.text, { color }]}>{score}</Text>
    </View>
  );
}

const ringStyles = StyleSheet.create({
  container: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    position: 'absolute',
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xl,
  },
});

export default function ProductsTab() {
  const router = useRouter();
  const products = useStore((s) => s.products);
  const protocol = useStore((s) => s.protocol);
  const modelOutputs = useStore((s) => s.modelOutputs);
  const dailyRecords = useStore((s) => s.dailyRecords);

  const [showAddSheet, setShowAddSheet] = useState(false);

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

  const productData = useMemo(() => {
    if (!protocol?.primary_goal) return [];
    return products.map((p) => {
      const result = computeProductEffectiveness(p, protocol.primary_goal, overallInsight?.signals);
      return {
        product: p,
        score: result.score,
        topContributor: result.topContributors[0] || undefined,
      };
    });
  }, [products, protocol, overallInsight]);

  const routineScore = useMemo(() => {
    if (productData.length === 0) return 0;
    const sum = productData.reduce((acc, d) => acc + d.score, 0);
    return Math.round(sum / productData.length);
  }, [productData]);

  return (
    <AtmosphereScreen>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>Your Products</Text>
        <Text style={styles.count}>{products.length} product{products.length !== 1 ? 's' : ''}</Text>
      </View>

      {/* Routine Score Card */}
      {products.length > 0 && (
        <View style={styles.scoreCard}>
          <View style={styles.scoreCardContent}>
            <View style={styles.scoreTextCol}>
              <Text style={styles.scoreLabel}>Routine Score</Text>
              <Text style={styles.scoreDesc}>
                Average effectiveness across your products
              </Text>
            </View>
            <RoutineScoreRing score={routineScore} />
          </View>
        </View>
      )}

      {/* Product List */}
      {productData.length > 0 ? (
        <View style={styles.list}>
          {productData.map((d) => (
            <ProductCard
              key={d.product.user_product_id}
              product={d.product}
              score={d.score}
              topContributor={d.topContributor}
              onPress={() => router.push({ pathname: '/product/[id]', params: { id: d.product.user_product_id } })}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconWrap}>
            <Feather name="shopping-bag" size={40} color={Colors.textDim} />
          </View>
          <Text style={styles.emptyTitle}>No products yet</Text>
          <Text style={styles.emptyDesc}>
            Add your skincare products to track their effectiveness and get personalized recommendations.
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => setShowAddSheet(true)}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Add your first product"
          >
            <Feather name="plus" size={18} color="#FFFFFF" />
            <Text style={styles.emptyButtonText}>Add your first product</Text>
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.footerSpacer} />

      {/* FAB */}
      {products.length > 0 && (
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setShowAddSheet(true)}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Add product"
        >
          <Feather name="plus" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <AddProductSheet visible={showAddSheet} onClose={() => setShowAddSheet(false)} />
    </AtmosphereScreen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: Spacing.lg,
  },
  eyebrow: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xxl,
  },
  count: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
  },
  scoreCard: {
    ...Surfaces.hero,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  scoreCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreTextCol: {
    flex: 1,
    gap: Spacing.xs,
    marginRight: Spacing.md,
  },
  scoreLabel: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  scoreDesc: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  list: {
    gap: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.md,
  },
  emptyIconWrap: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceOverlay,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  emptyTitle: {
    color: Colors.text,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.lg,
  },
  emptyDesc: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.sm,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: Spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingVertical: Spacing.sm + 4,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    ...Shadows.glow,
  },
  emptyButtonText: {
    color: Colors.textOnDark,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.md,
  },
  fab: {
    position: 'absolute',
    bottom: Spacing.lg,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
  footerSpacer: {
    height: Spacing.xxl + 40,
  },
});
