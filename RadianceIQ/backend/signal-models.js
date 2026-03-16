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

/**
 * Run the structure model (MobileNetV3).
 * Returns score 0-100 or null if model unavailable.
 */
async function runStructureModel(base64Image, layer1Features) {
  if (!structureSession) return null;

  // Placeholder: actual ONNX inference would go here
  // For now, return null to use Layer 1 features
  return null;
}

/**
 * Run the hydration model (EfficientNet-B0).
 */
async function runHydrationModel(base64Image, layer1Features) {
  if (!hydrationSession) return null;
  return null;
}

/**
 * Run the elasticity model (EfficientNet-B0).
 */
async function runElasticityModel(base64Image, layer1Features) {
  if (!elasticitySession) return null;
  return null;
}

/**
 * Run YOLOv8 lesion detector.
 * Returns array of detected lesions with bounding boxes.
 */
async function runLesionDetector(base64Image) {
  if (!lesionSession) return [];

  // Placeholder: actual ONNX inference would go here
  // Returns empty array until model is trained
  return [];
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
  mergeSignalScores,
  bboxToZone,
  LESION_CLASSES,
};
