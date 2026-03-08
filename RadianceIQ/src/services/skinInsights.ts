import type { DailyRecord, ModelOutput, ProductEntry } from '../types';

export type SkinMetricKey = 'acne' | 'sun_damage' | 'skin_age';
export type SeverityLevel = 'low' | 'moderate' | 'high';

export interface CompositeSignals {
  structure: number;
  hydration: number;
  inflammation: number;
  sunDamage: number;
  elasticity: number;
}

export interface OverallSkinInsight {
  score: number;
  statusLabel: string;
  trendDelta: number;
  actionStatement: string;
  signals: CompositeSignals;
}

export interface FaceZoneInsight {
  key: string;
  label: string;
  top: number;
  left: number;
  severity: SeverityLevel;
  summary: string;
  recommendation: string;
}

export interface MetricDetailInsight {
  metric: SkinMetricKey;
  title: string;
  summary: string;
  score: number;
  severity: SeverityLevel;
  zones: FaceZoneInsight[];
  report: string;
  stopUsing: string;
  considerUsing: string;
  continueUsing: string;
}

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));

const severityFromScore = (score: number): SeverityLevel => {
  if (score >= 68) return 'high';
  if (score >= 38) return 'moderate';
  return 'low';
};

const confidenceStatus = (score: number) => {
  if (score >= 88) return 'Peak';
  if (score >= 75) return 'Strong';
  if (score >= 60) return 'Monitor';
  return 'Recovery';
};

const cadenceStatement = (score: number, trendDelta: number) => {
  if (score >= 88 && trendDelta >= 1) {
    return 'Keep it going! Reduce scans to once weekly.';
  }
  if (score >= 75 && trendDelta >= -3) {
    return 'Strong consistency. Scan twice weekly to maintain momentum.';
  }
  if (score >= 60 && trendDelta >= -8) {
    return 'Signal variability detected. Scan every other day and hold routine changes.';
  }
  return 'Damage noted, increase scans to daily.';
};

const deriveCompositeSignals = ({
  acneRisk,
  sunRisk,
  ageRisk,
  inflammationRisk,
  pigmentationRisk,
  textureRisk,
  stressLevel,
  sleepQuality,
}: {
  acneRisk: number;
  sunRisk: number;
  ageRisk: number;
  inflammationRisk: number;
  pigmentationRisk: number;
  textureRisk: number;
  stressLevel?: DailyRecord['stress_level'];
  sleepQuality?: DailyRecord['sleep_quality'];
}): CompositeSignals => {
  const stressPenalty = stressLevel === 'high' ? 12 : stressLevel === 'med' ? 6 : 0;
  const sleepPenalty = sleepQuality === 'poor' ? 8 : sleepQuality === 'ok' ? 3 : 0;

  return {
    structure: clamp(Math.round(100 - (textureRisk * 0.55 + ageRisk * 0.45))),
    hydration: clamp(Math.round(100 - (textureRisk * 0.5 + acneRisk * 0.2 + stressPenalty + sleepPenalty))),
    inflammation: clamp(Math.round(100 - (inflammationRisk * 0.8 + acneRisk * 0.2))),
    sunDamage: clamp(Math.round(100 - (sunRisk * 0.82 + pigmentationRisk * 0.18))),
    elasticity: clamp(Math.round(100 - (ageRisk * 0.62 + textureRisk * 0.38))),
  };
};

const scoreFromSignals = (signals: CompositeSignals) =>
  Math.round(
    signals.structure * 0.22 +
      signals.hydration * 0.18 +
      signals.inflammation * 0.2 +
      signals.sunDamage * 0.2 +
      signals.elasticity * 0.2
  );

const hasSunscreenProduct = (products: ProductEntry[]) =>
  products.some((product) => {
    const joined = `${product.product_name} ${product.ingredients_list.join(' ')}`.toLowerCase();
    return (
      joined.includes('spf') ||
      joined.includes('zinc oxide') ||
      joined.includes('titanium dioxide') ||
      joined.includes('avobenzone')
    );
  });

const findPotentialTriggerProduct = (products: ProductEntry[]) => {
  const triggerKeywords = ['fragrance', 'coconut', 'oil', 'butter', 'heavy', 'occlusive'];

  const flagged = products.find((product) => {
    const joined = `${product.product_name} ${product.ingredients_list.join(' ')}`.toLowerCase();
    return triggerKeywords.some((keyword) => joined.includes(keyword));
  });

  return flagged || products[products.length - 1] || null;
};

export const getLatestDailyForOutput = (
  latestOutput: ModelOutput | null,
  dailyRecords: DailyRecord[]
) => {
  if (!latestOutput) return null;
  return dailyRecords.find((record) => record.daily_id === latestOutput.daily_id) || null;
};

