import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, FontFamily, FontSize, Spacing, BorderRadius } from '../constants/theme';

interface OnboardingOptionCardProps {
  label: string;
  description?: string;
  selected: boolean;
  onPress: () => void;
  multiSelect?: boolean;
}

export const OnboardingOptionCard: React.FC<OnboardingOptionCardProps> = ({
  label,
  description,
  selected,
  onPress,
  multiSelect,
}) => {
  return (
    <TouchableOpacity
      style={[styles.card, selected && styles.cardSelected]}
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole={multiSelect ? 'checkbox' : 'radio'}
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <View style={styles.content}>
        <Text style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
        {description && (
          <Text style={styles.description}>{description}</Text>
        )}
      </View>
      {multiSelect ? (
        <View style={[styles.checkbox, selected && styles.checkboxSelected]}>
          {selected && <Text style={styles.checkmark}>&#10003;</Text>}
        </View>
      ) : (
        <View style={[styles.radio, selected && styles.radioSelected]}>
          {selected && <View style={styles.radioInner} />}
        </View>
      )}
    </TouchableOpacity>
  );
};

interface OnboardingChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const OnboardingChip: React.FC<OnboardingChipProps> = ({
  label,
  selected,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
};

interface OnboardingGridOptionProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export const OnboardingGridOption: React.FC<OnboardingGridOptionProps> = ({
  label,
  selected,
  onPress,
}) => {
  return (
    <TouchableOpacity
      style={[styles.gridOption, selected && styles.gridOptionSelected]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={[styles.gridLabel, selected && styles.gridLabelSelected]}>{label}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  // Full-width card
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  cardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceOverlay,
  },
  content: {
    flex: 1,
    gap: Spacing.xxs,
  },
  label: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.lg,
  },
  labelSelected: {
    color: Colors.primaryLight,
  },
  description: {
    color: Colors.textSecondary,
    fontFamily: FontFamily.sans,
    fontSize: FontSize.sm,
    lineHeight: 20,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: Colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.primary,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.textDim,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 16,
  },

  // Chip (multi-select)
  chip: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceOverlay,
  },
  chipLabel: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
  chipLabelSelected: {
    color: Colors.primaryLight,
  },

  // Grid option (2-column)
  gridOption: {
    flex: 1,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.xl,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceLight,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.sm,
  },
  gridOptionSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.surfaceOverlay,
  },
  gridLabel: {
    color: Colors.text,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.md,
    textAlign: 'center',
  },
  gridLabelSelected: {
    color: Colors.primaryLight,
  },
});
