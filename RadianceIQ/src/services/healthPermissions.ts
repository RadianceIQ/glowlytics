import { Platform } from 'react-native';
import type {
  HealthConnectionState,
  HealthDataType,
  HealthSource,
  PermissionStatus,
} from '../types';

const REQUESTED_TYPES: HealthDataType[] = [
  'sleep',
  'resting_heart_rate',
  'heart_rate_variability',
];

const buildState = (
  source: HealthSource,
  status: PermissionStatus,
  grantedTypes: HealthDataType[],
  availabilityNote?: string,
): HealthConnectionState => ({
  source,
  status,
  requested_types: REQUESTED_TYPES,
  granted_types: grantedTypes,
  sync_skipped: false,
  last_checked_at: new Date().toISOString(),
  availability_note: availabilityNote,
});

const unavailableState = (note: string): HealthConnectionState => ({
  status: 'unavailable',
  requested_types: REQUESTED_TYPES,
  granted_types: [],
  sync_skipped: false,
  last_checked_at: new Date().toISOString(),
  availability_note: note,
});

export const getHealthSourceLabel = (source?: HealthSource) => {
  if (source === 'apple_health') return 'Apple Health';
  if (source === 'health_connect') return 'Health Connect';
  return 'Health data';
};

export const getHealthConnectionState = async (
  _priorStatus?: PermissionStatus
): Promise<HealthConnectionState> => {
  // In Expo Go, native health modules are not available.
  // Return unavailable gracefully.
  if (Platform.OS === 'ios') {
    try {
      const healthkit = await import('@kingstinct/react-native-healthkit');
      const available = await healthkit.isHealthDataAvailableAsync();
      if (!available) {
        return buildState('apple_health', 'unavailable', [], 'Apple Health is unavailable on this device.');
      }
      return buildState('apple_health', 'not_requested', [], 'Apple Health is available. Connect to add context.');
    } catch {
      return unavailableState('Apple Health requires a custom dev build (not available in Expo Go).');
    }
  }

  if (Platform.OS === 'android') {
    try {
      const healthConnect = await import('react-native-health-connect');
      const sdkStatus = await healthConnect.getSdkStatus();
      if (sdkStatus !== healthConnect.SdkAvailabilityStatus.SDK_AVAILABLE) {
        return buildState('health_connect', 'unavailable', [], 'Health Connect is not available.');
      }
      return buildState('health_connect', 'not_requested', [], 'Health Connect is available. Connect to add context.');
    } catch {
      return unavailableState('Health Connect requires a custom dev build (not available in Expo Go).');
    }
  }

  return unavailableState('Health integrations are only available on iOS and Android device builds.');
};

export const connectHealthData = async (
  _priorStatus?: PermissionStatus
): Promise<HealthConnectionState> => {
  if (Platform.OS === 'ios') {
    try {
      const healthkit = await import('@kingstinct/react-native-healthkit');
      const available = await healthkit.isHealthDataAvailableAsync();
      if (!available) {
        return buildState('apple_health', 'unavailable', [], 'Apple Health is unavailable on this device.');
      }

      await healthkit.requestAuthorization({
        toRead: [
          'HKCategoryTypeIdentifierSleepAnalysis',
          'HKQuantityTypeIdentifierRestingHeartRate',
          'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        ],
      });

      return buildState('apple_health', 'granted', ['sleep', 'resting_heart_rate', 'heart_rate_variability'],
        'Connected to Apple Health.');
    } catch {
      return unavailableState('Apple Health requires a custom dev build (not available in Expo Go).');
    }
  }

  if (Platform.OS === 'android') {
    try {
      const healthConnect = await import('react-native-health-connect');
      const initialized = await healthConnect.initialize();
      if (!initialized) {
        return buildState('health_connect', 'unavailable', [], 'Health Connect could not be initialized.');
      }

      await healthConnect.requestPermission(
        REQUESTED_TYPES.map((type) => ({
          accessType: 'read' as const,
          recordType: type === 'sleep' ? 'SleepSession'
            : type === 'resting_heart_rate' ? 'RestingHeartRate'
            : 'HeartRateVariabilityRmssd',
        }))
      );

      return buildState('health_connect', 'granted', REQUESTED_TYPES, 'Connected to Health Connect.');
    } catch {
      return unavailableState('Health Connect requires a custom dev build (not available in Expo Go).');
    }
  }

  return unavailableState('Health integrations are only available on iOS and Android device builds.');
};

export const getHealthDataPreview = async (
  _state: Pick<HealthConnectionState, 'source' | 'granted_types'>
): Promise<Partial<Record<HealthDataType, boolean>>> => {
  // Simplified for Expo Go compatibility - just return empty
  return {};
};
