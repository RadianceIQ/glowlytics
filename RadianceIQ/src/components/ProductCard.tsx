import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Svg, { Circle } from 'react-native-svg';
import type { ProductEntry } from '../types';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Spacing,
} from '../constants/theme';

interface Props {
  product: ProductEntry;
  score?: number;
  topContributor?: string;
  onPress: () => void;
}

const RING_SIZE = 40;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function ScoreRing({ score }: { score: number }) {
  const progress = Math.min(score, 100) / 100;
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const color =
    score >= 75 ? Colors.success :
    score >= 55 ? Colors.primary :
    score >= 35 ? Colors.warning :
    Colors.error;

  return (
    <View style={styles.ringContainer}>
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
      <Text style={[styles.ringText, { color }]}>{score}</Text>
    </View>
  );
}

export const ProductCard: React.FC<Props> = ({ product, score, topContributor, onPress }) => {
  const usageBadgeColor =
    product.usage_schedule === 'AM' ? Colors.warning :
    product.usage_schedule === 'PM' ? Colors.secondary :
    Colors.primary;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.content}>
        <View style={styles.topRow}>
          <View style={styles.nameCol}>
            <Text style={styles.productName} numberOfLines={1}>{product.product_name}</Text>
            {product.brand && (
              <Text style={styles.brand} numberOfLines={1}>{product.brand}</Text>
            )}
          </View>
          {score !== undefined && <ScoreRing score={score} />}
        </View>

        <View style={styles.metaRow}>
          <View style={[styles.usageBadge, { backgroundColor: usageBadgeColor + '18', borderColor: usageBadgeColor + '30' }]}>
            <Text style={[styles.usageBadgeText, { color: usageBadgeColor }]}>{product.usage_schedule}</Text>
          </View>
          <Text style={styles.metaText}>
            {product.ingredients_list.length} ingredient{product.ingredients_list.length !== 1 ? 's' : ''}
          </Text>
          {topContributor && (
            <Text style={styles.contributorText} numberOfLines={1}>{topContributor}</Text>
          )}
        </View>
      </View>
      <Feather name="chevron-right" size={16} color={Colors.textMuted} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.glass,
    borderRadius: BorderRadius.xl,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  content: {
    flex: 1,
    gap: Spacing.sm,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  nameCol: {
    flex: 1,
    gap: 2,
  },
  productName: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
  },
  brand: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexWrap: 'wrap',
  },
  usageBadge: {
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  usageBadgeText: {
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xs,
    letterSpacing: 0.3,
  },
  metaText: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
  },
  contributorText: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sansMedium,
    fontSize: FontSize.xs,
    flexShrink: 1,
  },
  ringContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringText: {
    position: 'absolute',
    fontFamily: FontFamily.sansBold,
    fontSize: 11,
  },
});
