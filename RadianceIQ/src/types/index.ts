export type PrimaryGoal = 'acne' | 'sun_damage' | 'skin_age';
export type PeriodApplicable = 'yes' | 'no' | 'prefer_not';
export type ScanRegion = 'forehead' | 'left_cheek' | 'right_cheek' | 'jawline' | 'whole_face' | 'crows_feet' | 'under_eye' | 'temple';
export type QualityFlag = 'pass' | 'warn' | 'fail';
export type Confidence = 'low' | 'med' | 'high';
export type SleepQuality = 'poor' | 'ok' | 'great';
export type StressLevel = 'low' | 'med' | 'high';
export type UsageSchedule = 'AM' | 'PM' | 'both';
export type CaptureMethod = 'barcode' | 'photo' | 'search';
export type PermissionStatus = 'not_requested' | 'granted' | 'denied' | 'blocked' | 'unavailable';
export type HealthSource = 'apple_health' | 'health_connect';
export type HealthDataType = 'sleep' | 'resting_heart_rate' | 'heart_rate_variability';

export interface HealthConnectionState {
  status: PermissionStatus;
  source?: HealthSource;
  requested_types: HealthDataType[];
  granted_types: HealthDataType[];
  sync_skipped: boolean;
  last_checked_at?: string;
  last_synced_at?: string;
  availability_note?: string;
}

export interface UserProfile {
  user_id: string;
  age_range: string;
  location_coarse: string;
  period_applicable: PeriodApplicable;
  period_last_start_date?: string;
  cycle_length_days: number;
  smoker_status?: boolean;
  drink_baseline_frequency?: string;
  wearable_connected: boolean;
  wearable_source?: string;
  camera_permission_status: PermissionStatus;
  health_connection: HealthConnectionState;
  onboarding_complete: boolean;
}

export interface ScanProtocol {
  protocol_id: string;
  user_id: string;
  primary_goal: PrimaryGoal;
  scan_region: ScanRegion;
  scan_frequency: string;
  baseline_date: string;
}

export interface ProductEntry {
  user_product_id: string;
  user_id: string;
  product_name: string;
  product_capture_method: CaptureMethod;
  ingredients_list: string[];
  usage_schedule: UsageSchedule;
  start_date: string;
  end_date?: string;
  notes?: string;
}

export interface DailyRecord {
  daily_id: string;
  user_id: string;
  date: string;
  scanner_reading_id: string;
  scanner_indices: {
    inflammation_index: number;
    pigmentation_index: number;
    texture_index: number;
  };
  scanner_quality_flag: QualityFlag;
  scan_region: ScanRegion;
  photo_uri?: string;
  photo_quality_flag?: QualityFlag;
  sunscreen_used: boolean;
  new_product_added: boolean;
  period_status_confirmed?: 'accurate' | 'not_accurate';
  cycle_day_estimated?: number;
  sleep_quality?: SleepQuality;
  stress_level?: StressLevel;
  drinks_yesterday?: string;
}

export interface ModelOutput {
  output_id: string;
  daily_id: string;
  acne_score: number;
  sun_damage_score: number;
  skin_age_score: number;
  confidence: Confidence;
  primary_driver?: string;
  recommended_action: string;
  escalation_flag: boolean;
}

export interface ScanResult {
  daily: DailyRecord;
  output: ModelOutput;
}
