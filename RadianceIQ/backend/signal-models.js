/**
 * Layer 2: Custom CV Model Inference via ONNX Runtime
 *
 * Loads and runs custom computer vision models for signal-specific scoring:
 * - Structure (MobileNetV3): pore detection + texture regularity
 * - Hydration (EfficientNet-B0): Gabor+LBP hydration scoring
 * - Elasticity (EfficientNet-B0): Frangi wrinkle quantification
 * - Lesion detection (YOLOv8): comedones, papules, pustules, etc.
 *
 * Models are loaded from ONNX format. When models are not yet available
 * (pre-training phase), Layer 1 deterministic features are used as fallback.
 */

const path = require('path');
const fs = require('fs');

let ort;
try {
  ort = require('onnxruntime-node');
} catch {
  ort = null;
}

let sharp;
try {
  sharp = require('sharp');
} catch {
  sharp = null;
}

const MODEL_DIR = path.join(__dirname, 'models');

// Model session cache
let structureSession = null;
let hydrationSession = null;
let elasticitySession = null;
let lesionSession = null;

/**
 * Check if a model file exists.
 */
function modelExists(name) {
  return fs.existsSync(path.join(MODEL_DIR, `${name}.onnx`));
}

/**
 * Load an ONNX model session (cached).
 */
async function loadModel(name) {
  if (!ort) return null;
  const modelPath = path.join(MODEL_DIR, `${name}.onnx`);
  if (!fs.existsSync(modelPath)) return null;

  try {
    return await ort.InferenceSession.create(modelPath, {
      executionProviders: ['cpu'],
    });
  } catch (err) {
    console.warn(`[signal-models] Failed to load ${name}:`, err.message);
    return null;
  }
}

/**
 * Initialize all model sessions. Call once at startup.
 */
async function initModels() {
  if (!ort) {
    console.warn('[signal-models] onnxruntime-node not available — using Layer 1 features only');
    return { loaded: [] };
  }

  const loaded = [];

  if (modelExists('structure')) {
    structureSession = await loadModel('structure');
    if (structureSession) loaded.push('structure');
  }
  if (modelExists('hydration')) {
    hydrationSession = await loadModel('hydration');
    if (hydrationSession) loaded.push('hydration');
  }
  if (modelExists('elasticity')) {
    elasticitySession = await loadModel('elasticity');
    if (elasticitySession) loaded.push('elasticity');
  }
  if (modelExists('lesion_detector')) {
    lesionSession = await loadModel('lesion_detector');
    if (lesionSession) loaded.push('lesion_detector');
  }

  console.log(`[signal-models] Loaded models: ${loaded.length > 0 ? loaded.join(', ') : 'none (using Layer 1 fallback)'}`);
  return { loaded };
}

/**
 * Map facial zone from bbox center coordinates.
 */
function bboxToZone(cx, cy) {
  if (cy < 0.25) return 'forehead';
  if (cy < 0.45) {
    if (cx < 0.35) return 'left_cheek';
    if (cx > 0.65) return 'right_cheek';
    return 'nose';
  }
  if (cy < 0.65) {
    if (cx < 0.35) return 'left_cheek';
    if (cx > 0.65) return 'right_cheek';
    return 'nose';
  }
  if (cy < 0.8) return 'chin';
  return 'jaw';
}

const LESION_CLASSES = ['comedone', 'papule', 'pustule', 'nodule', 'macule', 'patch'];

/**
 * Run all available models on the image.
 * Returns model-based signal score overrides and lesion detections.
 *
 * @param {string} base64Image - Base64-encoded image
 * @param {object} layer1Features - Features from deterministic image processing
 * @returns {Promise<object>} Model inference results
 */
