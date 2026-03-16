import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';
import { Colors } from '../src/constants/theme';
import { useStore } from '../src/store/useStore';
import { checkSubscriptionStatus } from '../src/services/subscription';
import { trackEvent } from '../src/services/analytics';

export default function PaywallScreen() {
  const router = useRouter();
  const subscription = useStore((s) => s.subscription);
  const setSubscription = useStore((s) => s.setSubscription);

  const refreshSubscription = async () => {
    try {
      const sub = await checkSubscriptionStatus(subscription);
      setSubscription(sub);
    } catch {
      // Non-fatal
    }
  };

  return (
    <View style={styles.container}>
      <RevenueCatUI.Paywall
        onPurchaseCompleted={async () => {
          trackEvent('paywall_purchase_completed');
          await refreshSubscription();
          router.back();
        }}
        onRestoreCompleted={async () => {
          trackEvent('paywall_restore_completed');
          await refreshSubscription();
          router.back();
        }}
        onDismiss={() => {
          trackEvent('paywall_dismissed');
          router.back();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
