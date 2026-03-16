import { useEffect, useRef, useState, RefObject } from 'react';
import { CameraView } from 'expo-camera';
import * as FileSystemLegacy from 'expo-file-system/legacy';
import { analyzeFrame, FaceTrackingState } from '../services/faceTracking';

const TRACKING_INTERVAL = 200; // ms (~5 FPS)

export function useFaceTracking(
  cameraRef: RefObject<CameraView | null>,
  enabled: boolean,
  frameWidth: number = 720,
  frameHeight: number = 1280,
): { trackingState: FaceTrackingState; lastFrame: string | null } {
  const [trackingState, setTrackingState] = useState<FaceTrackingState>({
    status: 'no_face',
    issues: [],
    lightingOk: false,
  });
  const [lastFrame, setLastFrame] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessing = useRef(false);
  const prevUriRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(async () => {
      if (isProcessing.current || !cameraRef.current) return;
      isProcessing.current = true;

      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.1,
          skipProcessing: true,
        });

        if (photo?.uri) {
          if (prevUriRef.current) {
            FileSystemLegacy.deleteAsync(prevUriRef.current, { idempotent: true }).catch((e) => console.debug('Frame cleanup:', e));
          }
          prevUriRef.current = photo.uri;
          setLastFrame(photo.uri);
          const state = await analyzeFrame(photo.uri, frameWidth, frameHeight);
          setTrackingState(state);
        }
      } catch {
        // Frame capture failed, skip this cycle
      } finally {
        isProcessing.current = false;
      }
    }, TRACKING_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (prevUriRef.current) {
        FileSystemLegacy.deleteAsync(prevUriRef.current, { idempotent: true }).catch((e) => console.debug('Frame cleanup:', e));
        prevUriRef.current = null;
      }
    };
  }, [enabled, cameraRef, frameWidth, frameHeight]);

  return { trackingState, lastFrame };
}
