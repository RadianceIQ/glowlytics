import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/theme';
import type { Confidence } from '../types';

interface Props {
  level: Confidence;
}

const config = {
  low: { color: Colors.warning, label: 'Low Confidence', dots: 1 },
  med: { color: Colors.info, label: 'Medium Confidence', dots: 2 },
  high: { color: Colors.success, label: 'High Confidence', dots: 3 },
};

export const ConfidenceBadge: React.FC<Props> = ({ level }) => {
  const c = config[level];
  return (
    <View style={[styles.container, { backgroundColor: c.color + '15' }]}>
      <View style={styles.dots}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={[styles.dot, {
              backgroundColor: i <= c.dots ? c.color : Colors.surfaceHighlight,
            }]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    alignSelf: 'flex-start',
  },
  dots: {
    flexDirection: 'row',
    gap: 3,
    marginRight: Spacing.sm,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: FontSize.xs,
    fontWeight: '600',
  },
});
