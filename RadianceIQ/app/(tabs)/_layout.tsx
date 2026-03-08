import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  BorderRadius,
  Colors,
  FontFamily,
  FontSize,
  Shadows,
  Spacing,
} from '../../src/constants/theme';

type IconName = React.ComponentProps<typeof Feather>['name'];

const TabGlyph: React.FC<{ icon: IconName; label: string; focused: boolean }> = ({
  icon,
  label,
  focused,
}) => (
  <View style={styles.tabGlyph}>
    <Feather
      name={icon}
      size={18}
      color={focused ? Colors.primaryLight : Colors.textMuted}
    />
    <Text style={[styles.tabLabel, focused && styles.tabLabelActive]}>{label}</Text>
  </View>
);

export default function TabsLayout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: [
          styles.tabBar,
          {
            height: 70 + Math.max(insets.bottom - 2, 0),
            paddingBottom: Math.max(insets.bottom, Spacing.sm),
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
              onPress={() => router.push('/scan/connect')}
              style={styles.cameraButton}
            >
              <View style={styles.cameraInner}>
                <Feather name="camera" size={17} color={Colors.backgroundDeep} />
                <Text style={styles.cameraLabel}>Camera</Text>
              </View>
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
  );
}

const styles = StyleSheet.create({
  tabBar: {
    position: 'absolute',
    left: Spacing.md,
    right: Spacing.md,
    bottom: Spacing.md,
    backgroundColor: Colors.glassStrong,
    borderRadius: BorderRadius.xxl,
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopWidth: 1,
    paddingTop: Spacing.xs,
    ...Shadows.card,
  },
  tabGlyph: {
    minWidth: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  tabLabel: {
    color: Colors.textMuted,
    fontFamily: FontFamily.sansSemiBold,
    fontSize: FontSize.xs,
    letterSpacing: 0.25,
  },
  tabLabelActive: {
    color: Colors.primaryLight,
  },
  cameraButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -14,
  },
  cameraInner: {
    minWidth: 78,
    minHeight: 50,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    borderWidth: 1,
    borderColor: 'rgba(199, 255, 250, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    ...Shadows.glow,
  },
  cameraLabel: {
    color: Colors.backgroundDeep,
    fontFamily: FontFamily.sansBold,
    fontSize: FontSize.xs,
    letterSpacing: 0.2,
  },
});