export const buildOverallSkinInsight = ({
  latestOutput,
  baselineOutput,
  latestDaily,
}: {
  latestOutput: ModelOutput | null;
  baselineOutput: ModelOutput | null;
  latestDaily: DailyRecord | null;
}): OverallSkinInsight | null => {
  if (!latestOutput) return null;

  const inflammationRisk = latestDaily?.scanner_indices.inflammation_index ?? latestOutput.acne_score;
  const pigmentationRisk = latestDaily?.scanner_indices.pigmentation_index ?? latestOutput.sun_damage_score;
  const textureRisk = latestDaily?.scanner_indices.texture_index ?? latestOutput.skin_age_score;

  const signals = deriveCompositeSignals({
    acneRisk: latestOutput.acne_score,
    sunRisk: latestOutput.sun_damage_score,
    ageRisk: latestOutput.skin_age_score,
    inflammationRisk,
    pigmentationRisk,
    textureRisk,
    stressLevel: latestDaily?.stress_level,
    sleepQuality: latestDaily?.sleep_quality,
  });

  const score = scoreFromSignals(signals);

  const baselineSignals = baselineOutput
    ? deriveCompositeSignals({
        acneRisk: baselineOutput.acne_score,
        sunRisk: baselineOutput.sun_damage_score,
        ageRisk: baselineOutput.skin_age_score,
        inflammationRisk: baselineOutput.acne_score,
        pigmentationRisk: baselineOutput.sun_damage_score,
        textureRisk: baselineOutput.skin_age_score,
      })
    : null;

  const baselineScore = baselineSignals ? scoreFromSignals(baselineSignals) : score;
  const trendDelta = score - baselineScore;

  return {
    score,
    statusLabel: confidenceStatus(score),
    trendDelta,
    actionStatement: cadenceStatement(score, trendDelta),
    signals,
  };
};

