import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Colors, Spacing } from '../constants/theme';

interface Props {
  total: number;
  current: number;
}

export const ProgressDots: React.FC<Props> = ({ total, current }) => {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          style={[
            styles.dot,
            i === current && styles.dotActive,
            i < current && styles.dotComplete,
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.surfaceHighlight,
  },
  dotActive: {
    backgroundColor: Colors.primary,
    width: 24,
  },
  dotComplete: {
    backgroundColor: Colors.primary + '60',
  },
});
