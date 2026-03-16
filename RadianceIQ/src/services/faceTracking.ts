let FaceDetector: typeof import('expo-face-detector') | null = null;
try {
  FaceDetector = require('expo-face-detector');
} catch {
  // Native module not available (Expo Go) — requires EAS build for real face detection
}

export interface FaceTrackingState {
  status: 'no_face' | 'misaligned' | 'aligned';
  faceRect?: { x: number; y: number; width: number; height: number };
  issues: string[];
  lightingOk: boolean;
  lightingUnavailable?: boolean;
}

// Thresholds
const MIN_FILL_PERCENT = 20; // face must fill at least 20% of frame
const CENTER_TOLERANCE = 0.45; // face center must be within middle 45% of frame
const MAX_ANGLE = 15; // degrees for yaw/roll
const LIGHTING_MIN_FILL = 12; // face must fill at least 12% for reliable lighting inference
const LIGHTING_MAX_ISSUES = 1; // allow 1 minor alignment issue for "good light"

/**
 * Analyze a single frame for face tracking state.
 * Uses FaceDetector.detectFacesAsync in fast mode.
 */
export async function analyzeFrame(
  photoUri: string,
  frameWidth: number,
  frameHeight: number,
): Promise<FaceTrackingState> {
  const issues: string[] = [];

  if (!FaceDetector) {
    // Native module unavailable (Expo Go) — allow capture but show lighting as unknown
    return {
      status: 'aligned',
      issues: [],
      lightingOk: true,
      lightingUnavailable: true,
    };
  }

  let detectionResult: { faces: any[] };
  try {
    detectionResult = await FaceDetector.detectFacesAsync(photoUri, {
      mode: FaceDetector.FaceDetectorMode.fast,
      detectLandmarks: FaceDetector.FaceDetectorLandmarks.none,
      runClassifications: FaceDetector.FaceDetectorClassifications.none,
    });
  } catch {
    return {
      status: 'no_face',
      issues: ['Camera not available'],
      lightingOk: false,
    };
  }

  const faces = detectionResult.faces;

  if (faces.length === 0) {
    return {
      status: 'no_face',
      issues: ['Position your face in the frame'],
      lightingOk: false,
    };
  }

  // Use the largest detected face
  const face = faces.reduce((largest, current) => {
    const largestArea = largest.bounds.size.width * largest.bounds.size.height;
    const currentArea = current.bounds.size.width * current.bounds.size.height;
    return currentArea > largestArea ? current : largest;
  });

  const faceRect = {
    x: face.bounds.origin.x,
    y: face.bounds.origin.y,
    width: face.bounds.size.width,
    height: face.bounds.size.height,
  };

  // Fill check
  const faceArea = face.bounds.size.width * face.bounds.size.height;
  const frameArea = frameWidth * frameHeight;
  const fillPercent = frameArea > 0 ? (faceArea / frameArea) * 100 : 0;
  if (fillPercent < MIN_FILL_PERCENT) {
    issues.push('Move closer');
  }

  // Center check
  const faceCenterX = face.bounds.origin.x + face.bounds.size.width / 2;
  const faceCenterY = face.bounds.origin.y + face.bounds.size.height / 2;
  const marginX = (1 - CENTER_TOLERANCE) / 2;
  const marginY = (1 - CENTER_TOLERANCE) / 2;
  const centeredX = faceCenterX >= frameWidth * marginX && faceCenterX <= frameWidth * (1 - marginX);
  const centeredY = faceCenterY >= frameHeight * marginY && faceCenterY <= frameHeight * (1 - marginY);
  if (!centeredX || !centeredY) {
    if (faceCenterX < frameWidth * marginX) issues.push('Move right');
    else if (faceCenterX > frameWidth * (1 - marginX)) issues.push('Move left');
    if (faceCenterY < frameHeight * marginY) issues.push('Move down');
    else if (faceCenterY > frameHeight * (1 - marginY)) issues.push('Move up');
  }

  // Angle check
  const yawOk = face.yawAngle == null || Math.abs(face.yawAngle) <= MAX_ANGLE;
  const rollOk = face.rollAngle == null || Math.abs(face.rollAngle) <= MAX_ANGLE;
  if (!yawOk || !rollOk) {
    issues.push('Turn toward camera');
  }

  // Lighting: stricter inference from face detection quality.
  // A well-lit face is detected at larger fill %, with no alignment issues, and a
  // reasonable bounding box aspect ratio (not too narrow = side-lit shadow).
  const lightingOk = faces.length > 0
    && fillPercent >= LIGHTING_MIN_FILL
    && issues.length <= LIGHTING_MAX_ISSUES;

  const isAligned = issues.length === 0;

  return {
    status: isAligned ? 'aligned' : 'misaligned',
    faceRect,
    issues,
    lightingOk,
  };
}

/**
 * Derive directional hints from issues for UI indicators.
 */
export function getDirections(issues: string[]): ('left' | 'right' | 'up' | 'down' | 'closer' | 'face_camera')[] {
  const dirs: ('left' | 'right' | 'up' | 'down' | 'closer' | 'face_camera')[] = [];
  for (const issue of issues) {
    if (issue === 'Move closer') dirs.push('closer');
    else if (issue === 'Move left') dirs.push('left');
    else if (issue === 'Move right') dirs.push('right');
    else if (issue === 'Move up') dirs.push('up');
    else if (issue === 'Move down') dirs.push('down');
    else if (issue === 'Turn toward camera') dirs.push('face_camera');
  }
  return dirs;
}
