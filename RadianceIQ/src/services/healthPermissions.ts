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

// Mocked — native HealthKit/Health Connect packages removed for Expo Go compatibility.
// Wire up real implementations when building with EAS / bare workflow.

export const getHealthConnectionState = async (
  _priorStatus?: PermissionStatus
): Promise<HealthConnectionState> => {
  const source: HealthSource | undefined =
    Platform.OS === 'ios' ? 'apple_health' :
    Platform.OS === 'android' ? 'health_connect' : undefined;

  const label = source === 'apple_health' ? 'Apple Health' :
    source === 'health_connect' ? 'Health Connect' : 'Health data';

  return {
    source,
    status: 'unavailable',
    requested_types: REQUESTED_TYPES,
    granted_types: [],
    sync_skipped: false,
    last_checked_at: new Date().toISOString(),
    availability_note: `${label} requires a native build (not available in Expo Go).`,
  };
};

export const connectHealthData = async (
  _priorStatus?: PermissionStatus
): Promise<HealthConnectionState> => {
  return getHealthConnectionState(_priorStatus);
};

export const getHealthDataPreview = async (
  _state: Pick<HealthConnectionState, 'source' | 'granted_types'>
): Promise<Partial<Record<HealthDataType, boolean>>> => {
  return {};
};
