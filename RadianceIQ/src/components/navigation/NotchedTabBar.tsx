import React, { useEffect, useMemo, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Dimensions, Pressable, StyleSheet, Text, View, Keyboard, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { BorderRadius, Colors, FontFamily, Spacing } from '../../constants/theme';

const TAB_VISUAL_HEIGHT = 74;
const CAMERA_SIZE = 68;
const NOTCH_WIDTH = 74;
const NOTCH_DEPTH = 10;
const NOTCH_CURVE = 12;
const BAR_RADIUS = 22;
const CAMERA_LIFT = 22; // how far camera center sits above bar top edge

type TabConfig = {
  name: string;
  label: string;
  icon: React.ComponentProps<typeof Feather>['name'];
};

const SIDE_TABS: TabConfig[] = [
  { name: 'today', label: 'Today', icon: 'sun' },
  { name: 'products', label: 'Products', icon: 'shopping-bag' },
  { name: 'reports', label: 'Reports', icon: 'file-text' },
  { name: 'profile', label: 'Profile', icon: 'user' },
];

export const DOCKED_TAB_SPACE = TAB_VISUAL_HEIGHT + 10;

/**
 * SVG path: rounded rect with a shallow smooth notch at top center.
 * Bottom edge is continuous (bridge).
 */
function buildNotchPath(barWidth: number, barHeight: number): string {
  const cx = barWidth / 2;
  const halfNotch = NOTCH_WIDTH / 2;
  const r = BAR_RADIUS;
  const c = NOTCH_CURVE;
  const d = NOTCH_DEPTH;

  const notchLeft = cx - halfNotch - c;
  const notchRight = cx + halfNotch + c;

  return [
    `M ${r} 0`,
    `L ${notchLeft} 0`,
    `C ${notchLeft + c} 0, ${cx - halfNotch} ${d}, ${cx - halfNotch + 2} ${d}`,
    `A ${halfNotch - 2} ${halfNotch - 2} 0 0 0 ${cx + halfNotch - 2} ${d}`,
    `C ${cx + halfNotch} ${d}, ${notchRight - c} 0, ${notchRight} 0`,
    `L ${barWidth - r} 0`,
    `Q ${barWidth} 0, ${barWidth} ${r}`,
    `L ${barWidth} ${barHeight - r}`,
    `Q ${barWidth} ${barHeight}, ${barWidth - r} ${barHeight}`,
    `L ${r} ${barHeight}`,
    `Q 0 ${barHeight}, 0 ${barHeight - r}`,
    `L 0 ${r}`,
    `Q 0 0, ${r} 0`,
    'Z',
  ].join(' ');
}

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
  const screenWidth = Dimensions.get('window').width;

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

  const barHPadding = Spacing.md;
  const barWidth = screenWidth - barHPadding * 2;
  const svgHeight = TAB_VISUAL_HEIGHT + NOTCH_DEPTH;

  const notchPath = useMemo(() => buildNotchPath(barWidth, TAB_VISUAL_HEIGHT), [barWidth]);

  if (hideOnKeyboard && isKeyboardOpen) return null;

  const renderSideTab = (tab: TabConfig) => {
    const index = indexByName.get(tab.name);
    if (typeof index !== 'number') {
      return <View key={tab.name} style={styles.tabSlot} />;
    }

    const route = state.routes[index];
    const isFocused = state.index === index;
    const options = descriptors[route.key]?.options;

    const onPress = () => {
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
      navigation.emit({ type: 'tabLongPress', target: route.key });
    };

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

  // Camera route info
  const cameraIndex = indexByName.get('camera');
  const cameraRoute = typeof cameraIndex === 'number' ? state.routes[cameraIndex] : undefined;
  const cameraOptions = cameraRoute ? descriptors[cameraRoute.key]?.options : undefined;
  const isCameraFocused = typeof cameraIndex === 'number' && state.index === cameraIndex;

  return (
    <View pointerEvents="box-none" style={styles.root}>
      <View style={[styles.dockedWrap, { paddingBottom: Math.max(insets.bottom - 2, 8) }]}>
        <View style={styles.tabBarContainer}>
          {/* SVG background — notched pill */}
          <View style={styles.svgShadow}>
            <Svg
              width={barWidth}
              height={svgHeight}
              viewBox={`0 0 ${barWidth} ${TAB_VISUAL_HEIGHT}`}
              style={styles.svgBackground}
            >
              <Path
                d={notchPath}
                fill="rgba(255, 255, 255, 0.93)"
                stroke="rgba(0, 0, 0, 0.04)"
                strokeWidth={0.5}
              />
            </Svg>
          </View>

          {/* Side tab buttons — 2 left, spacer, 2 right */}
          <View style={styles.tabsRow}>
            {SIDE_TABS.slice(0, 2).map(renderSideTab)}
            <View style={styles.cameraSpacer} />
            {SIDE_TABS.slice(2).map(renderSideTab)}
          </View>

          {/* Camera button — absolutely positioned, floating above bar */}
          <View style={styles.cameraAnchor}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={cameraOptions?.tabBarAccessibilityLabel ?? 'Open camera'}
              accessibilityState={{ selected: isCameraFocused }}
              onPress={onCameraPress}
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
  tabBarContainer: {
    height: TAB_VISUAL_HEIGHT,
    overflow: 'visible',
  },

  // Shadow wrapper
  svgShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 10,
  },
  svgBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
  },

  // Tab icons row (4 side tabs + center spacer)
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
  cameraSpacer: {
    width: 82,
  },

  // Camera — absolutely positioned above center of bar
  cameraAnchor: {
    position: 'absolute',
    top: -(CAMERA_SIZE / 2) + (NOTCH_DEPTH / 2) - 4,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 10,
  },
  cameraOuter: {
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2.5,
    borderColor: 'rgba(58, 158, 143, 0.10)',
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 8,
  },
  cameraOuterPulse: {
    shadowOpacity: 0.42,
    shadowRadius: 20,
  },
  cameraOuterPressed: {
    transform: [{ scale: 0.93 }],
  },
  cameraInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Tab button internals
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
});
