import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/theme';

interface Props {
  label: string;
  score: number;
  delta?: number;
  color: string;
  sparklineData?: number[];
  compact?: boolean;
}

const Sparkline: React.FC<{ data: number[]; color: string; width: number; height: number }> = ({
  data, color, width, height,
}) => {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const stepX = width / (data.length - 1);

  const points = data.map((val, i) => ({
    x: i * stepX,
    y: height - ((val - min) / range) * height,
  }));

  return (
    <View style={{ width, height, flexDirection: 'row', alignItems: 'flex-end' }}>
      {data.map((val, i) => {
        const barHeight = Math.max(2, ((val - min) / range) * height);
        return (
          <View
            key={i}
            style={{
              width: Math.max(2, stepX - 1),
              height: barHeight,
              backgroundColor: color,
              opacity: 0.6 + (i / data.length) * 0.4,
              marginRight: 1,
              borderRadius: 1,
            }}
          />
        );
      })}
    </View>
  );
};

export const ScoreTile: React.FC<Props> = ({
  label, score, delta, color, sparklineData, compact,
}) => {
  const getScoreLabel = (s: number) => {
    if (s <= 25) return 'Low';
    if (s <= 50) return 'Moderate';
    if (s <= 75) return 'Elevated';
    return 'High';
  };

  return (
    <View style={[styles.container, { borderLeftColor: color }]}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        <Text style={[styles.score, { color }]}>{score}</Text>
        <Text style={styles.scoreMax}>/100</Text>
        {delta !== undefined && (
          <View style={[styles.deltaBadge, {
            backgroundColor: delta <= 0 ? Colors.success + '20' : Colors.error + '20',
          }]}>
            <Text style={[styles.deltaText, {
              color: delta <= 0 ? Colors.success : Colors.error,
            }]}>
              {delta > 0 ? '+' : ''}{delta}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.scoreLabel}>{getScoreLabel(score)}</Text>
      {sparklineData && sparklineData.length > 1 && !compact && (
        <View style={styles.sparkline}>
          <Sparkline data={sparklineData} color={color} width={120} height={30} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    flex: 1,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: FontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: Spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  score: {
    fontSize: FontSize.xxl,
    fontWeight: '700',
  },
  scoreMax: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginLeft: 2,
  },
  scoreLabel: {
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  deltaBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    marginLeft: Spacing.sm,
  },
  deltaText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
  },
  sparkline: {
    marginTop: Spacing.sm,
  },
});