async function runAllModels(base64Image, layer1Features) {
  const results = {
    // Model-based signal score overrides (null means use Layer 1)
    signalOverrides: {
      structure: null,
      hydration: null,
      elasticity: null,
    },
    // Lesion detections
    lesions: [],
    // Per-signal confidence based on which layers contributed
    signalConfidence: {
      structure: 'med',
      hydration: 'med',
      inflammation: 'med',
      sunDamage: 'med',
      elasticity: 'med',
    },
  };

  // Run available models in parallel
  const promises = [];

  if (structureSession) {
    promises.push(
      runStructureModel(base64Image, layer1Features)
        .then((score) => {
          if (score != null) {
            results.signalOverrides.structure = score;
            results.signalConfidence.structure = 'high';
          }
        })
        .catch((err) => {
          console.warn('[signal-models] Structure model error:', err.message);
        })
    );
  }

  if (hydrationSession) {
    promises.push(
      runHydrationModel(base64Image, layer1Features)
        .then((score) => {
          if (score != null) {
            results.signalOverrides.hydration = score;
            results.signalConfidence.hydration = 'high';
          }
        })
        .catch((err) => {
          console.warn('[signal-models] Hydration model error:', err.message);
        })
    );
  }

  if (elasticitySession) {
    promises.push(
      runElasticityModel(base64Image, layer1Features)
        .then((score) => {
          if (score != null) {
            results.signalOverrides.elasticity = score;
            results.signalConfidence.elasticity = 'high';
          }
        })
        .catch((err) => {
          console.warn('[signal-models] Elasticity model error:', err.message);
        })
    );
  }

  if (lesionSession) {
    promises.push(
      runLesionDetector(base64Image)
        .then((lesions) => {
          results.lesions = lesions;
        })
        .catch((err) => {
          console.warn('[signal-models] Lesion detector error:', err.message);
        })
    );
  }

  await Promise.all(promises);

  // Update confidence based on what layers contributed
  // Layer 1 (deterministic) alone = 'med', Layer 1 + Layer 2 = 'high'
  // Inflammation and sun damage are deterministic-primary, so 'med' with Layer 1 features
  if (layer1Features) {
    if (!structureSession) results.signalConfidence.structure = 'med';
    if (!hydrationSession) results.signalConfidence.hydration = 'med';
    if (!elasticitySession) results.signalConfidence.elasticity = 'med';
  }

  return results;
}

// ImageNet normalization constants
const IMAGENET_MEAN = [0.485, 0.456, 0.406];
const IMAGENET_STD = [0.229, 0.224, 0.225];

/**
 * Prepare an image tensor from base64 for ONNX inference.
 * @param {string} base64Image - Base64-encoded image
 * @param {number} size - Target width/height
 * @param {object} [options] - { greenChannelCLAHE: bool }
 * @returns {Promise<ort.Tensor>} Float32 tensor [1, 3, size, size]
 */
