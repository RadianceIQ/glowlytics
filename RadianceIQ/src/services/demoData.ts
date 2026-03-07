import type { DailyRecord, ModelOutput, ProductEntry, UserProfile, ScanProtocol } from '../types';

// Seed realistic demo data for 14 days of scan history
const generateId = () => `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const daysAgo = (n: number): string => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split('T')[0];
};

export const createDemoUser = (): UserProfile => ({
  user_id: 'demo_user_001',
  age_range: '25-34',
  location_coarse: '10001',
  period_applicable: 'yes',
  period_last_start_date: daysAgo(12),
  cycle_length_days: 28,
  smoker_status: false,
  drink_baseline_frequency: '1-2',
  wearable_connected: false,
  camera_permission_status: 'granted',
  health_connection: {
    status: 'not_requested',
    requested_types: [],
    granted_types: [],
    sync_skipped: true,
    availability_note: 'Demo mode uses simulated health context only.',
  },
  onboarding_complete: true,
});

export const createDemoProtocol = (): ScanProtocol => ({
  protocol_id: 'demo_protocol_001',
  user_id: 'demo_user_001',
  primary_goal: 'acne',
  scan_region: 'left_cheek',
  scan_frequency: 'daily',
  baseline_date: daysAgo(14),
});

export const createDemoProducts = (): ProductEntry[] => [
  {
    user_product_id: 'demo_prod_001',
    user_id: 'demo_user_001',
    product_name: 'CeraVe Foaming Facial Cleanser',
    product_capture_method: 'search',
    ingredients_list: ['Ceramides', 'Niacinamide', 'Hyaluronic Acid'],
    usage_schedule: 'both',
    start_date: daysAgo(14),
  },
  {
    user_product_id: 'demo_prod_002',
    user_id: 'demo_user_001',
    product_name: 'La Roche-Posay Anthelios SPF 50',
    product_capture_method: 'barcode',
    ingredients_list: ['Avobenzone', 'Homosalate', 'Octisalate', 'Niacinamide'],
    usage_schedule: 'AM',
    start_date: daysAgo(14),
  },
  {
    user_product_id: 'demo_prod_003',
    user_id: 'demo_user_001',
    product_name: 'The Ordinary Niacinamide 10%',
    product_capture_method: 'photo',
    ingredients_list: ['Niacinamide', 'Zinc PCA'],
    usage_schedule: 'PM',
    start_date: daysAgo(7),
  },
];

export const createDemoHistory = (): { records: DailyRecord[]; outputs: ModelOutput[] } => {
  const records: DailyRecord[] = [];
  const outputs: ModelOutput[] = [];

  // Simulate 14 days of gradually improving acne with some cycle-related bumps
  const baseAcne = 58;
  const baseSunDamage = 35;
  const baseSkinAge = 42;

  for (let i = 14; i >= 0; i--) {
    const dailyId = `demo_daily_${i}`;
    const cycleDay = 28 - i + 16; // Simulate being around day 16-30 of cycle
    const isCycleWindow = cycleDay >= 21 || cycleDay <= 5;

    const acneVariation = isCycleWindow ? Math.random() * 8 + 2 : -(Math.random() * 3);
    const sunVariation = Math.random() * 4 - 2;
    const ageVariation = -(Math.random() * 1.5);

    const usedSunscreen = Math.random() > 0.25;
    const sleptWell = Math.random() > 0.3;

    records.push({
      daily_id: dailyId,
      user_id: 'demo_user_001',
      date: daysAgo(i),
      scanner_reading_id: `demo_scan_${i}`,
      scanner_indices: {
        inflammation_index: Math.max(10, Math.min(80, 45 + (Math.random() * 20 - 10))),
        pigmentation_index: Math.max(10, Math.min(80, 30 + (Math.random() * 15 - 7))),
        texture_index: Math.max(10, Math.min(80, 38 + (Math.random() * 18 - 9))),
      },
      scanner_quality_flag: 'pass',
      scan_region: 'left_cheek',
      sunscreen_used: usedSunscreen,
      new_product_added: i === 7, // Added product 7 days ago
      period_status_confirmed: 'accurate',
      cycle_day_estimated: ((cycleDay - 1) % 28) + 1,
      sleep_quality: sleptWell ? 'great' : 'poor',
      stress_level: Math.random() > 0.6 ? 'high' : 'low',
    });

    const dayOffset = 14 - i;
    outputs.push({
      output_id: `demo_output_${i}`,
      daily_id: dailyId,
      acne_score: Math.round(Math.max(15, Math.min(85,
        baseAcne + acneVariation - dayOffset * 1.2))),
      sun_damage_score: Math.round(Math.max(10, Math.min(75,
        baseSunDamage + sunVariation + (usedSunscreen ? -1 : 2)))),
      skin_age_score: Math.round(Math.max(20, Math.min(70,
        baseSkinAge + ageVariation - dayOffset * 0.5))),
      confidence: i > 11 ? 'low' : i > 7 ? 'med' : 'high',
      primary_driver: isCycleWindow ? 'cycle window' :
        !usedSunscreen ? 'low sunscreen adherence' : 'routine adherence',
      recommended_action: isCycleWindow
        ? 'Likely cycle-related; keep routine stable.'
        : !usedSunscreen
        ? 'Add sunscreen daily (AM).'
        : 'Great job! Stay consistent.',
      escalation_flag: false,
    });
  }

  return { records, outputs };
};
