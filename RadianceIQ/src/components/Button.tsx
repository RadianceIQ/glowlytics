import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors, BorderRadius, FontSize, Spacing } from '../constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  small?: boolean;
}

export const Button: React.FC<Props> = ({
  title, onPress, variant = 'primary', disabled, loading, style, small,
}) => {
  const bgColor = variant === 'primary' ? Colors.primary
    : variant === 'secondary' ? Colors.surfaceLight
    : 'transparent';

  const textColor = variant === 'ghost' ? Colors.primary : Colors.text;
  const borderColor = variant === 'ghost' ? Colors.primary : 'transparent';

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        styles.button,
        {
          backgroundColor: disabled ? Colors.surfaceHighlight : bgColor,
          borderColor: variant === 'ghost' ? borderColor : 'transparent',
          borderWidth: variant === 'ghost' ? 1.5 : 0,
          paddingVertical: small ? Spacing.sm : Spacing.md,
          paddingHorizontal: small ? Spacing.md : Spacing.lg,
        },
        style,
      ]}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={Colors.text} size="small" />
      ) : (
        <Text style={[
          styles.text,
          { color: disabled ? Colors.textMuted : textColor },
          small && { fontSize: FontSize.sm },
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: BorderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
  },
  text: {
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
});
