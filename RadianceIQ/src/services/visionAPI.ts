import { env } from '../config/env';
import { getAuthHeaders } from './api';
import type { Confidence, DetectedCondition, RagRecommendation } from '../types';

export interface VisionAnalysisResult {
  acne_score: number;
  sun_damage_score: number;
  skin_age_score: number;
  confidence: Confidence;
  primary_driver: string;
  recommended_action: string;
  conditions?: DetectedCondition[];
  rag_recommendations?: RagRecommendation[];
  personalized_feedback?: string;
}

export async function imageToBase64(uri: string): Promise<string> {
  // Use the legacy API — SDK 54 deprecated the top-level readAsStringAsync
  const FileSystem = await import('expo-file-system/legacy');
  const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64;
}

export async function analyzeWithVisionAPI(
  photoUri: string,
  context: {
    primary_goal: string;
    scan_region: string;
    sunscreen_used: boolean;
    sleep_quality?: string;
    stress_level?: string;
    scan_count: number;
  },
  preEncodedBase64?: string,
): Promise<VisionAnalysisResult> {
  const base64Image = preEncodedBase64 || await imageToBase64(photoUri);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let response: Response;
  try {
    const authHeaders = await getAuthHeaders();
    response = await fetch(`${env.API_BASE_URL}/api/vision/analyze`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        image_base64: base64Image,
        context: {
          primary_goal: context.primary_goal,
          scan_region: context.scan_region,
          sunscreen_used: context.sunscreen_used,
          sleep_quality: context.sleep_quality,
          stress_level: context.stress_level,
          scan_count: context.scan_count,
        },
      }),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Vision API error (${response.status}): ${errorData.error || 'Request failed'}`);
  }

  const result = await response.json();

  // Validate the response shape
  const clamp = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return {
    acne_score: clamp(result.acne_score),
    sun_damage_score: clamp(result.sun_damage_score),
    skin_age_score: clamp(result.skin_age_score),
    confidence: (['low', 'med', 'high'].includes(result.confidence) ? result.confidence : 'low') as Confidence,
    primary_driver: result.primary_driver || 'general tracking',
    recommended_action: result.recommended_action || 'Continue daily scans for more data.',
    conditions: result.conditions,
    rag_recommendations: result.rag_recommendations,
    personalized_feedback: result.personalized_feedback,
  };
}
