import Purchases, {
  type CustomerInfo,
  type PurchasesOfferings,
  LOG_LEVEL,
} from 'react-native-purchases';
import RevenueCatUI, { PAYWALL_RESULT } from 'react-native-purchases-ui';
import { env } from '../config/env';
import type { SubscriptionState } from '../types';

const ENTITLEMENT_ID = 'Glow Pro';
const TRIAL_DAYS = 7;

/** Tracks whether RevenueCat is ready to present a paywall */
let _paywallReady = false;
export function isPaywallReady(): boolean { return _paywallReady; }

export const defaultSubscription = (): SubscriptionState => ({
  tier: 'free',
  is_active: false,
  expires_at: null,
  product_id: null,
  free_scans_used: 0,
  trial_start_date: null,
  trial_end_date: null,
});

const TAG = '[RevenueCat]';
let revenueCatConfigured = false;

export async function initRevenueCat(): Promise<void> {
  if (!env.REVENUECAT_API_KEY) {
    console.log(TAG, 'No API key — skipping init');
    return;
  }
  if (revenueCatConfigured) {
    console.log(TAG, 'Already configured — skipping');
    return;
  }
  try {
    // Check if SDK is already configured (e.g. hot reload, double mount)
    await Purchases.getCustomerInfo();
    // If that didn't throw, SDK is already configured
    revenueCatConfigured = true;
    console.log(TAG, 'SDK was already configured (hot reload or double mount)');
    return;
  } catch {
    // Not configured yet — proceed
  }
  console.log(TAG, 'Configuring SDK...');
  Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
  Purchases.configure({ apiKey: env.REVENUECAT_API_KEY });
  revenueCatConfigured = true;
  console.log(TAG, 'SDK configured successfully');

  // Check offerings to validate paywall readiness
  try {
    const offerings = await Purchases.getOfferings();
    const current = offerings.current;
    console.log(TAG, 'Offerings loaded:', {
      hasCurrent: !!current,
      currentId: current?.identifier ?? 'NONE',
      packageCount: current?.availablePackages?.length ?? 0,
      allOfferingIds: Object.keys(offerings.all),
    });
    if (current && current.availablePackages.length > 0) {
      _paywallReady = true;
      console.log(TAG, 'Paywall READY — offerings available');
    } else {
      console.warn(TAG, 'Paywall NOT READY — no current offering or no packages. Check RevenueCat dashboard → Offerings.');
    }
  } catch (e: any) {
    console.warn(TAG, 'Failed to fetch offerings:', e?.message || e);
  }
}

export async function identifyUser(userId: string): Promise<void> {
  if (!env.REVENUECAT_API_KEY) return;
  console.log(TAG, 'Identifying user:', userId);
  await Purchases.logIn(userId);
  console.log(TAG, 'User identified');
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
      trial_start_date: current.trial_start_date,
      trial_end_date: current.trial_end_date,
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
  console.log(TAG, 'Checking subscription status...');
  const info = await Purchases.getCustomerInfo();
  const result = subscriptionFromCustomerInfo(info, current);
  console.log(TAG, 'Subscription status:', result.tier, result.is_active ? '(active)' : '(inactive)');
  return result;
}

/**
 * Present the RevenueCat-managed paywall.
 * Only shows if the user does NOT already have the "Glow Pro" entitlement.
 * Returns true if the user purchased or restored.
 */
export async function presentPaywall(): Promise<boolean> {
  if (!env.REVENUECAT_API_KEY) return false;
  console.log(TAG, 'Presenting paywall...');
  const result = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: ENTITLEMENT_ID,
  });
  console.log(TAG, 'Paywall result:', result);
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
  console.log(TAG, 'Restoring purchases...');
  const info = await Purchases.restorePurchases();
  const result = subscriptionFromCustomerInfo(info, current);
  console.log(TAG, 'Restore result:', result.tier, result.is_active ? '(active)' : '(inactive)');
  return result;
}

/** Start a 7-day free trial */
export function startTrial(): Partial<SubscriptionState> {
  const now = new Date();
  const end = new Date(now);
  end.setDate(end.getDate() + TRIAL_DAYS);
  console.log(TAG, 'Starting trial — expires:', end.toISOString());
  return {
    trial_start_date: now.toISOString(),
    trial_end_date: end.toISOString(),
  };
}

/** Is the trial still active? */
export function isTrialActive(sub: SubscriptionState): boolean {
  if (!sub.trial_end_date) return false;
  return new Date(sub.trial_end_date) > new Date();
}

/** Days remaining in trial (0 if expired) */
export function trialDaysRemaining(sub: SubscriptionState): number {
  if (!sub.trial_end_date) return 0;
  const diff = new Date(sub.trial_end_date).getTime() - Date.now();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Pure — can the user start a scan? */
export function canScan(subscription: SubscriptionState): boolean {
  if (subscription.is_active) return true;
  return isTrialActive(subscription);
}

/**
 * Listen for server-side subscription changes (e.g. renewal, expiry, family sharing)
 * and auto-update Zustand state. Returns an unsubscribe function for cleanup.
 * Uses lazy require to avoid circular dependency (hoisted outside callback).
 */
export function setupCustomerInfoListener(): () => void {
  if (!env.REVENUECAT_API_KEY) return () => {};
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { useStore } = require('../store/useStore');
  const listener = (info: CustomerInfo) => {
    const state = useStore.getState();
    const current = state.subscription;
    const updated = subscriptionFromCustomerInfo(info, current);
    // Skip no-op updates to avoid redundant persists
    if (
      updated.tier === current.tier &&
      updated.is_active === current.is_active &&
      updated.expires_at === current.expires_at &&
      updated.product_id === current.product_id
    ) return;
    state.setSubscription(updated);
  };
  Purchases.addCustomerInfoUpdateListener(listener);
  return () => Purchases.removeCustomerInfoUpdateListener(listener);
}
