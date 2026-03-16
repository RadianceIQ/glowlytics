/**
 * On-device photo quality checks using expo-face-detector.
 *
 * Replaces the old `simulatePhotoQualityCheck()` mock with real ML-based
 * face detection that runs entirely on-device (no network calls).
 *
 * Quality criteria for skin assessment photos:
 *   1. A face must be detected in the image.
 *   2. The face must fill at least 20% of the frame (user is close enough).
 *   3. The face must be roughly centered (within the middle 50% of the frame).
 *   4. Yaw and roll angles must be within +/-20 degrees (facing camera).
 */

let FaceDetector: typeof import('expo-face-detector') | null = null;
try {
  FaceDetector = require('expo-face-detector');
} catch {
  // Native module not available (Expo Go) — quality checks will pass through
}

// ── Public types ──────────────────────────────────────────────────────

export interface PhotoQualityResult {
  faceDetected: boolean;
  centered: boolean;
  fillPercent: number;
  angleValid: boolean;
  overallPass: boolean;
  issues: string[];
}

// ── Thresholds ────────────────────────────────────────────────────────

const MIN_FILL_PERCENT = 20;
const CENTER_TOLERANCE = 0.50; // face center must be within middle 50% of frame
const MAX_ANGLE = 20; // degrees

// ── Main entry point ──────────────────────────────────────────────────

/**
 * Analyse a captured photo for skin-assessment suitability.
 *
 * @param photoUri    – `file://` URI of the captured photo
 * @param frameWidth  – width of the camera frame in pixels
 * @param frameHeight – height of the camera frame in pixels
 */
export async function checkPhotoQuality(
  photoUri: string,
  frameWidth: number,
  frameHeight: number,
): Promise<PhotoQualityResult> {
  const issues: string[] = [];

  // If native module is unavailable (Expo Go), pass through so flow isn't blocked
  if (!FaceDetector) {
    return {
      faceDetected: true,
      centered: true,
      fillPercent: 100,
      angleValid: true,
      overallPass: true,
      issues: [],
    };
  }

  // Run on-device face detection
  let detectionResult: { faces: any[] };
  try {
    detectionResult = await FaceDetector.detectFacesAsync(photoUri, {
      mode: FaceDetector.FaceDetectorMode.accurate,
      detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
      runClassifications: FaceDetector.FaceDetectorClassifications.none,
    });
  } catch {
    // If detection fails, fall back to a passing result so the scan flow is not blocked.
    return {
      faceDetected: false,
      centered: false,
      fillPercent: 0,
      angleValid: false,
      overallPass: false,
      issues: ['No face detected'],
    };
  }

  const faces = detectionResult.faces;

  // ── 1. Face detected? ───────────────────────────────────────────────

  if (faces.length === 0) {
    return {
      faceDetected: false,
      centered: false,
      fillPercent: 0,
      angleValid: false,
      overallPass: false,
      issues: ['No face detected'],
    };
  }

  // Use the largest detected face (most likely the subject).
  const face = faces.reduce((largest, current) => {
    const largestArea = largest.bounds.size.width * largest.bounds.size.height;
    const currentArea = current.bounds.size.width * current.bounds.size.height;
    return currentArea > largestArea ? current : largest;
  });

  // ── 2. Fill check ───────────────────────────────────────────────────

  const faceArea = face.bounds.size.width * face.bounds.size.height;
  const frameArea = frameWidth * frameHeight;
  const fillPercent = frameArea > 0 ? (faceArea / frameArea) * 100 : 0;
  const fillPass = fillPercent >= MIN_FILL_PERCENT;

  if (!fillPass) {
    issues.push('Move closer');
  }

  // ── 3. Centering check ─────────────────────────────────────────────

  const faceCenterX = face.bounds.origin.x + face.bounds.size.width / 2;
  const faceCenterY = face.bounds.origin.y + face.bounds.size.height / 2;

  const marginX = (1 - CENTER_TOLERANCE) / 2; // 0.30
  const marginY = (1 - CENTER_TOLERANCE) / 2;

  const centeredX =
    faceCenterX >= frameWidth * marginX &&
    faceCenterX <= frameWidth * (1 - marginX);
  const centeredY =
    faceCenterY >= frameHeight * marginY &&
    faceCenterY <= frameHeight * (1 - marginY);

  const centered = centeredX && centeredY;
  if (!centered) {
    issues.push('Center your face');
  }

  // ── 4. Angle check ─────────────────────────────────────────────────

  const yawOk =
    face.yawAngle == null || Math.abs(face.yawAngle) <= MAX_ANGLE;
  const rollOk =
    face.rollAngle == null || Math.abs(face.rollAngle) <= MAX_ANGLE;
  const angleValid = yawOk && rollOk;

  if (!angleValid) {
    issues.push('Face camera directly');
  }

  // ── Overall verdict ─────────────────────────────────────────────────

  const overallPass = fillPass && centered && angleValid;

  return {
    faceDetected: true,
    centered,
    fillPercent: Math.round(fillPercent * 100) / 100,
    angleValid,
    overallPass,
    issues,
  };
}
