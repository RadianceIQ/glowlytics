import React, { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Colors,
  FontFamily,
  Shadows,
  Spacing,
} from '../../src/constants/theme';
import { useStore } from '../../src/store/useStore';
import { CoachingTooltip } from '../../src/components/CoachingTooltip';
import { presentPaywall, checkSubscriptionStatus } from '../../src/services/subscription';
import { trackEvent } from '../../src/services/analytics';

type IconName = React.ComponentProps<typeof Feather>['name'];

const TAB_BAR_HEIGHT = 64;
const TAB_BAR_MARGIN = Spacing.md;

const TabGlyph: React.FC<{ icon: IconName; label: string; focused: boolean }> = ({
  icon,
  label,
  focused,
}) => {
  const scale = useSharedValue(1);
  const dotOpacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(focused ? 1 : 0.92, { damping: 15, stiffness: 180 });
    dotOpacity.value = withTiming(focused ? 1 : 0, { duration: 200 });
  }, [focused]);

  const iconAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const dotAnimStyle = useAnimatedStyle(() => ({
    opacity: dotOpacity.value,
  }));

  return (
    <Animated.View style={[styles.tabGlyph, iconAnimStyle]}>
      <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
        <Feather
          name={icon}
          size={20}
          color={focused ? Colors.text : Colors.textMuted}
        />
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
      <Animated.View style={[styles.activeDot, dotAnimStyle]} />
    </Animated.View>
  );
};

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const dailyRecords = useStore((s) => s.dailyRecords);
  const isFirstScan = dailyRecords.length === 0;

  const glowOpacity = useSharedValue(0.15);
  const cameraScale = useSharedValue(1);

  useEffect(() => {
    if (isFirstScan) {
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.5, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.15, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
        ),
        -1,
      );
    } else {
      glowOpacity.value = withTiming(0.15, { duration: 300 });
    }
  }, [isFirstScan]);

  const cameraGlowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glowOpacity.value,
  }));

  const cameraPressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: cameraScale.value }],
  }));

  return (
    <>
    <CoachingTooltip visible={isFirstScan} />
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: {
          paddingBottom: TAB_BAR_HEIGHT + TAB_BAR_MARGIN + insets.bottom,
          backgroundColor: Colors.background,
        },
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarBackground: () => (
          <BlurView
            intensity={60}
            tint="systemChromeMaterialLight"
            style={styles.blurFill}
          />
        ),
        tabBarStyle: [
          styles.tabBar,
          {
            height: TAB_BAR_HEIGHT,
            bottom: TAB_BAR_MARGIN + insets.bottom,
          },
        ],
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="today"
        options={{
          title: 'Today',
          tabBarIcon: ({ focused }) => <TabGlyph icon="sun" label="Today" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'Products',
          tabBarIcon: ({ focused }) => (
            <TabGlyph icon="shopping-bag" label="Products" focused={focused} />
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
              onPressIn={() => {
                cameraScale.value = withSpring(0.9, { damping: 15, stiffness: 200 });
              }}
              onPressOut={() => {
                cameraScale.value = withSpring(1, { damping: 15, stiffness: 200 });
              }}
              onPress={async () => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                const canScan = useStore.getState().canPerformScan();
                if (!canScan) {
                  trackEvent('paywall_shown', { trigger: 'camera_tab' });
                  try {
                    const purchased = await presentPaywall();
                    if (purchased) {
                      const sub = await checkSubscriptionStatus(useStore.getState().subscription);
                      useStore.getState().setSubscription(sub);
                    }
                  } catch {
                    // RevenueCat config error — allow scan anyway
                  }
                  if (!useStore.getState().canPerformScan()) return;
                }
                router.push('/scan/camera');
              }}
              style={styles.cameraButton}
            >
              <Animated.View style={[styles.cameraOuter, cameraGlowStyle, cameraPressStyle]}>
                <View style={styles.cameraInner}>
                  <Feather name="camera" size={22} color="#FFFFFF" />
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
    backgroundColor: 'rgba(255, 255, 255, 0.65)',
    borderRadius: BorderRadius.full,
    borderTopWidth: 0,
    borderWidth: 0,
    paddingTop: Spacing.xs,
    elevation: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
  },
  blurFill: {
    flex: 1,
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  tabGlyph: {
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
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
    letterSpacing: 0.3,
  },
  tabLabelActive: {
    color: Colors.text,
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 1,
  },
  cameraButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraOuter: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255, 255, 255, 0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(58, 158, 143, 0.12)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
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