async function prepareImageTensor(base64Image, size, options) {
  if (!sharp || !ort) return null;

  const buf = Buffer.from(base64Image, 'base64');
  const { data } = await sharp(buf)
    .resize(size, size, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = size * size;
  const floats = new Float32Array(3 * pixels);

  if (options && options.greenChannelCLAHE) {
    // Green channel → simple contrast stretch (CLAHE approximation) → stack 3x
    let min = 255, max = 0;
    for (let i = 0; i < pixels; i++) {
      const g = data[i * 3 + 1];
      if (g < min) min = g;
      if (g > max) max = g;
    }
    const range = max - min || 1;
    for (let i = 0; i < pixels; i++) {
      const stretched = (data[i * 3 + 1] - min) / range;
      const normalized = (stretched - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      floats[i] = normalized;             // channel 0
      floats[pixels + i] = normalized;     // channel 1
      floats[2 * pixels + i] = normalized; // channel 2
    }
  } else {
    // Standard RGB → CHW → ImageNet normalize
    for (let i = 0; i < pixels; i++) {
      floats[i] = (data[i * 3] / 255 - IMAGENET_MEAN[0]) / IMAGENET_STD[0];
      floats[pixels + i] = (data[i * 3 + 1] / 255 - IMAGENET_MEAN[1]) / IMAGENET_STD[1];
      floats[2 * pixels + i] = (data[i * 3 + 2] / 255 - IMAGENET_MEAN[2]) / IMAGENET_STD[2];
    }
  }

  return new ort.Tensor('float32', floats, [1, 3, size, size]);
}

/**
 * Compute Intersection over Union for two axis-aligned bounding boxes.
 * Boxes are [x, y, w, h].
 */
function computeIoU(boxA, boxB) {
  const ax1 = boxA[0], ay1 = boxA[1], ax2 = boxA[0] + boxA[2], ay2 = boxA[1] + boxA[3];
  const bx1 = boxB[0], by1 = boxB[1], bx2 = boxB[0] + boxB[2], by2 = boxB[1] + boxB[3];

  const ix1 = Math.max(ax1, bx1);
  const iy1 = Math.max(ay1, by1);
  const ix2 = Math.min(ax2, bx2);
  const iy2 = Math.min(ay2, by2);

  const iw = Math.max(0, ix2 - ix1);
  const ih = Math.max(0, iy2 - iy1);
  const intersection = iw * ih;

  const areaA = boxA[2] * boxA[3];
  const areaB = boxB[2] * boxB[3];
  const union = areaA + areaB - intersection;

  return union > 0 ? intersection / union : 0;
}

/**
 * Greedy Non-Maximum Suppression.
 * @param {Array<[number,number,number,number]>} boxes - [x, y, w, h]
 * @param {number[]} scores - confidence scores
 * @param {number} iouThreshold
 * @returns {number[]} kept indices
 */
function nms(boxes, scores, iouThreshold) {
  const indices = scores.map((_, i) => i).sort((a, b) => scores[b] - scores[a]);
  const kept = [];
  const suppressed = new Set();

  for (const i of indices) {
    if (suppressed.has(i)) continue;
    kept.push(i);
    for (const j of indices) {
      if (j === i || suppressed.has(j)) continue;
      if (computeIoU(boxes[i], boxes[j]) > iouThreshold) {
        suppressed.add(j);
      }
    }
  }

  return kept;
}

/**
 * Run the structure model (MobileNetV3).
 * Returns score 0-100 or null if model unavailable.
 */
async function runStructureModel(base64Image, layer1Features) {
  if (!structureSession) return null;

  const tensor = await prepareImageTensor(base64Image, 224, { greenChannelCLAHE: true });
  if (!tensor) return null;

  const results = await structureSession.run({ image: tensor });

  // Model outputs 3 separate tensors: pore_count, texture_regularity, structure_score
  const score = results.structure_score
    ? results.structure_score.data[0]
    : results[Object.keys(results)[Object.keys(results).length - 1]].data[0];
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Run the hydration model (EfficientNet-B0).
 */
async function runHydrationModel(base64Image, layer1Features) {
  if (!hydrationSession) return null;

  const imageTensor = await prepareImageTensor(base64Image, 224);
  if (!imageTensor) return null;

  // Build handcrafted features tensor (44-dim)
  const handcrafted = layer1Features && layer1Features.hydration_handcrafted
    ? layer1Features.hydration_handcrafted
    : new Float32Array(44);

  const featureTensor = new ort.Tensor('float32', handcrafted, [1, 44]);
  const results = await hydrationSession.run({
    image: imageTensor,
    handcrafted_features: featureTensor,
  });

  const outputKey = results.hydration_score ? 'hydration_score' : Object.keys(results)[0];
  const score = results[outputKey].data[0];
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Run the elasticity model (EfficientNet-B0).
 */
async function runElasticityModel(base64Image, layer1Features) {
  if (!elasticitySession) return null;

  const imageTensor = await prepareImageTensor(base64Image, 224);
  if (!imageTensor) return null;

  // Build handcrafted features tensor (14-dim)
  const handcrafted = layer1Features && layer1Features.elasticity_handcrafted
    ? layer1Features.elasticity_handcrafted
    : new Float32Array(14);

  const featureTensor = new ort.Tensor('float32', handcrafted, [1, 14]);
  const results = await elasticitySession.run({
    image: imageTensor,
    handcrafted_features: featureTensor,
  });

  const outputKey = results.elasticity_score ? 'elasticity_score' : Object.keys(results)[0];
  const score = results[outputKey].data[0];
  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Run YOLOv8 lesion detector.
 * Returns array of detected lesions with bounding boxes.
 */
async function runLesionDetector(base64Image) {
  if (!lesionSession) return [];

  const tensor = await prepareImageTensor(base64Image, 640);
  if (!tensor) return [];

  const results = await lesionSession.run({ images: tensor });
  const outputKey = results.output0 ? 'output0' : Object.keys(results)[0];
  const raw = results[outputKey];

  // raw shape: [1, 10, 8400] — 4 bbox coords + 6 class scores per detection
  const data = raw.data;
  const numClasses = 6;
  const numDetections = 8400;
  const confThreshold = 0.25;
  const iouThreshold = 0.45;

  const candidateBoxes = [];
  const candidateScores = [];
  const candidateClassIds = [];

  for (let d = 0; d < numDetections; d++) {
    // Transpose: raw is [1, 10, 8400], access as [feature][detection]
    const cx = data[0 * numDetections + d];
    const cy = data[1 * numDetections + d];
    const w = data[2 * numDetections + d];
    const h = data[3 * numDetections + d];

    // Find best class
    let maxScore = 0;
    let maxClass = 0;
    for (let c = 0; c < numClasses; c++) {
      const score = data[(4 + c) * numDetections + d];
      if (score > maxScore) {
        maxScore = score;
        maxClass = c;
      }
    }

    if (maxScore < confThreshold) continue;

    // Convert center format to [x, y, w, h] normalized
    const bx = (cx - w / 2) / 640;
    const by = (cy - h / 2) / 640;
    const bw = w / 640;
    const bh = h / 640;

    candidateBoxes.push([bx, by, bw, bh]);
    candidateScores.push(maxScore);
    candidateClassIds.push(maxClass);
  }

  if (candidateBoxes.length === 0) return [];

  // Apply NMS
  const keptIndices = nms(candidateBoxes, candidateScores, iouThreshold);

  // Map to DetectedLesion objects, limit to top 20
  const lesions = keptIndices.slice(0, 20).map((i) => {
    const [bx, by, bw, bh] = candidateBoxes[i];
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    return {
      class: LESION_CLASSES[candidateClassIds[i]],
      confidence: Math.round(candidateScores[i] * 100) / 100,
      bbox: [bx, by, bw, bh],
      zone: bboxToZone(cx, cy),
    };
  });

  return lesions;
}

/**
 * Merge scores from all three layers.
 * Priority: Layer 2 (custom CV) > Layer 1 (deterministic) > Layer 3 (GPT-4o derived)
 *
 * @param {object} layer1Scores - Signal scores from deterministic features
 * @param {object} layer2Results - Results from custom CV models
 * @param {object} layer3Scores - Signal scores derived from GPT-4o (existing pipeline)
 * @returns {object} Merged signal scores
 */
function mergeSignalScores(layer1Scores, layer2Results, layer3Scores) {
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const overrides = layer2Results.signalOverrides;

  // Structure: Layer 2 > Layer 1 weighted average with Layer 3
  const structure = overrides.structure != null
    ? overrides.structure
    : clamp(layer1Scores.structure * 0.6 + (layer3Scores?.structure ?? layer1Scores.structure) * 0.4);

  // Hydration: Layer 2 > Layer 1 weighted average with Layer 3
  const hydration = overrides.hydration != null
    ? overrides.hydration
    : clamp(layer1Scores.hydration * 0.6 + (layer3Scores?.hydration ?? layer1Scores.hydration) * 0.4);

  // Inflammation: Deterministic-primary (Layer 1 is gold standard for a* measurement)
  const inflammation = clamp(
    layer1Scores.inflammation * 0.7 + (layer3Scores?.inflammation ?? layer1Scores.inflammation) * 0.3
  );

  // Sun damage: Deterministic-primary (ITA is gold standard)
  const sunDamage = clamp(
    layer1Scores.sunDamage * 0.7 + (layer3Scores?.sunDamage ?? layer1Scores.sunDamage) * 0.3
  );

  // Elasticity: Layer 2 > Layer 1 weighted average with Layer 3
  const elasticity = overrides.elasticity != null
    ? overrides.elasticity
    : clamp(layer1Scores.elasticity * 0.6 + (layer3Scores?.elasticity ?? layer1Scores.elasticity) * 0.4);

  return { structure, hydration, inflammation, sunDamage, elasticity };
}

module.exports = {
  initModels,
  runAllModels,
  runLesionDetector,
  mergeSignalScores,
  bboxToZone,
  LESION_CLASSES,
  // Exported for testing
  prepareImageTensor,
  computeIoU,
  nms,
};
