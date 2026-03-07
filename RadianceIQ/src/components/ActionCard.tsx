import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/theme';

interface Props {
  driver: string;
  action: string;
  escalation?: boolean;
}

export const ActionCard: React.FC<Props> = ({ driver, action, escalation }) => {
  return (
    <View style={[styles.container, escalation && styles.escalation]}>
      <View style={styles.header}>
        <Text style={styles.icon}>{escalation ? '!' : 'i'}</Text>
        <Text style={styles.driver}>
          {driver.charAt(0).toUpperCase() + driver.slice(1).replace(/_/g, ' ')}
        </Text>
      </View>
      <Text style={styles.action}>{action}</Text>
      {escalation && (
        <Text style={styles.escalationText}>
          Consider sharing a report with a clinician for context.
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.primary + '15',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.primary,
  },
  escalation: {
    backgroundColor: Colors.warning + '15',
    borderLeftColor: Colors.warning,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.primary,
    color: Colors.text,
    fontSize: FontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 20,
    marginRight: Spacing.sm,
    overflow: 'hidden',
  },
  driver: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  action: {
    color: Colors.text,
    fontSize: FontSize.md,
    lineHeight: 22,
  },
  escalationText: {
    color: Colors.warning,
    fontSize: FontSize.sm,
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
});
