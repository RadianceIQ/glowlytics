import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Shadows,
  Spacing,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import { CoachingTooltip } from '../../src/components/CoachingTooltip';
import { presentPaywall, checkSubscriptionStatus } from '../../src/services/subscription';
import { trackEvent } from '../../src/services/analytics';

type IconName = React.ComponentProps<typeof Feather>['name'];

const TabGlyph: React.FC<{ icon: IconName; label: string; focused: boolean }> = ({
  icon,
  label,
  focused,
}) => (
  <View style={styles.tabGlyph}>
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <Feather
        name={icon}
        size={20}
        color={focused ? Colors.text : Colors.textMuted}
      />
    </View>
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
  </View>
);

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dailyRecords = useStore((s) => s.dailyRecords);
  const isFirstScan = dailyRecords.length === 0;

  // First-scan glow animation for camera button
  const glowOpacity = useSharedValue(0.12);

  useEffect(() => {
    if (isFirstScan) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.35, { duration: 1200 }),
          withTiming(0.12, { duration: 1200 }),
        ),
        -1,
      );
    } else {
      glowOpacity.value = withTiming(0.12, { duration: 300 });
    }
  }, [isFirstScan]);

  const cameraGlowStyle = useAnimatedStyle(() => ({
    borderColor: `rgba(58, 158, 143, ${glowOpacity.value})`,
  }));

  return (
    <>
    <CoachingTooltip visible={isFirstScan} />
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { paddingBottom: 80 + Math.max(insets.bottom - 4, 0), backgroundColor: Colors.background },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <BlurView
            intensity={40}
            tint="light"
            style={[StyleSheet.absoluteFill, styles.blurFill]}
          />
        ),
        tabBarStyle: [
          styles.tabBar,
          {
            height: 64 + Math.max(insets.bottom - 4, 0),
            paddingBottom: Math.max(insets.bottom - 4, Spacing.xs),
          },
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabGlyph icon="sun" label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="trend"
        options={{
          title: 'Trend',
          tabBarIcon: ({ focused }) => (
            <TabGlyph icon="trending-up" label="Trend" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="camera"
        options={{
          title: 'Camera',
          tabBarButton: ({ onLongPress, accessibilityState }) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open camera"
              accessibilityState={accessibilityState}
              onLongPress={onLongPress}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const canScan = useStore.getState().canPerformScan();
                if (!canScan) {
                  trackEvent('paywall_shown', { trigger: 'camera_tab' });
                  const purchased = await presentPaywall();
                  if (purchased) {
                    const sub = await checkSubscriptionStatus(useStore.getState().subscription);
                    useStore.getState().setSubscription(sub);
                  }
                  if (!useStore.getState().canPerformScan()) return;
                }
                router.push('/scan/camera');
              }}
              style={styles.cameraButton}
            >
              <Animated.View style={[styles.cameraOuter, cameraGlowStyle]}>
                <View style={styles.cameraInner}>
                  <Feather name="camera" size={22} color={Colors.text} />
                </View>
              </Animated.View>
            </Pressable>
          ),
        }}
      />
      <Tabs.Screen
        name="reports"
        options={{
          title: 'Reports',
          tabBarIcon: ({ focused }) => (
            <TabGlyph icon="file-text" label="Reports" focused={focused} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ focused }) => <TabGlyph icon="user" label="Profile" focused={focused} />,
        }}
      />
    </Tabs>
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.78)',
    borderRadius: BorderRadius.full,
    borderTopWidth: 0,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.06)',
    paddingTop: Spacing.xs,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  blurFill: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  tabGlyph: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  iconWrap: {
    width: 36,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: BorderRadius.full,
  },
  iconWrapActive: {
    backgroundColor: 'rgba(58, 158, 143, 0.10)',
  },
  tabLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansMedium,
    fontSize: 10,
    letterSpacing: 0.2,
  },
  tabLabelActive: {
    color: Colors.text,
  },
  cameraButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -20,
  },
  cameraOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(58, 158, 143, 0.15)',
  },
  cameraInner: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.glow,
  },
});
