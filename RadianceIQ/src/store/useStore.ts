import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type {
  UserProfile, ScanProtocol, ProductEntry, DailyRecord,
  ModelOutput, PrimaryGoal, ScanRegion, HealthConnectionState,
} from '../types';

interface AppState {
  // User
  user: UserProfile | null;
  protocol: ScanProtocol | null;
  products: ProductEntry[];
  dailyRecords: DailyRecord[];
  modelOutputs: ModelOutput[];

  // Onboarding state
  onboardingStep: number;

  // Scanner connection (simulated)
  scannerConnected: boolean;
  scannerName: string;

  // Actions
  setOnboardingStep: (step: number) => void;
  createUser: (data: Partial<UserProfile>) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  updateHealthConnection: (data: Partial<HealthConnectionState>) => void;
  setProtocol: (goal: PrimaryGoal, region: ScanRegion) => void;
  addProduct: (product: Omit<ProductEntry, 'user_product_id' | 'user_id'>) => void;
  removeProduct: (id: string) => void;
  addDailyRecord: (record: Omit<DailyRecord, 'daily_id' | 'user_id'>) => DailyRecord;
  addModelOutput: (output: Omit<ModelOutput, 'output_id'>) => void;
  connectScanner: (name: string) => void;
  disconnectScanner: () => void;
  getStreak: () => number;
  getLatestOutput: () => ModelOutput | null;
  getOutputHistory: (days: number) => ModelOutput[];
  loadPersistedData: () => Promise<void>;
  persistData: () => Promise<void>;
  resetAll: () => void;
}

