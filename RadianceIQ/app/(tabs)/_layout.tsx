import React from 'react';
import { Tabs, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useStore } from '../../src/store/useStore';
import { CoachingTooltip } from '../../src/components/CoachingTooltip';
import { NotchedTabBar } from '../../src/components/navigation/NotchedTabBar';
import { presentPaywall, checkSubscriptionStatus } from '../../src/services/subscription';
import { trackEvent } from '../../src/services/analytics';

export default function TabsLayout() {
  const router = useRouter();
  const dailyRecords = useStore((s) => s.dailyRecords);
  const isFirstScan = dailyRecords.length === 0;

  const handleCameraPress = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
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
  };

  return (
    <>
      <CoachingTooltip visible={isFirstScan} />
      <Tabs
        tabBar={(props) => (
          <NotchedTabBar {...props} onCameraPress={handleCameraPress} pulseCamera={isFirstScan} />
        )}
        screenOptions={{
          headerShown: false,
          tabBarShowLabel: false,
          tabBarHideOnKeyboard: true,
        }}
      >
        <Tabs.Screen
          name="index"
          options={{ href: null }}
        />
        <Tabs.Screen
          name="today"
          options={{ title: 'Today' }}
        />
        <Tabs.Screen
          name="products"
          options={{ title: 'Products' }}
        />
        <Tabs.Screen
          name="camera"
          options={{ title: 'Camera' }}
        />
        <Tabs.Screen
          name="reports"
          options={{ title: 'Reports' }}
        />
        <Tabs.Screen
          name="profile"
          options={{ title: 'Profile' }}
        />
      </Tabs>
    </>
  );
}
