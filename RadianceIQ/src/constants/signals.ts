import { Colors } from './theme';
import type { SignalConfidenceLevel } from '../types';
import type { CompositeSignals, SkinMetricKey } from '../services/skinInsights';

// ---------------------------------------------------------------------------
// Signal colors — canonical source for all signal-colored UI
// Uses camelCase keys matching CompositeSignals (sunDamage, not sun_damage).
// For route-param keys (snake_case), use signalColorByRouteKey().
// ---------------------------------------------------------------------------

export const SIGNAL_COLORS: Record<keyof CompositeSignals, string> = {
  structure: '#3A9E8F',
  hydration: '#3B7FC4',
  inflammation: '#D14343',
  sunDamage: '#C07B2A',
  elasticity: '#7B5FC2',
};

export const SIGNAL_LABELS: Record<keyof CompositeSignals, string> = {
  structure: 'Structure',
  hydration: 'Hydration',
  inflammation: 'Inflammation',
  sunDamage: 'Sun Damage',
  elasticity: 'Elasticity',
};

/** Map a snake_case route key to the camelCase CompositeSignals key. */
export const toSignalKey = (routeKey: string): keyof CompositeSignals => {
  if (routeKey === 'sun_damage') return 'sunDamage';
  return routeKey as keyof CompositeSignals;
};

/** Lookup signal color by snake_case route key (e.g. 'sun_damage'). */
export const signalColorByRouteKey = (routeKey: string): string =>
  SIGNAL_COLORS[toSignalKey(routeKey)] ?? Colors.textMuted;

/** Lookup signal label by snake_case route key. */
export const signalLabelByRouteKey = (routeKey: string): string =>
  SIGNAL_LABELS[toSignalKey(routeKey)] ?? routeKey;

// ---------------------------------------------------------------------------
// Confidence badge color
// ---------------------------------------------------------------------------

export const confidenceBadgeColor = (level: SignalConfidenceLevel): string => {
  switch (level) {
    case 'high': return Colors.success;
    case 'med': return Colors.warning;
    case 'low': return Colors.error;
    default: return Colors.textMuted;
  }
};

// ---------------------------------------------------------------------------
// Metric guide — shared between results and skin-metrics screens
// ---------------------------------------------------------------------------

export interface MetricGuideEntry {
  key: SkinMetricKey;
  title: string;
  subtitle: string;
  detail: string;
  color: string;
}

export const METRIC_GUIDE: MetricGuideEntry[] = [
  {
    key: 'acne',
    title: 'Acne',
    subtitle: 'Inflammation + congestion signal',
    detail: 'Combines breakout trend, inflammation index, and confounders like new products.',
    color: Colors.acne,
  },
  {
    key: 'sun_damage',
    title: 'Sun Damage',
    subtitle: 'UV and pigmentation load',
    detail: 'Tracks photodamage risk using pigmentation index and sun-protection consistency.',
    color: Colors.sunDamage,
  },
  {
    key: 'skin_age',
    title: 'Skin Age',
    subtitle: 'Texture + elasticity drift',
    detail: 'Reflects visible texture and firmness trend relative to your baseline scan.',
    color: Colors.skinAge,
  },
];

// ---------------------------------------------------------------------------
// Score status label — shared across home, results, trend screens
// ---------------------------------------------------------------------------

export const formatMetricStatus = (value: number): string => {
  if (value <= 25) return 'Calm';
  if (value <= 50) return 'Stable';
  if (value <= 75) return 'Elevated';
  return 'Watch';
};