const generateId = () => {
  try {
    return uuidv4();
  } catch {
    return `id_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
};

const defaultHealthConnection = (): HealthConnectionState => ({
  status: 'not_requested',
  requested_types: [],
  granted_types: [],
  sync_skipped: false,
});

const normalizeUser = (user?: Partial<UserProfile> | null): UserProfile | null => {
  if (!user) return null;

  return {
    user_id: user.user_id || generateId(),
    age_range: user.age_range || '',
    location_coarse: user.location_coarse || '',
    period_applicable: user.period_applicable || 'prefer_not',
    period_last_start_date: user.period_last_start_date,
    cycle_length_days: user.cycle_length_days || 28,
    smoker_status: user.smoker_status,
    drink_baseline_frequency: user.drink_baseline_frequency,
    wearable_connected: user.wearable_connected || false,
    wearable_source: user.wearable_source,
    camera_permission_status: user.camera_permission_status || 'not_requested',
    health_connection: {
      ...defaultHealthConnection(),
      ...user.health_connection,
      requested_types: user.health_connection?.requested_types || [],
      granted_types: user.health_connection?.granted_types || [],
      sync_skipped: user.health_connection?.sync_skipped || false,
    },
    onboarding_complete: user.onboarding_complete || false,
  };
};

export const useStore = create<AppState>((set, get) => ({
  user: null,
  protocol: null,
  products: [],
  dailyRecords: [],
  modelOutputs: [],
  onboardingStep: 0,
  scannerConnected: false,
  scannerName: '',

  setOnboardingStep: (step) => set({ onboardingStep: step }),

  createUser: (data) => {
    const user = normalizeUser({
      user_id: generateId(),
      age_range: data.age_range || '',
      location_coarse: data.location_coarse || '',
      period_applicable: data.period_applicable || 'prefer_not',
      period_last_start_date: data.period_last_start_date,
      cycle_length_days: data.cycle_length_days || 28,
      smoker_status: data.smoker_status,
      drink_baseline_frequency: data.drink_baseline_frequency,
      wearable_connected: data.wearable_connected || false,
      wearable_source: data.wearable_source,
      camera_permission_status: data.camera_permission_status || 'not_requested',
      health_connection: data.health_connection || defaultHealthConnection(),
      onboarding_complete: false,
    });
    set({ user });
    get().persistData();
  },

  updateUser: (data) => {
    const current = get().user;
    if (!current) return;
    const updated = normalizeUser({
      ...current,
      ...data,
      health_connection: {
        ...current.health_connection,
        ...data.health_connection,
      },
    });
    set({ user: updated });
    get().persistData();
  },

  updateHealthConnection: (data) => {
    const current = get().user;
    if (!current) return;

    const health_connection = {
      ...current.health_connection,
      ...data,
      requested_types: data.requested_types || current.health_connection.requested_types,
      granted_types: data.granted_types || current.health_connection.granted_types,
    };

    const updated = normalizeUser({
      ...current,
      wearable_connected: health_connection.status === 'granted',
      wearable_source:
        health_connection.status === 'granted'
          ? health_connection.source === 'apple_health'
            ? 'Apple Health'
            : 'Health Connect'
          : current.wearable_source,
      health_connection,
    });

    set({ user: updated });
    get().persistData();
  },

  setProtocol: (goal, region) => {
    const user = get().user;
    if (!user) return;
    const protocol: ScanProtocol = {
      protocol_id: generateId(),
      user_id: user.user_id,
      primary_goal: goal,
      scan_region: region,
      scan_frequency: 'daily',
      baseline_date: new Date().toISOString().split('T')[0],
    };
    set({ protocol });
    get().persistData();
  },

  addProduct: (product) => {
    const user = get().user;
    if (!user) return;
    const entry: ProductEntry = {
      ...product,
      user_product_id: generateId(),
      user_id: user.user_id,
    };
    set((s) => ({ products: [...s.products, entry] }));
    get().persistData();
  },

  removeProduct: (id) => {
    set((s) => ({ products: s.products.filter((p) => p.user_product_id !== id) }));
    get().persistData();
  },

  addDailyRecord: (record) => {
    const user = get().user;
    if (!user) return record as DailyRecord;
    const entry: DailyRecord = {
      ...record,
      daily_id: generateId(),
      user_id: user.user_id,
    };
    set((s) => ({ dailyRecords: [...s.dailyRecords, entry] }));
    get().persistData();
    return entry;
  },

  addModelOutput: (output) => {
    const entry: ModelOutput = {
      ...output,
      output_id: generateId(),
    };
    set((s) => ({ modelOutputs: [...s.modelOutputs, entry] }));
    get().persistData();
  },

  connectScanner: (name) => set({ scannerConnected: true, scannerName: name }),
  disconnectScanner: () => set({ scannerConnected: false, scannerName: '' }),

  getStreak: () => {
    const records = get().dailyRecords.sort((a, b) => b.date.localeCompare(a.date));
    if (records.length === 0) return 0;
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < records.length; i++) {
      const expected = new Date(today);
      expected.setDate(expected.getDate() - i);
      const expectedStr = expected.toISOString().split('T')[0];
      if (records.find((r) => r.date === expectedStr)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  },

  getLatestOutput: () => {
    const outputs = get().modelOutputs;
    if (outputs.length === 0) return null;
    return outputs[outputs.length - 1];
  },

  getOutputHistory: (days) => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split('T')[0];
    const records = get().dailyRecords.filter((r) => r.date >= cutoffStr);
    const dailyIds = new Set(records.map((r) => r.daily_id));
    return get().modelOutputs.filter((o) => dailyIds.has(o.daily_id));
  },

  loadPersistedData: async () => {
    try {
      const data = await AsyncStorage.getItem('radianceiq_data');
      if (data) {
        const parsed = JSON.parse(data);
        set({
          user: normalizeUser(parsed.user),
          protocol: parsed.protocol || null,
          products: parsed.products || [],
          dailyRecords: parsed.dailyRecords || [],
          modelOutputs: parsed.modelOutputs || [],
        });
      }
    } catch (e) {
      console.log('Failed to load persisted data', e);
    }
  },

  persistData: async () => {
    try {
      const { user, protocol, products, dailyRecords, modelOutputs } = get();
      await AsyncStorage.setItem('radianceiq_data', JSON.stringify({
        user, protocol, products, dailyRecords, modelOutputs,
      }));
    } catch (e) {
      console.log('Failed to persist data', e);
    }
  },

  resetAll: () => {
    set({
      user: null,
      protocol: null,
      products: [],
      dailyRecords: [],
      modelOutputs: [],
      onboardingStep: 0,
      scannerConnected: false,
      scannerName: '',
    });
    AsyncStorage.removeItem('radianceiq_data');
  },
}));
