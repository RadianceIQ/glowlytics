import type { ScannerReading } from './mockScanner';
import type { Confidence, DailyRecord, ModelOutput, UserProfile, ScanProtocol } from '../types';

// Simulates Vision LLM analysis of skin photos + scanner data
// In production, this would call Claude/GPT-4V API

interface AnalysisInput {
  scannerData: ScannerReading;
  photoUri?: string;
  userProfile: UserProfile;
  protocol: ScanProtocol;
  previousOutputs: ModelOutput[];
  dailyContext: {
    sunscreen_used: boolean;
    new_product_added: boolean;
    cycle_day_estimated?: number;
    sleep_quality?: string;
    stress_level?: string;
  };
}

const clamp = (val: number, min: number, max: number) => Math.max(min, Math.min(max, val));

export const analyzeSkiN = async (input: AnalysisInput): Promise<{
  acne_score: number;
  sun_damage_score: number;
  skin_age_score: number;
  confidence: Confidence;
  primary_driver: string;
  recommended_action: string;
  escalation_flag: boolean;
}> => {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 1500));

  const { scannerData, previousOutputs, dailyContext, userProfile, protocol } = input;

  // Base scores from scanner data (inverse: lower scanner values = better skin)
  let acne = clamp(Math.round(scannerData.inflammation_index * 1.2 + Math.random() * 10), 0, 100);
  let sunDamage = clamp(Math.round(scannerData.pigmentation_index * 1.1 + Math.random() * 8), 0, 100);
  let skinAge = clamp(Math.round(scannerData.texture_index * 1.15 + Math.random() * 12), 0, 100);

  // Context modifiers
  if (!dailyContext.sunscreen_used) {
    sunDamage = clamp(sunDamage + 5, 0, 100);
  }

  if (dailyContext.sleep_quality === 'poor') {
    acne = clamp(acne + 4, 0, 100);
    skinAge = clamp(skinAge + 3, 0, 100);
  }

  if (dailyContext.stress_level === 'high') {
    acne = clamp(acne + 5, 0, 100);
  }

  // Cycle-related acne bump
  const isCycleWindow = dailyContext.cycle_day_estimated &&
    (dailyContext.cycle_day_estimated >= 21 || dailyContext.cycle_day_estimated <= 5);
  if (isCycleWindow) {
    acne = clamp(acne + 7, 0, 100);
  }

  // Determine confidence
  let confidence: Confidence = 'high';
  if (previousOutputs.length < 3) confidence = 'low';
  else if (previousOutputs.length < 7) confidence = 'med';

  // Determine primary driver and action
  let primaryDriver = '';
  let recommendedAction = '';
  let escalation = false;

  // Check for rapid changes
  if (previousOutputs.length > 0) {
    const lastOutput = previousOutputs[previousOutputs.length - 1];
    const acneDelta = acne - lastOutput.acne_score;
    const sunDelta = sunDamage - lastOutput.sun_damage_score;

    if (Math.abs(acneDelta) > 20 || Math.abs(sunDelta) > 20) {
      escalation = true;
    }
  }

  // Action logic based on primary goal
  if (protocol.primary_goal === 'acne') {
    if (isCycleWindow && acne > 50) {
      primaryDriver = 'cycle window';
      recommendedAction = 'Likely cycle-related; keep routine stable and avoid adding new actives.';
    } else if (dailyContext.new_product_added && acne > 40) {
      primaryDriver = 'new product confounder';
      recommendedAction = 'Consider pausing the new product to isolate what\'s driving the change.';
    } else if (dailyContext.stress_level === 'high' || dailyContext.sleep_quality === 'poor') {
      primaryDriver = 'lifestyle factors';
      recommendedAction = 'Focus on sleep and stress management; these may be driving fluctuation.';
    } else if (acne < 30) {
      primaryDriver = 'routine adherence';
      recommendedAction = 'Your routine is working well. Stay consistent.';
    } else {
      primaryDriver = 'general tracking';
      recommendedAction = 'Continue daily scans to build trend data for better insights.';
    }
  } else if (protocol.primary_goal === 'sun_damage') {
    if (!dailyContext.sunscreen_used && sunDamage > 40) {
      primaryDriver = 'low sunscreen adherence';
      recommendedAction = 'Add sunscreen daily (AM) and reapply on high-exposure days.';
    } else if (sunDamage < 30) {
      primaryDriver = 'good protection';
      recommendedAction = 'Great sun protection habits. Keep it up.';
    } else {
      primaryDriver = 'UV exposure';
      recommendedAction = 'Consider adding protective steps like shade and wide-brim hats.';
    }
  } else {
    // skin_age
    if (previousOutputs.length > 5) {
      const avg = previousOutputs.slice(-5).reduce((s, o) => s + o.skin_age_score, 0) / 5;
      if (Math.abs(skinAge - avg) < 3) {
        primaryDriver = 'plateau';
        recommendedAction = 'Consider adding retinol or vitamin C to break through the plateau.';
      } else if (skinAge < avg) {
        primaryDriver = 'texture improvement';
        recommendedAction = 'Your skin texture is improving. Maintain your current routine.';
      } else {
        primaryDriver = 'consistency needed';
        recommendedAction = 'Simplify your routine to improve consistency for better results.';
      }
    } else {
      primaryDriver = 'building baseline';
      recommendedAction = 'Keep scanning daily to establish your trend baseline.';
    }
  }

  return {
    acne_score: acne,
    sun_damage_score: sunDamage,
    skin_age_score: skinAge,
    confidence,
    primary_driver: primaryDriver,
    recommended_action: recommendedAction,
    escalation_flag: escalation,
  };
};

export const getExplanation = (
  output: ModelOutput,
  context: { sunscreen: boolean; cycleWindow: boolean; newProduct: boolean; sleepQuality?: string }
): string => {
  // Template A: Acne
  if (output.primary_driver === 'cycle window') {
    return 'Your acne metric rose during your predicted cycle window. This pattern often reflects hormonal variation. Consider keeping your routine stable for the next few days and avoid introducing new actives.';
  }
  if (output.primary_driver === 'new product confounder') {
    return 'Acne metric worsened soon after a new product was introduced. This may be a confounding change. Consider pausing the new product to isolate what\'s driving the shift.';
  }
  if (output.primary_driver === 'lifestyle factors') {
    return 'Acne metric increased on days with lower sleep / higher stress signals. This may indicate lifestyle-driven fluctuation rather than a product effect.';
  }

  // Template B: Sun damage
  if (output.primary_driver === 'low sunscreen adherence') {
    return 'Sun damage metric increased alongside low sunscreen use. The highest-impact change is daily AM sunscreen and reapplication on high-exposure days.';
  }

  // Template C: Skin age
  if (output.primary_driver === 'texture improvement') {
    return 'Skin age metric improved primarily due to texture/roughness changes compared to baseline.';
  }
  if (output.primary_driver === 'plateau') {
    return 'Skin age metric hasn\'t shifted meaningfully yet. Inconsistent routine adherence can slow visible change — consider simplifying to improve consistency.';
  }

  if (output.primary_driver === 'routine adherence') {
    return 'Your acne metric is improving compared to your baseline. Routine adherence has been consistent, and there were no major confounders detected.';
  }

  return 'Continue daily scans to build more trend data for personalized insights.';
};
