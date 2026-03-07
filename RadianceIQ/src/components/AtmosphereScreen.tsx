import React from 'react';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  View,
  ViewStyle,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Colors, Spacing } from '../constants/theme';

interface Props {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showsVerticalScrollIndicator?: boolean;
}

export const AtmosphereScreen: React.FC<Props> = ({
  children,
  scroll = true,
  style,
  contentContainerStyle,
  showsVerticalScrollIndicator = false,
}) => {
  const insets = useSafeAreaInsets();
  const contentStyle = [
    styles.content,
    {
      paddingTop: insets.top + Spacing.lg,
      paddingBottom: insets.bottom + Spacing.xl,
    },
    contentContainerStyle,
  ];

  return (
    <View style={[styles.root, style]}>
      <LinearGradient
        colors={[Colors.background, Colors.backgroundDeep, '#081522']}
        start={{ x: 0.1, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        colors={[Colors.glowSecondary, 'transparent']}
        start={{ x: 0.05, y: 0.05 }}
        end={{ x: 0.8, y: 0.8 }}
        style={styles.topGlow}
      />
      <LinearGradient
        colors={[Colors.glowPrimary, 'transparent']}
        start={{ x: 0.2, y: 0 }}
        end={{ x: 0.8, y: 1 }}
        style={styles.midGlow}
      />
      <View style={styles.gridOverlay} pointerEvents="none" />
      <LinearGradient
        colors={['transparent', 'rgba(2, 5, 10, 0.65)']}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.bottomVignette}
      />

      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={contentStyle}
          showsVerticalScrollIndicator={showsVerticalScrollIndicator}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={contentStyle}>{children}</View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
  },
  topGlow: {
    position: 'absolute',
    top: -120,
    left: -100,
    width: 320,
    height: 280,
    borderRadius: BorderRadius.full,
    opacity: 0.75,
  },
  midGlow: {
    position: 'absolute',
    top: 180,
    right: -120,
    width: 300,
    height: 260,
    borderRadius: BorderRadius.full,
    opacity: 0.55,
  },
  gridOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: 'transparent',
    backgroundColor: 'transparent',
  },
  bottomVignette: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 240,
  },
});
