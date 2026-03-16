import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { v4 as uuidv4 } from 'uuid';
import type {
  UserProfile, ScanProtocol, ProductEntry, DailyRecord,
  ModelOutput, PrimaryGoal, ScanRegion, HealthConnectionState,
  GamificationState, Badge, WeeklyChallenge, LevelName,
  OnboardingScreenName, SubscriptionState,
} from '../types';
import { defaultSubscription, canScan as canScanPure } from '../services/subscription';
import {
  getLevelForXP,
  getXPForScan,
  checkBadgeEligibility,
  BADGE_DEFINITIONS,
  updatePersonalBests as computePersonalBests,
  generateWeeklyChallenges as generateChallenges,
} from '../services/gamification';

interface AppState {
  // User
  user: UserProfile | null;
  protocol: ScanProtocol | null;
  products: ProductEntry[];
  dailyRecords: DailyRecord[];
  modelOutputs: ModelOutput[];

  // Onboarding state
  onboardingStep: number;
  onboardingFlow: OnboardingScreenName[];
  onboardingFlowIndex: number;

  // Pending scan result (processing→checkin handoff)
  pendingScanResult: Partial<ModelOutput> | null;
  pendingPhotoBase64: string | null;

  // Gamification
  gamification: GamificationState;

  // Subscription
  subscription: SubscriptionState;

