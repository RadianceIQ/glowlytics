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
  // Two-tier confidence: 0.15 for display (dimmed), 0.30 for scoring impact
  const confThresholdDisplay = 0.15;
  const confThresholdScoring = 0.30;
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

    if (maxScore < confThresholdDisplay) continue;

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

  // Per-class NMS: run NMS within each class, then merge
  // This prevents different lesion types at the same location from suppressing each other
  const candidatesByClass = {};
  for (let i = 0; i < candidateBoxes.length; i++) {
    const cls = candidateClassIds[i];
    if (!candidatesByClass[cls]) candidatesByClass[cls] = { boxes: [], scores: [], indices: [] };
    candidatesByClass[cls].boxes.push(candidateBoxes[i]);
    candidatesByClass[cls].scores.push(candidateScores[i]);
    candidatesByClass[cls].indices.push(i);
  }

  const allKeptIndices = [];
  for (const cls of Object.keys(candidatesByClass)) {
    const { boxes, scores, indices } = candidatesByClass[cls];
    const keptLocal = nms(boxes, scores, iouThreshold);
    allKeptIndices.push(...keptLocal.map((localIdx) => indices[localIdx]));
  }

  // Sort by confidence descending, limit to top 20
  allKeptIndices.sort((a, b) => candidateScores[b] - candidateScores[a]);

  const lesions = allKeptIndices.slice(0, 20).map((i) => {
    const [bx, by, bw, bh] = candidateBoxes[i];
    const cx = bx + bw / 2;
    const cy = by + bh / 2;
    return {
      class: LESION_CLASSES[candidateClassIds[i]],
      confidence: Math.round(candidateScores[i] * 100) / 100,
      bbox: [bx, by, bw, bh],
      zone: bboxToZone(cx, cy),
      // Two-tier: high confidence lesions get scoring impact
      tier: candidateScores[i] >= confThresholdScoring ? 'confirmed' : 'possible',
    };
  });

  return lesions;
}

/**
 * Reliability coefficients for uncertainty-weighted score fusion.
 *
 * Per-layer, per-signal beta values (0-1) reflecting each layer's
 * expected reliability for that signal. Inspired by Dempster-Shafer
 * discounting: lower beta = less influence on final score.
 *
 * Layer 1 (deterministic): strong for inflammation (a*) and sunDamage (ITA),
 *   moderate for structure/hydration/elasticity (texture proxies).
 * Layer 2 (ONNX models): highest reliability when loaded, 0 otherwise.
 * Layer 3 (GPT-4o): moderate — excellent semantic understanding but
 *   coarse numerical precision from a vision-language model.
 */
const BETA_L1 = {
  structure: 0.5,
  hydration: 0.5,
  inflammation: 0.8,
  sunDamage: 0.8,
  elasticity: 0.5,
};

const BETA_L2_LOADED = {
  structure: 0.9,
  hydration: 0.9,
  inflammation: 0.0, // no Layer 2 model for inflammation
  sunDamage: 0.0,    // no Layer 2 model for sun damage
  elasticity: 0.9,
};

const BETA_L3 = {
  structure: 0.6,
  hydration: 0.6,
  inflammation: 0.6,
  sunDamage: 0.6,
  elasticity: 0.6,
};

/**
 * Merge scores from all three layers using uncertainty-weighted fusion.
 *
 * merged_signal = (beta_L1 * L1 + beta_L2 * L2 + beta_L3 * L3) / (beta_L1 + beta_L2 + beta_L3)
 *
 * When Layer 2 is unavailable (beta=0), formula naturally falls back to L1+L3 blend.
 * When all 3 are present, Layer 2 dominates (beta=0.9) but L1 and L3 still contribute corrections.
 *
 * @param {object} layer1Scores - Signal scores from deterministic features
 * @param {object} layer2Results - Results from custom CV models
 * @param {object} layer3Scores - Signal scores from GPT-4o (now direct, not derived)
 * @returns {object} Merged signal scores
 */
function mergeSignalScores(layer1Scores, layer2Results, layer3Scores) {
  const clamp = (v) => Math.max(0, Math.min(100, Math.round(v)));
  const overrides = layer2Results.signalOverrides;
  const signals = ['structure', 'hydration', 'inflammation', 'sunDamage', 'elasticity'];
  const merged = {};

  for (const signal of signals) {
    const l1 = layer1Scores[signal] ?? 50;
    const l2 = overrides[signal];
    const l3 = layer3Scores?.[signal] ?? l1;

    const betaL1 = BETA_L1[signal];
    const betaL2 = l2 != null ? BETA_L2_LOADED[signal] : 0;
    const betaL3 = BETA_L3[signal];

    const totalBeta = betaL1 + betaL2 + betaL3;
    if (totalBeta === 0) {
      merged[signal] = clamp(l1);
      continue;
    }

    const weightedSum = betaL1 * l1 + betaL2 * (l2 ?? 0) + betaL3 * l3;
    merged[signal] = clamp(weightedSum / totalBeta);
  }

  return merged;
}

/**
 * Apply lesion detection feedback to signal scores.
 * Detected lesions create score penalties for relevant signals,
 * closing the loop between visual detection and quantitative scoring.
 *
 * Only "confirmed" tier lesions (confidence >= 0.30) affect scores.
 * Penalties are capped to prevent lesion count from dominating signals.
 *
 * @param {object} signalScores - Merged signal scores
 * @param {Array} lesions - Detected lesions from Layer 2
 * @returns {object} Adjusted signal scores
 */
function applyLesionFeedback(signalScores, lesions) {
  if (!lesions || lesions.length === 0) return { ...signalScores };

  let inflammationPenalty = 0;
  let structurePenalty = 0;
  let sunDamagePenalty = 0;

  for (const lesion of lesions) {
    // Only confirmed-tier lesions affect scores (require explicit confirmation)
    if (lesion.tier !== 'confirmed') continue;
    const conf = lesion.confidence;

    switch (lesion.class) {
      case 'papule':
      case 'pustule':
        inflammationPenalty += conf * 4;
        structurePenalty += conf * 1.5;
        break;
      case 'nodule':
        inflammationPenalty += conf * 8;
        structurePenalty += conf * 3;
        break;
      case 'comedone':
        structurePenalty += conf * 3;
        break;
      case 'macule':
      case 'patch':
        sunDamagePenalty += conf * 3;
        structurePenalty += conf * 1;
        break;
    }
  }

  return {
    structure: Math.max(0, Math.round(signalScores.structure - Math.min(25, structurePenalty))),
    hydration: signalScores.hydration,
    inflammation: Math.max(0, Math.round(signalScores.inflammation - Math.min(25, inflammationPenalty))),
    sunDamage: Math.max(0, Math.round(signalScores.sunDamage - Math.min(15, sunDamagePenalty))),
    elasticity: signalScores.elasticity,
  };
}

module.exports = {
  initModels,
  runAllModels,
  runLesionDetector,
  mergeSignalScores,
  applyLesionFeedback,
  bboxToZone,
  LESION_CLASSES,
  // Exported for testing
  prepareImageTensor,
  computeIoU,
  nms,
};
