import { useCallback, useEffect, useRef, useState } from 'react';
import { analyzeAlignment, FaceTrackingState } from '../services/faceTracking';
import type { DetectedFace } from '../services/faceTracking';

/**
 * Face tracking hook — receives face detection results from VisionCamera
 * frame processor and computes alignment state.
 *
 * The camera screen is responsible for running the frame processor and
 * calling `onFacesDetected` with mapped face data. This hook is pure
 * React state management + alignment math.
 */
export function useFaceTracking(
  enabled: boolean,
  frameWidth: number = 720,
  frameHeight: number = 1280,
): {
  trackingState: FaceTrackingState;
  onFacesDetected: (faces: DetectedFace[], w: number, h: number) => void;
  lastFrameWidth: number;
  lastFrameHeight: number;
} {
  const [trackingState, setTrackingState] = useState<FaceTrackingState>({
    status: 'no_face',
    issues: [],
    lightingOk: false,
  });
  const [frameDims, setFrameDims] = useState({ w: 0, h: 0 });
  const warmupDone = useRef(false);

  useEffect(() => {
    if (enabled) {
      const t = setTimeout(() => { warmupDone.current = true; }, 800);
      return () => { clearTimeout(t); warmupDone.current = false; };
    }
    warmupDone.current = false;
    setTrackingState({ status: 'no_face', issues: [], lightingOk: false });
  }, [enabled]);

  const onFacesDetected = useCallback((faces: DetectedFace[], w: number, h: number) => {
    if (!enabled || !warmupDone.current) return;
    if (w > 0 && h > 0) setFrameDims({ w, h });
    setTrackingState(analyzeAlignment(faces, frameWidth, frameHeight));
  }, [enabled, frameWidth, frameHeight]);

  return {
    trackingState,
    onFacesDetected,
    lastFrameWidth: frameDims.w,
    lastFrameHeight: frameDims.h,
  };
}
