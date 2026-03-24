import { useCallback, useRef, useState } from 'react';
import { analyzeAlignment, FaceTrackingState } from '../services/faceTracking';
import type { DetectedFace } from '../services/faceTracking';

/**
 * Face tracking hook for VisionCamera.
 *
 * Instead of polling takePictureAsync (old expo-face-detector approach),
 * this hook processes face data from VisionCamera's frame processor callback.
 * The camera screen calls `onFacesDetected` with face data from the
 * react-native-vision-camera-face-detector plugin.
 *
 * Returns:
 *  - trackingState: alignment status, faceRect, issues, lighting
 *  - onFacesDetected: callback to feed face data from the frame processor
 *  - lastFrameUri: URI of the last captured frame (for lesion detection)
 *  - lastFrameWidth/Height: dimensions of the last frame
 */
export function useFaceTracking(
  enabled: boolean,
  frameWidth: number = 720,
  frameHeight: number = 1280,
): {
  trackingState: FaceTrackingState;
  onFacesDetected: (faces: DetectedFace[]) => void;
  lastFrameUri: string | null;
  lastFrameWidth: number;
  lastFrameHeight: number;
} {
  const [trackingState, setTrackingState] = useState<FaceTrackingState>({
    status: 'no_face',
    issues: [],
    lightingOk: false,
  });
  const [lastFrameUri, setLastFrameUri] = useState<string | null>(null);
  const frameDimsRef = useRef({ w: 0, h: 0 });

  const onFacesDetected = useCallback((faces: DetectedFace[]) => {
    if (!enabled) return;
    const state = analyzeAlignment(faces, frameWidth, frameHeight);
    setTrackingState(state);
  }, [enabled, frameWidth, frameHeight]);

  return {
    trackingState,
    onFacesDetected,
    lastFrameUri,
    lastFrameWidth: frameDimsRef.current.w,
    lastFrameHeight: frameDimsRef.current.h,
  };
}
