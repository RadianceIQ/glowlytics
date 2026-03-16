// Mock react-native-purchases
jest.mock('react-native-purchases', () => ({
  setLogLevel: jest.fn(),
  configure: jest.fn(),
  logIn: jest.fn(),
  getCustomerInfo: jest.fn(),
  getOfferings: jest.fn(),
  purchasePackage: jest.fn(),
  restorePurchases: jest.fn(),
  LOG_LEVEL: { ERROR: 0 },
}));

// Mock react-native-purchases-ui
jest.mock('react-native-purchases-ui', () => ({
  presentPaywallIfNeeded: jest.fn(),
  presentCustomerCenter: jest.fn(),
  PAYWALL_RESULT: {
    NOT_PRESENTED: 'NOT_PRESENTED',
    ERROR: 'ERROR',
    CANCELLED: 'CANCELLED',
    PURCHASED: 'PURCHASED',
    RESTORED: 'RESTORED',
  },
}));

import {
  canScan,
  remainingFreeScans,
  defaultSubscription,
  subscriptionFromCustomerInfo,
  restorePurchases,
} from '../subscription';
import type { SubscriptionState } from '../../types';

describe('subscription', () => {
  describe('canScan', () => {
    it('returns true for premium subscribers', () => {
      const sub: SubscriptionState = {
        tier: 'premium',
        is_active: true,
        expires_at: '2026-04-14T00:00:00Z',
        product_id: 'glowlytics_premium_monthly',
        free_scans_used: 10,
      };
      expect(canScan(sub)).toBe(true);
    });

    it('returns true for free users under the limit', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 0,
      };
      expect(canScan(sub)).toBe(true);
    });

    it('returns true for free users with 2 scans used', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 2,
      };
      expect(canScan(sub)).toBe(true);
    });

    it('returns false for free users who have used all 3 free scans', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 3,
      };
      expect(canScan(sub)).toBe(false);
    });

    it('returns false for free users who have exceeded the limit', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 5,
      };
      expect(canScan(sub)).toBe(false);
    });
  });

  describe('remainingFreeScans', () => {
    it('returns Infinity for premium subscribers', () => {
      const sub: SubscriptionState = {
        tier: 'premium',
        is_active: true,
        expires_at: '2026-04-14T00:00:00Z',
        product_id: 'glowlytics_premium_monthly',
        free_scans_used: 0,
      };
      expect(remainingFreeScans(sub)).toBe(Infinity);
    });

    it('returns 3 for new free users', () => {
      expect(remainingFreeScans(defaultSubscription())).toBe(3);
    });

    it('returns 1 when 2 scans used', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 2,
      };
      expect(remainingFreeScans(sub)).toBe(1);
    });

    it('returns 0 when all scans used', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 3,
      };
      expect(remainingFreeScans(sub)).toBe(0);
    });

    it('never returns negative', () => {
      const sub: SubscriptionState = {
        ...defaultSubscription(),
        free_scans_used: 10,
      };
      expect(remainingFreeScans(sub)).toBe(0);
    });
  });

  describe('subscriptionFromCustomerInfo', () => {
    const current = defaultSubscription();

    it('returns premium state when entitlement is active', () => {
      const mockInfo = {
        entitlements: {
          active: {
            'Glow Pro': {
              expirationDate: '2026-04-14T00:00:00Z',
              productIdentifier: 'glowlytics_premium_monthly',
            },
          },
        },
      } as any;

      const result = subscriptionFromCustomerInfo(mockInfo, current);
      expect(result.tier).toBe('premium');
      expect(result.is_active).toBe(true);
      expect(result.expires_at).toBe('2026-04-14T00:00:00Z');
      expect(result.product_id).toBe('glowlytics_premium_monthly');
    });

    it('returns free state when no active entitlement', () => {
      const mockInfo = {
        entitlements: {
          active: {},
        },
      } as any;

      const result = subscriptionFromCustomerInfo(mockInfo, current);
      expect(result.tier).toBe('free');
      expect(result.is_active).toBe(false);
      expect(result.expires_at).toBeNull();
    });

    it('preserves free_scans_used from current state', () => {
      const currentWithScans = { ...current, free_scans_used: 2 };
      const mockInfo = {
        entitlements: {
          active: {
            'Glow Pro': {
              expirationDate: '2026-04-14T00:00:00Z',
              productIdentifier: 'glowlytics_premium_monthly',
            },
          },
        },
      } as any;

      const result = subscriptionFromCustomerInfo(mockInfo, currentWithScans);
      expect(result.free_scans_used).toBe(2);
    });
  });

  describe('restorePurchases', () => {
    it('returns current state when REVENUECAT_API_KEY is empty', async () => {
      const current = defaultSubscription();
      const result = await restorePurchases(current);
      expect(result).toBe(current);
    });
  });

  describe('defaultSubscription', () => {
    it('returns the correct default state', () => {
      const sub = defaultSubscription();
      expect(sub.tier).toBe('free');
      expect(sub.is_active).toBe(false);
      expect(sub.expires_at).toBeNull();
      expect(sub.product_id).toBeNull();
      expect(sub.free_scans_used).toBe(0);
    });
  });
});
