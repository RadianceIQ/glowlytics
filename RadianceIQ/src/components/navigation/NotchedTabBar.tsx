import React, { useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BorderRadius, Colors, FontFamily, Spacing } from '../../constants/theme';

const TAB_VISUAL_HEIGHT = 74;
const CAMERA_SIZE = 58;

type TabConfig = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

const TAB_ORDER: TabConfig[] = [
  { name: 'today', label: 'Today', icon: 'sun' },
  { name: 'products', label: 'Products', icon: 'shopping-bag' },
  { name: 'camera', label: 'Camera', icon: 'camera' },
  { name: 'reports', label: 'Reports', icon: 'file-text' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

export const DOCKED_TAB_SPACE = TAB_VISUAL_HEIGHT + 10;

type NotchedTabBarProps = BottomTabBarProps & {
  onCameraPress: () => void;
  pulseCamera?: boolean;
};

export function NotchedTabBar({
  state,
  descriptors,
  navigation,
  onCameraPress,
  pulseCamera = false,
}: NotchedTabBarProps) {
  const insets = useSafeAreaInsets();
  const [isKeyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSub = Keyboard.addListener(showEvent, () => setKeyboardOpen(true));
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardOpen(false));

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  const focusedRouteKey = state.routes[state.index]?.key;
  const focusedOptions = focusedRouteKey ? descriptors[focusedRouteKey]?.options : undefined;
  const hideOnKeyboard = focusedOptions?.tabBarHideOnKeyboard ?? true;

  const indexByName = useMemo(() => {
    return new Map(state.routes.map((route, index) => [route.name, index]));
  }, [state.routes]);

  if (hideOnKeyboard && isKeyboardOpen) {
    return null;
  }

  const renderTabButton = (tab: TabConfig) => {
    const index = indexByName.get(tab.name);
    if (typeof index !== 'number') {
      return <View key={tab.name} style={styles.tabSlot} />;
    }

    const route = state.routes[index];
    const isFocused = state.index === index;
    const options = descriptors[route.key]?.options;

    const onPress = () => {
      if (tab.name === 'camera') {
        onCameraPress();
        return;
      }

      const event = navigation.emit({
        type: 'tabPress',
        target: route.key,
        canPreventDefault: true,
      });

      if (!isFocused && !event.defaultPrevented) {
        navigation.navigate(route.name, route.params);
      }
    };

    const onLongPress = () => {
      if (tab.name === 'camera') return;
      navigation.emit({
        type: 'tabLongPress',
        target: route.key,
      });
    };

    if (tab.name === 'camera') {
      return (
        <View key={tab.name} style={styles.cameraSlot}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={options?.tabBarAccessibilityLabel ?? 'Open camera'}
            accessibilityState={{ selected: isFocused }}
            onPress={onPress}
            style={({ pressed }) => [
              styles.cameraOuter,
              pulseCamera && styles.cameraOuterPulse,
              pressed && styles.cameraOuterPressed,
            ]}
          >
            <View style={styles.cameraInner}>
              <Feather name="camera" size={22} color="#FFFFFF" />
            </View>
          </Pressable>
        </View>
      );
    }

    return (
      <Pressable
        key={tab.name}
        accessibilityRole="button"
        accessibilityState={{ selected: isFocused }}
        accessibilityLabel={options?.tabBarAccessibilityLabel}
        testID={options?.tabBarButtonTestID}
        onPress={onPress}
        onLongPress={onLongPress}
        style={styles.tabSlot}
      >
        <View style={[styles.iconWrap, isFocused && styles.iconWrapActive]}>
          <Feather name={tab.icon} size={20} color={isFocused ? Colors.text : Colors.textMuted} />
        </View>
        <Text style={[styles.tabLabel, isFocused && styles.tabLabelActive]}>{tab.label}</Text>
        <View style={[styles.activeDot, { opacity: isFocused ? 1 : 0 }]} />
      </Pressable>
    );
  };

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={[styles.dockedWrap, { paddingBottom: Math.max(insets.bottom - 2, 8) }]}>
        <View style={styles.tabBar}>
          <View style={styles.cutoutMask} />
          <View style={styles.tabsRow}>
            {TAB_ORDER.map(renderTabButton)}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  dockedWrap: {
    paddingHorizontal: Spacing.md,
  },
  tabBar: {
    height: TAB_VISUAL_HEIGHT,
    borderRadius: BorderRadius.xxl,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    overflow: 'visible',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 10,
  },
  cutoutMask: {
    position: 'absolute',
    top: -20,
    alignSelf: 'center',
    width: 98,
    height: 42,
    borderBottomLeftRadius: 46,
    borderBottomRightRadius: 46,
    backgroundColor: Colors.background,
  },
  tabsRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.sm + 1,
  },
  tabSlot: {
    flex: 1,
    minWidth: 52,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  cameraSlot: {
    width: 82,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -30,
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
  cameraOuter: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.90)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(58, 158, 143, 0.12)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  cameraOuterPulse: {
    shadowOpacity: 0.32,
  },
  cameraOuterPressed: {
    transform: [{ scale: 0.93 }],
  },
  cameraInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