  // Actions
  setOnboardingStep: (step: number) => void;
  setOnboardingFlow: (flow: OnboardingScreenName[]) => void;
  setOnboardingFlowIndex: (index: number) => void;
  createUser: (data: Partial<UserProfile>) => void;
  updateUser: (data: Partial<UserProfile>) => void;
  updateHealthConnection: (data: Partial<HealthConnectionState>) => void;
  setProtocol: (goal: PrimaryGoal, region: ScanRegion) => void;
  addProduct: (product: Omit<ProductEntry, 'user_product_id' | 'user_id'>) => void;
  removeProduct: (id: string) => void;
  addDailyRecord: (record: Omit<DailyRecord, 'daily_id' | 'user_id'>) => DailyRecord;
  addModelOutput: (output: Omit<ModelOutput, 'output_id'>) => void;
  setPendingScanResult: (result: Partial<ModelOutput> | null) => void;
  clearPendingScanResult: () => void;
  setPendingPhotoBase64: (base64: string | null) => void;
  clearPendingPhotoBase64: () => void;
  getStreak: () => number;
  getLatestOutput: () => ModelOutput | null;
  getOutputHistory: (days: number) => ModelOutput[];
  loadPersistedData: () => Promise<void>;
  persistData: () => Promise<void>;
  resetAll: () => void;
  awardXP: (amount: number) => void;
  checkAndAwardBadges: () => void;
  updatePersonalBests: () => void;
  generateWeeklyChallenges: () => void;
  setSubscription: (sub: SubscriptionState) => void;
  incrementFreeScansUsed: () => void;
  canPerformScan: () => boolean;
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

const defaultGamification = (): GamificationState => ({
  xp: 0,
  level: 'Beginner',
  badges: [],
  weekly_challenges: [],
  personal_bests: {
    longest_streak: 0,
    lowest_acne: 100,
    highest_skin_score: 0,
    most_consistent_week: 0,
  },
});

// Re-export getLevelForXP from gamification service as local alias
const levelForXP = getLevelForXP;

const normalizeUser = (user?: Partial<UserProfile> | null): UserProfile | null => {
  if (!user) return null;

  return {
    user_id: user.user_id || generateId(),
    age_range: user.age_range || '',
    sex: user.sex,
    location_coarse: user.location_coarse || '',
    period_applicable: user.period_applicable || 'prefer_not',
    period_last_start_date: user.period_last_start_date,
    cycle_length_days: user.cycle_length_days || 28,
    menstrual_status: user.menstrual_status,
    on_hormonal_birth_control: user.on_hormonal_birth_control,
    birth_control_type: user.birth_control_type,
    supplements: user.supplements,
    exercise_frequency: user.exercise_frequency,
    shower_frequency: user.shower_frequency,
    hand_washing_frequency: user.hand_washing_frequency,
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
  onboardingFlow: ['welcome', 'age-range', 'sex', 'location', 'skin-goal', 'supplements', 'exercise', 'shower-frequency', 'hand-washing', 'camera-permission', 'ready'],
  onboardingFlowIndex: 0,
  pendingScanResult: null,
  pendingPhotoBase64: null,
  gamification: defaultGamification(),
  subscription: defaultSubscription(),

  setOnboardingStep: (step) => set({ onboardingStep: step }),
  setOnboardingFlow: (flow) => set({ onboardingFlow: flow }),
  setOnboardingFlowIndex: (index) => set({ onboardingFlowIndex: index }),

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
    if (!user) throw new Error('addDailyRecord called without a signed-in user');
    const entry: DailyRecord = {
      ...record,
      daily_id: generateId(),
      user_id: user.user_id,
    };
    set((s) => ({ dailyRecords: [...s.dailyRecords, entry] }));
    if (!get().subscription.is_active) {
      get().incrementFreeScansUsed();
    }
    get().persistData();

    // Calculate context items logged for XP bonus
    let contextItems = 0;
    if (record.sleep_quality) contextItems++;
    if (record.stress_level) contextItems++;
    if (record.drinks_yesterday) contextItems++;

    const streak = get().getStreak();
    const xp = getXPForScan(streak, contextItems);
    get().awardXP(xp);
    get().checkAndAwardBadges();
    return entry;
  },

  addModelOutput: (output) => {
    const entry: ModelOutput = {
      ...output,
      output_id: generateId(),
    };
    set((s) => ({ modelOutputs: [...s.modelOutputs, entry] }));
    get().persistData();
    get().updatePersonalBests();
  },

  setPendingScanResult: (result) => set({ pendingScanResult: result }),
  clearPendingScanResult: () => set({ pendingScanResult: null }),
  setPendingPhotoBase64: (base64) => set({ pendingPhotoBase64: base64 }),
  clearPendingPhotoBase64: () => set({ pendingPhotoBase64: null }),

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

  awardXP: (amount) => {
    set((s) => {
      const newXP = s.gamification.xp + amount;
      return {
        gamification: {
          ...s.gamification,
          xp: newXP,
          level: levelForXP(newXP),
        },
      };
    });
    get().persistData();
  },

  checkAndAwardBadges: () => {
    const { gamification, dailyRecords, modelOutputs, products } = get();
    const streak = get().getStreak();

    const newBadgeIds = checkBadgeEligibility(
      gamification,
      dailyRecords,
      modelOutputs,
      products,
      streak,
    );

    if (newBadgeIds.length === 0) return;

    const newBadges: Badge[] = newBadgeIds.map((id) => {
      const def = BADGE_DEFINITIONS[id];
      return {
        id,
        name: def.name,
        description: def.description,
        earned_at: new Date().toISOString(),
        xp_reward: def.xp_reward,
      };
    });

    const bonusXP = newBadges.reduce((sum, b) => sum + b.xp_reward, 0);
    set((s) => {
      const newXP = s.gamification.xp + bonusXP;
      return {
        gamification: {
          ...s.gamification,
          badges: [...s.gamification.badges, ...newBadges],
          xp: newXP,
          level: levelForXP(newXP),
        },
      };
    });
    get().persistData();
  },

  updatePersonalBests: () => {
    const { modelOutputs, dailyRecords, gamification } = get();
    if (modelOutputs.length === 0) return;

    const streak = get().getStreak();
    const updatedBests = computePersonalBests(
      gamification.personal_bests,
      dailyRecords,
      modelOutputs,
      streak,
    );

    set((s) => ({
      gamification: {
        ...s.gamification,
        personal_bests: updatedBests,
      },
    }));
    get().persistData();
  },

  generateWeeklyChallenges: () => {
    const { gamification } = get();
    const challenges = generateChallenges(gamification.weekly_challenges);
    set((s) => ({
      gamification: {
        ...s.gamification,
        weekly_challenges: challenges,
      },
    }));
    get().persistData();
  },

  setSubscription: (sub) => {
    set({ subscription: sub });
    get().persistData();
  },

  incrementFreeScansUsed: () => {
    set((s) => ({
      subscription: {
        ...s.subscription,
        free_scans_used: s.subscription.free_scans_used + 1,
      },
    }));
  },

  canPerformScan: () => canScanPure(get().subscription),

  loadPersistedData: async () => {
    try {
      const data = await AsyncStorage.getItem('glowlytics_data');
      const parsed = data ? JSON.parse(data) : null;
      const hasPersistedSession = Boolean(
        parsed?.user ||
        parsed?.protocol ||
        (parsed?.dailyRecords && parsed.dailyRecords.length > 0) ||
        (parsed?.modelOutputs && parsed.modelOutputs.length > 0)
      );

      if (hasPersistedSession) {
        set({
          user: normalizeUser(parsed.user),
          protocol: parsed.protocol || null,
          products: parsed.products || [],
          dailyRecords: parsed.dailyRecords || [],
          modelOutputs: parsed.modelOutputs || [],
          gamification: parsed.gamification || defaultGamification(),
          subscription: parsed.subscription || defaultSubscription(),
        });
        return;
      }

      // No persisted data — start clean
    } catch (e) {
      console.log('Failed to load persisted data', e);
    }
  },

  persistData: async () => {
    try {
      const { user, protocol, products, dailyRecords, modelOutputs, gamification, subscription } = get();
      await AsyncStorage.setItem('glowlytics_data', JSON.stringify({
        user, protocol, products, dailyRecords, modelOutputs, gamification, subscription,
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
      pendingScanResult: null,
      pendingPhotoBase64: null,
      gamification: defaultGamification(),
      subscription: defaultSubscription(),
    });
    AsyncStorage.removeItem('glowlytics_data');
  },
}));
