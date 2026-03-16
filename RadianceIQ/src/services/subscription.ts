import Purchases, {
  type CustomerInfo,
  LOG_LEVEL,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { env } from '../config/env';
import type { SubscriptionState } from '../types';

const ENTITLEMENT_ID = 'Glow Pro';
const FREE_SCAN_LIMIT = 3;

export const defaultSubscription = (): SubscriptionState => ({
  tier: 'free',
  is_active: false,
  expires_at: null,
  product_id: null,
  free_scans_used: 0,
});

export async function initRevenueCat(): Promise<void> {
  if (!env.REVENUECAT_API_KEY) return;
  Purchases.setLogLevel(LOG_LEVEL.ERROR);
  Purchases.configure({ apiKey: env.REVENUECAT_API_KEY });
}

export async function identifyUser(userId: string): Promise<void> {
  if (!env.REVENUECAT_API_KEY) return;
  await Purchases.logIn(userId);
}

export function subscriptionFromCustomerInfo(
  info: CustomerInfo,
  current: SubscriptionState,
): SubscriptionState {
  const entitlement = info.entitlements.active[ENTITLEMENT_ID];
  if (entitlement) {
    return {
      tier: 'premium',
      is_active: true,
      expires_at: entitlement.expirationDate,
      product_id: entitlement.productIdentifier,
      free_scans_used: current.free_scans_used,
    };
  }
  return {
    ...current,
    tier: 'free',
    is_active: false,
    expires_at: null,
    product_id: null,
  };
}

export async function checkSubscriptionStatus(
  current: SubscriptionState,
): Promise<SubscriptionState> {
  if (!env.REVENUECAT_API_KEY) return current;
  const info = await Purchases.getCustomerInfo();
  return subscriptionFromCustomerInfo(info, current);
}

/**
 * Present the RevenueCat-managed paywall.
 * Only shows if the user does NOT already have the "Glow Pro" entitlement.
 * Returns true if the user purchased or restored.
 */
export async function presentPaywall(): Promise<boolean> {
  if (!env.REVENUECAT_API_KEY) return false;
  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ENTITLEMENT_ID,
  });
  return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
}

/**
 * Present the RevenueCat Customer Center for managing subscriptions.
 */
export async function presentCustomerCenter(): Promise<void> {
  if (!env.REVENUECAT_API_KEY) return;
  await RevenueCatUI.presentCustomerCenter();
}

export async function restorePurchases(
  current: SubscriptionState,
): Promise<SubscriptionState> {
  if (!env.REVENUECAT_API_KEY) return current;
  const info = await Purchases.restorePurchases();
  return subscriptionFromCustomerInfo(info, current);
}

/** Pure — can the user start a scan? */
export function canScan(subscription: SubscriptionState): boolean {
  if (subscription.is_active) return true;
  return subscription.free_scans_used < FREE_SCAN_LIMIT;
}

/** Pure — how many free scans remain? */
export function remainingFreeScans(subscription: SubscriptionState): number {
  if (subscription.is_active) return Infinity;
  return Math.max(0, FREE_SCAN_LIMIT - subscription.free_scans_used);
}
