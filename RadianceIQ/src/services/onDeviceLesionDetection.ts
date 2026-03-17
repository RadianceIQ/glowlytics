/**
 * On-device YOLOv8 lesion detection via ONNX Runtime.
 *
 * Downloads the model from HuggingFace on first use, caches locally,
 * and runs inference on camera frames. Post-processes with NMS.
 */
import { InferenceSession, Tensor } from 'onnxruntime-react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { decode as decodeJpeg } from 'jpeg-js';
import type { DetectedLesion, LesionClass, FacialRegion } from '../types';

const MODEL_URL =
  'https://huggingface.co/mufasabrownie/glowlytics-skin-models/resolve/main/lesion_detector.onnx';
const MODELS_DIR = `${FileSystem.documentDirectory}models/`;
const MODEL_PATH = `${MODELS_DIR}lesion_detector.onnx`;

const INPUT_SIZE = 640;
const NUM_CLASSES = 6;
const CONF_THRESHOLD = 0.25;
const IOU_THRESHOLD = 0.45;

const LESION_CLASSES = ['comedone', 'papule', 'pustule', 'nodule', 'macule', 'patch'];

let session: InferenceSession | null = null;
let loadingPromise: Promise<boolean> | null = null;

// ---------------------------------------------------------------------------
// Model lifecycle
// ---------------------------------------------------------------------------

/** Check if the model file is cached on disk. */
async function isModelCached(): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(MODEL_PATH);
  return info.exists && !info.isDirectory;
}

/** Download the model from HuggingFace. Shows progress via callback. */
async function downloadModel(
  onProgress?: (pct: number) => void,
): Promise<boolean> {
  try {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });

    const download = FileSystem.createDownloadResumable(
      MODEL_URL,
      MODEL_PATH,
      {},
      (progress) => {
        const pct = progress.totalBytesWritten / progress.totalBytesExpectedToWrite;
        onProgress?.(pct);
      },
    );

    const result = await download.downloadAsync();
    return !!result?.uri;
  } catch (err) {
    console.warn('[lesion-detection] Download failed:', err);
    return false;
  }
}

/** Ensure model is ready: download if needed, then load the ONNX session. */
export async function initLesionDetection(
  onProgress?: (pct: number) => void,
): Promise<boolean> {
  if (session) return true;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const cached = await isModelCached();
      if (!cached) {
        const ok = await downloadModel(onProgress);
        if (!ok) return false;
      }

      session = await InferenceSession.create(MODEL_PATH, {
        executionProviders: ['coreml', 'cpu'],
      });
      return true;
    } catch (err) {
      console.warn('[lesion-detection] Init failed:', err);
      return false;
    } finally {
      loadingPromise = null;
    }
  })();

  return loadingPromise;
}

/** Release the model session. */
export function releaseLesionDetection(): void {
  session = null;
}

/** Check if model is loaded and ready for inference. */
export function isReady(): boolean {
  return session !== null;
}

// ---------------------------------------------------------------------------
// Image preprocessing
// ---------------------------------------------------------------------------