export const buildMetricDetailInsight = ({
  metric,
  latestOutput,
  latestDaily,
  products,
}: {
  metric: SkinMetricKey;
  latestOutput: ModelOutput | null;
  latestDaily: DailyRecord | null;
  products: ProductEntry[];
}): MetricDetailInsight | null => {
  if (!latestOutput) return null;

  const triggerProduct = findPotentialTriggerProduct(products);
  const sunscreenLogged = hasSunscreenProduct(products);
  const texture = latestDaily?.scanner_indices.texture_index ?? latestOutput.skin_age_score;
  const pigmentation = latestDaily?.scanner_indices.pigmentation_index ?? latestOutput.sun_damage_score;
  const inflammation = latestDaily?.scanner_indices.inflammation_index ?? latestOutput.acne_score;

  if (metric === 'acne') {
    const score = latestOutput.acne_score;
    const severity = severityFromScore(score);
    const zones: FaceZoneInsight[] = [
      {
        key: 'forehead',
        label: 'Forehead',
        top: 18,
        left: 46,
        severity: severityFromScore(Math.round((score + inflammation) / 2)),
        summary: 'Congestion pattern points to excess oil and delayed cell turnover.',
        recommendation: 'Use a gentle BHA cleanser 3 nights weekly and avoid over-exfoliating.',
      },
      {
        key: 'cheeks',
        label: 'Cheeks',
        top: 48,
        left: 26,
        severity: severityFromScore(Math.round(score + (latestDaily?.new_product_added ? 8 : 0))),
        summary: 'Inflammatory marks are appearing in a clustered pattern.',
        recommendation: 'Pause new topical actives for 7 days and monitor if redness settles.',
      },
      {
        key: 'jawline',
        label: 'Jawline',
        top: 74,
        left: 48,
        severity: severityFromScore(Math.round(score + (latestDaily?.cycle_day_estimated ? 6 : 0))),
        summary: 'Hormonal-adjacent flare activity is visible around the jawline.',
        recommendation: 'Prioritize barrier-support moisturizer and avoid picking active lesions.',
      },
    ];

    return {
      metric,
      title: 'Acne',
      summary:
        severity === 'high'
          ? 'Breakout activity is elevated and likely driven by both inflammation and routine instability.'
          : severity === 'moderate'
            ? 'Acne activity is moderate with localized flare zones.'
            : 'Acne is currently controlled with mild localized activity.',
      score,
      severity,
      zones,
      report:
        'Assessment combines inflammation index + acne trend. The current pattern suggests targeted routine cleanup over broad product changes.',
      stopUsing: triggerProduct
        ? `Stop using ${triggerProduct.product_name} for 7 days, then re-introduce only if flare intensity falls.`
        : 'Stop introducing new exfoliants this week while the flare pattern settles.',
      considerUsing: 'Consider a non-comedogenic salicylic acid (0.5%-2%) cleanser and azelaic acid support at night.',
      continueUsing: 'Continue a simple barrier moisturizer and daily SPF to reduce post-acne discoloration risk.',
    };
  }

  if (metric === 'sun_damage') {
    const score = latestOutput.sun_damage_score;
    const severity = severityFromScore(score);
    const zones: FaceZoneInsight[] = [
      {
        key: 'upper_forehead',
        label: 'Upper Forehead',
        top: 14,
        left: 46,
        severity: severityFromScore(Math.round((score + pigmentation) / 2)),
        summary: 'UV exposure accumulation is strongest across the upper forehead.',
        recommendation: 'Improve hat/shade coverage for midday outdoor periods.',
      },
      {
        key: 'temples',
        label: 'Temples',
        top: 34,
        left: 16,
        severity: severityFromScore(Math.round(score + (latestDaily?.sunscreen_used ? 0 : 12))),
        summary: 'Edge-of-face exposure indicates sunscreen misses around the hairline.',
        recommendation: 'Apply SPF across hairline and temples as a dedicated final AM step.',
      },
      {
        key: 'crows_feet',
        label: "Crow's Feet",
        top: 40,
        left: 66,
        severity: severityFromScore(Math.round(score + 5)),
        summary: 'Fine line depth and pigment shift indicate repeated sun burden.',
        recommendation: 'Reapply broad-spectrum SPF every 2 hours when outdoors.',
      },
    ];

    return {
      metric,
      title: 'Sun Damage',
      summary:
        severity === 'high'
          ? 'Photodamage risk is elevated and requires tighter UV protection now.'
          : severity === 'moderate'
            ? 'Sun signal is moderate with correctable prevention gaps.'
            : 'Sun protection trend is strong with low current damage activity.',
      score,
      severity,
      zones,
      report:
        'Assessment combines pigment index + UV-related trend score. Pattern points to preventable exposure rather than sudden acute change.',
      stopUsing: sunscreenLogged
        ? 'Stop treating SPF as optional on low-UV days; daily use is still required.'
        : 'Stop relying on moisturizer-only mornings and add a dedicated SPF 30+ as mandatory.',
      considerUsing: 'Consider mineral SPF 30+ with zinc oxide, and add antioxidant serum in the morning.',
      continueUsing: 'Continue evening repair support with ceramides and hydration to reinforce barrier recovery.',
    };
  }

  const score = latestOutput.skin_age_score;
  const severity = severityFromScore(score);
  const zones: FaceZoneInsight[] = [
    {
      key: 'under_eye',
      label: 'Under Eye',
      top: 42,
      left: 34,
      severity: severityFromScore(Math.round((score + texture) / 2)),
      summary: 'Elasticity drop and fine-line prominence are visible under the eye area.',
      recommendation: 'Introduce peptide or retinoid eye-safe actives gradually to avoid irritation.',
    },
    {
      key: 'nasolabial',
      label: 'Smile Lines',
      top: 58,
      left: 44,
      severity: severityFromScore(Math.round(score + 4)),
      summary: 'Texture depth indicates mild-to-moderate collagen support need.',
      recommendation: 'Use overnight repair creams that emphasize peptides and humectants.',
    },
    {
      key: 'jawline',
      label: 'Jawline',
      top: 74,
      left: 48,
      severity: severityFromScore(Math.round(score + (latestDaily?.sleep_quality === 'poor' ? 10 : 0))),
      summary: 'Lower-face firmness markers are below baseline trend.',
      recommendation: 'Stabilize sleep and hydration to reduce transient elasticity drop.',
    },
  ];

  return {
    metric,
    title: 'Skin Age',
    summary:
      severity === 'high'
        ? 'Skin-age markers are elevated and indicate visible texture and elasticity strain.'
        : severity === 'moderate'
          ? 'Skin-age markers are moderately elevated with targeted repair opportunity.'
          : 'Skin-age trend is stable with mild texture maintenance needed.',
    score,
    severity,
    zones,
    report:
      'Assessment combines texture index + age trend score. Changes appear gradual and respond better to consistency than frequent routine swaps.',
    stopUsing: 'Stop stacking multiple strong actives on the same night to protect barrier resilience.',
    considerUsing: 'Consider retinoid (2-3 nights/week), peptide support, and daily hyaluronic hydration.',
    continueUsing: 'Continue broad-spectrum sunscreen and gentle cleanser to maintain long-term collagen protection.',
  };
};
