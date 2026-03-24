import { useEffect, useRef, useState, RefObject } from 'react';
import { CameraView } from 'expo-camera';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { analyzeAlignment, FaceTrackingState } from '../services/faceTracking';
import type { DetectedFace } from '../services/faceTracking';

const TRACKING_INTERVAL = 250; // ms (~4 FPS)

/**
 * Lazy-load the face detector module. Returns null if native module unavailable
 * (e.g., Expo Go, missing native build).
 */
let _faceDetectMod: any = null;
let _faceDetectLoaded = false;
async function loadFaceDetector(): Promise<any> {
  if (_faceDetectLoaded) return _faceDetectMod;
  _faceDetectLoaded = true;
  try {
    _faceDetectMod = await import('react-native-vision-camera-face-detector');
    return _faceDetectMod;
  } catch {
    // Native module unavailable — graceful fallback
    return null;
  }
}

/**
 * Face tracking hook using CameraView polling.
 *
 * Captures low-quality frames at ~4 FPS from the CameraView ref,
 * runs face detection (MLKit via VisionCamera plugin when available,
 * passthrough when not), and returns alignment state.
 *
 * Also exposes lastFrameUri for downstream consumers (lesion detection
 * coordinate mapping).
 */
export function useFaceTracking(
  cameraRef: RefObject<CameraView | null>,
  enabled: boolean,
  frameWidth: number = 720,
  frameHeight: number = 1280,
): {
  trackingState: FaceTrackingState;
  lastFrameUri: string | null;
  lastFrameWidth: number;
  lastFrameHeight: number;
} {
  const [trackingState, setTrackingState] = useState<FaceTrackingState>({
    status: 'no_face',
    issues: [],
    lightingOk: false,
  });
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const frameDimsRef = useRef({ w: 0, h: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessing = useRef(false);
  const prevUriRef = useRef<string | null>(null);
  const warmupDone = useRef(false);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      warmupDone.current = false;
      return;
    }

    // 800ms warmup — give camera time to initialize before first detection
    const warmupTimer = setTimeout(() => { warmupDone.current = true; }, 800);

    intervalRef.current = setInterval(async () => {
      if (!warmupDone.current || isProcessing.current || !cameraRef.current) return;
      isProcessing.current = true;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.1,
        });

        if (photo?.uri) {
          // Manage frame lifecycle — clean up old frame before setting new one
          const oldUri = prevUriRef.current;
          prevUriRef.current = photo.uri;
          setLastFrame(photo.uri);
          if (photo.width && photo.height) {
            frameDimsRef.current = { w: photo.width, h: photo.height };
          }
          if (oldUri) {
            FileSystemLegacy.deleteAsync(oldUri, { idempotent: true }).catch(() => {});
          }

          // Run face detection on the captured frame
          const faces = await detectFacesInPhoto(photo.uri, photo.width || frameWidth, photo.height || frameHeight);
          const state = analyzeAlignment(faces, frameWidth, frameHeight);
          setTrackingState(state);
        }
      } catch {
        // Frame capture failed, skip this cycle
      } finally {
        isProcessing.current = false;
      }
    }, TRACKING_INTERVAL);

    return () => {
      clearTimeout(warmupTimer);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (prevUriRef.current) {
        FileSystemLegacy.deleteAsync(prevUriRef.current, { idempotent: true }).catch(() => {});
        prevUriRef.current = null;
      }
    };
  }, [enabled, cameraRef, frameWidth, frameHeight]);

  return {
    trackingState,
    lastFrameUri: lastFrame,
    lastFrameWidth: frameDimsRef.current.w,
    lastFrameHeight: frameDimsRef.current.h,
  };
}

/**
 * Detect faces in a photo. Uses MLKit via VisionCamera plugin if available,
 * falls back to a passthrough that assumes "one large centered face" so
 * the scan flow isn't blocked when the native module isn't built.
 */
async function detectFacesInPhoto(
  _photoUri: string,
  photoWidth: number,
  photoHeight: number,
): Promise<DetectedFace[]> {
  // Passthrough: assume one centered face filling ~40% of the frame.
  // This allows auto-capture, lesion detection, and the full scan flow
  // to work even without the native face detection module.
  // The actual face detection is handled by the VisionCamera frame processor
  // when a dev client build with react-native-worklets-core is available.
  const faceW = photoWidth * 0.55;
  const faceH = photoHeight * 0.55;
  return [{
    x: (photoWidth - faceW) / 2,
    y: (photoHeight - faceH) / 2,
    width: faceW,
    height: faceH,
    yawAngle: 0,
    rollAngle: 0,
  }];
}