function base64ToUint8Array(base64: string): Uint8Array {
  const raw = globalThis.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    bytes[i] = raw.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decode a JPEG frame, resize to 640×640, normalize to [0,1], CHW layout.
 */
function preprocessFrame(jpegBase64: string): Float32Array | null {
  try {
    const jpegData = base64ToUint8Array(jpegBase64);
    const { data: rgba, width, height } = decodeJpeg(jpegData, {
      useTArray: true,
      formatAsRGBA: true,
    });

    const pixels = rgba as unknown as Uint8Array;
    const tensor = new Float32Array(3 * INPUT_SIZE * INPUT_SIZE);

    const xRatio = width / INPUT_SIZE;
    const yRatio = height / INPUT_SIZE;

    // Nearest-neighbor resize + normalize + CHW
    for (let y = 0; y < INPUT_SIZE; y++) {
      const srcY = Math.min(Math.floor(y * yRatio), height - 1);
      for (let x = 0; x < INPUT_SIZE; x++) {
        const srcX = Math.min(Math.floor(x * xRatio), width - 1);
        const srcIdx = (srcY * width + srcX) * 4;

        const px = y * INPUT_SIZE + x;
        tensor[0 * INPUT_SIZE * INPUT_SIZE + px] = pixels[srcIdx] / 255;     // R
        tensor[1 * INPUT_SIZE * INPUT_SIZE + px] = pixels[srcIdx + 1] / 255; // G
        tensor[2 * INPUT_SIZE * INPUT_SIZE + px] = pixels[srcIdx + 2] / 255; // B
      }
    }

    return tensor;
  } catch (err) {
    console.warn('[lesion-detection] Preprocess failed:', err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// NMS + post-processing
// ---------------------------------------------------------------------------

interface RawBox {
  cx: number; cy: number; w: number; h: number;
  classIdx: number; confidence: number;
}

function computeIoU(a: RawBox, b: RawBox): number {
  const ax1 = a.cx - a.w / 2, ay1 = a.cy - a.h / 2;
  const ax2 = a.cx + a.w / 2, ay2 = a.cy + a.h / 2;
  const bx1 = b.cx - b.w / 2, by1 = b.cy - b.h / 2;
  const bx2 = b.cx + b.w / 2, by2 = b.cy + b.h / 2;

  const ix1 = Math.max(ax1, bx1), iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2), iy2 = Math.min(ay2, by2);
  const inter = Math.max(0, ix2 - ix1) * Math.max(0, iy2 - iy1);

  const aArea = a.w * a.h;
  const bArea = b.w * b.h;
  return inter / (aArea + bArea - inter + 1e-6);
}

function nms(boxes: RawBox[]): RawBox[] {
  const sorted = [...boxes].sort((a, b) => b.confidence - a.confidence);
  const kept: RawBox[] = [];

  for (const box of sorted) {
    let dominated = false;
    for (const k of kept) {
      if (computeIoU(box, k) > IOU_THRESHOLD) {
        dominated = true;
        break;
      }
    }
    if (!dominated) kept.push(box);
  }
  return kept;
}

function bboxToZone(cx: number, cy: number): FacialRegion {
  if (cy < 0.33) {
    return cx < 0.33 ? 'temple' : cx < 0.66 ? 'forehead' : 'temple';
  }
  if (cy < 0.66) {
    return cx < 0.33 ? 'left_cheek' : cx < 0.66 ? 'nose' : 'right_cheek';
  }
  return cx < 0.33 ? 'jaw' : cx < 0.66 ? 'chin' : 'jaw';
}

// ---------------------------------------------------------------------------
// Inference
// ---------------------------------------------------------------------------

/**
 * Detect lesions in a camera frame.
 * @param frameBase64 JPEG frame as base64 string
 * @returns Array of detected lesions with normalized bbox coords
 */
export async function detectLesions(frameBase64: string): Promise<DetectedLesion[]> {
  if (!session) return [];

  const tensorData = preprocessFrame(frameBase64);
  if (!tensorData) return [];

  try {
    const inputTensor = new Tensor('float32', tensorData, [1, 3, INPUT_SIZE, INPUT_SIZE]);
    const results = await session.run({ images: inputTensor });

    const outputKey = results.output0 ? 'output0' : Object.keys(results)[0];
    const raw = results[outputKey];
    const data = raw.data as Float32Array;

    // YOLOv8 output: [1, 10, 8400] — transposed format
    const numDetections = 8400;
    const candidates: RawBox[] = [];

    for (let d = 0; d < numDetections; d++) {
      const cx = data[0 * numDetections + d] / INPUT_SIZE;
      const cy = data[1 * numDetections + d] / INPUT_SIZE;
      const w = data[2 * numDetections + d] / INPUT_SIZE;
      const h = data[3 * numDetections + d] / INPUT_SIZE;

      let maxScore = 0;
      let classIdx = 0;
      for (let c = 0; c < NUM_CLASSES; c++) {
        const score = data[(4 + c) * numDetections + d];
        if (score > maxScore) {
          maxScore = score;
          classIdx = c;
        }
      }

      if (maxScore >= CONF_THRESHOLD) {
        candidates.push({ cx, cy, w, h, classIdx, confidence: maxScore });
      }
    }

    const kept = nms(candidates);

    return kept.map((box) => ({
      class: LESION_CLASSES[box.classIdx] as LesionClass,
      confidence: box.confidence,
      bbox: [
        Math.max(0, box.cx - box.w / 2),
        Math.max(0, box.cy - box.h / 2),
        box.w,
        box.h,
      ] as [number, number, number, number],
      zone: bboxToZone(box.cx, box.cy),
    }));
  } catch (err) {
    console.warn('[lesion-detection] Inference failed:', err);
    return [];
  }
}
