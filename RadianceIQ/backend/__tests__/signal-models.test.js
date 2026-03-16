/**
 * Signal Processing Pipeline Tests
 *
 * Tests the 3-layer vision pipeline:
 *   Layer 1: Deterministic image processing (image-processing.js)
 *   Layer 2: Custom CV model inference (signal-models.js)
 *   Layer 3: GPT-4o fine-tuned model (existing, mocked)
 *
 * Unit tests cover the pure functions exported by image-processing.js and
 * signal-models.js. Integration tests verify the merged response shape
 * returned by POST /api/vision/analyze.
 *
 * External dependencies (openai, pg, rag, image-processing, signal-models)
 * are mocked before requiring app so no real API calls or DB connections occur.
 */

process.env.NODE_ENV = 'development';

// ---- Direct imports for unit tests (no mocking needed) ----

const {
  srgbToLab,
  computeITA,
  stats,
  computeGLCM,
  computeLBP,
  analyzeSpecular,
  featuresToSignalScores,
} = require('../image-processing');

const {
  bboxToZone,
  mergeSignalScores,
  LESION_CLASSES,
} = require('../signal-models');

// =====================================================================
// UNIT TESTS: image-processing.js
// =====================================================================

describe('image-processing.js', () => {
  // ---- srgbToLab ----

  describe('srgbToLab', () => {
    test('pure white (255,255,255) maps to L~100, a~0, b~0', () => {
      const { L, a, b } = srgbToLab(255, 255, 255);
      expect(L).toBeCloseTo(100, 0);
      expect(a).toBeCloseTo(0, 0);
      expect(b).toBeCloseTo(0, 0);
    });

    test('pure black (0,0,0) maps to L~0, a~0, b~0', () => {
      const { L, a, b } = srgbToLab(0, 0, 0);
      expect(L).toBeCloseTo(0, 0);
      expect(a).toBeCloseTo(0, 0);
      expect(b).toBeCloseTo(0, 0);
    });

    test('pure red (255,0,0) has positive a* (green-red axis)', () => {
      const { L, a, b } = srgbToLab(255, 0, 0);
      expect(a).toBeGreaterThan(0);
      // Red in CIELAB has L roughly around 53
      expect(L).toBeGreaterThan(40);
      expect(L).toBeLessThan(65);
    });

    test('pure green (0,255,0) has negative a* (green-red axis)', () => {
      const { a } = srgbToLab(0, 255, 0);
      expect(a).toBeLessThan(0);
    });

    test('pure blue (0,0,255) has negative b* (blue-yellow axis)', () => {
      const { b } = srgbToLab(0, 0, 255);
      expect(b).toBeLessThan(0);
    });

    test('pure yellow (255,255,0) has positive b* (blue-yellow axis)', () => {
      const { b } = srgbToLab(255, 255, 0);
      expect(b).toBeGreaterThan(0);
    });

    test('mid gray (128,128,128) has L close to 54, a~0, b~0', () => {
      const { L, a, b } = srgbToLab(128, 128, 128);
      // Mid gray in CIELAB has L around 53-54
      expect(L).toBeGreaterThan(50);
      expect(L).toBeLessThan(57);
      expect(Math.abs(a)).toBeLessThan(1);
      expect(Math.abs(b)).toBeLessThan(1);
    });
  });

  // ---- computeITA ----

  describe('computeITA', () => {
    test('ITA = arctan((L - 50) / b) * 180/pi for known values', () => {
      // L=70, b=20 => ITA = arctan(20/20) * 180/pi = 45 degrees
      const ita = computeITA(70, 20);
      expect(ita).toBeCloseTo(45, 1);
    });

    test('L=50, b=10 => ITA = arctan(0/10) = 0 degrees', () => {
      const ita = computeITA(50, 10);
      expect(ita).toBeCloseTo(0, 1);
    });

    test('b near zero returns 0 (guarded)', () => {
      const ita = computeITA(70, 0.0001);
      expect(ita).toBe(0);
    });

    test('high L, low b produces large positive ITA (light skin)', () => {
      const ita = computeITA(90, 5);
      // arctan(40/5) = arctan(8) ~ 83 degrees
      expect(ita).toBeGreaterThan(80);
    });

    test('low L, high b produces negative or small ITA (dark skin)', () => {
      const ita = computeITA(30, 25);
      // arctan(-20/25) = arctan(-0.8) ~ -38.7 degrees
      expect(ita).toBeLessThan(0);
    });
  });

  // ---- stats ----

  describe('stats', () => {
    test('empty array returns mean=0, std=0', () => {
      const result = stats([]);
      expect(result.mean).toBe(0);
      expect(result.std).toBe(0);
    });

    test('single element array has std=0', () => {
      const result = stats([42]);
      expect(result.mean).toBe(42);
      expect(result.std).toBe(0);
    });

    test('known array [2,4,4,4,5,5,7,9] has mean=5, std=2', () => {
      const result = stats([2, 4, 4, 4, 5, 5, 7, 9]);
      expect(result.mean).toBe(5);
      expect(result.std).toBe(2);
    });

    test('all identical values have std=0', () => {
      const result = stats([7, 7, 7, 7, 7]);
      expect(result.mean).toBe(7);
      expect(result.std).toBe(0);
    });

    test('[0, 10] has mean=5 and std=5', () => {
      const result = stats([0, 10]);
      expect(result.mean).toBe(5);
      expect(result.std).toBe(5);
    });
  });

  // ---- computeGLCM ----

  describe('computeGLCM', () => {
    test('constant gray image has zero contrast and zero dissimilarity', () => {
      // 4x4 image where all pixels are the same gray level
      const width = 4;
      const height = 4;
      const pixels = new Float32Array(width * height).fill(128);

      const { contrast, dissimilarity, homogeneity, energy } = computeGLCM(pixels, width, height);

      expect(contrast).toBe(0);
      expect(dissimilarity).toBe(0);
      // All co-occurrences on diagonal => homogeneity should be 1
      expect(homogeneity).toBeCloseTo(1, 5);
      // For a constant image quantized to 16 levels, all mass is on one cell
      expect(energy).toBeGreaterThan(0);
    });

    test('alternating pixel image has non-zero contrast', () => {
      // Checkerboard: alternating 0 and 255 values
      const width = 4;
      const height = 4;
      const pixels = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          pixels[y * width + x] = (x + y) % 2 === 0 ? 0 : 255;
        }
      }

      const { contrast, dissimilarity } = computeGLCM(pixels, width, height);

      expect(contrast).toBeGreaterThan(0);
      expect(dissimilarity).toBeGreaterThan(0);
    });

    test('GLCM returns all four named properties', () => {
      const width = 3;
      const height = 3;
      const pixels = new Float32Array([10, 20, 30, 40, 50, 60, 70, 80, 90]);

      const result = computeGLCM(pixels, width, height);

      expect(result).toHaveProperty('contrast');
      expect(result).toHaveProperty('dissimilarity');
      expect(result).toHaveProperty('homogeneity');
      expect(result).toHaveProperty('energy');
    });
  });

  // ---- computeLBP ----

  describe('computeLBP', () => {
    test('constant image produces low entropy (all neighbors equal center)', () => {
      // 5x5 constant image — inner 3x3 region is processed
      const width = 5;
      const height = 5;
      const pixels = new Float32Array(width * height).fill(100);

      const { entropy, uniformity } = computeLBP(pixels, width, height);

      // All neighbors >= center => pattern=0xFF for every pixel => entropy = 0 (single bin)
      expect(entropy).toBeCloseTo(0, 5);
      // All probability mass in one bin => uniformity = 1
      expect(uniformity).toBeCloseTo(1, 5);
    });

    test('varied image produces higher entropy than constant image', () => {
      const width = 6;
      const height = 6;
      // Gradient image
      const pixels = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          pixels[y * width + x] = (x * 40 + y * 30) % 256;
        }
      }

      const { entropy: variedEntropy } = computeLBP(pixels, width, height);

      // Constant image baseline
      const constPixels = new Float32Array(width * height).fill(100);
      const { entropy: constEntropy } = computeLBP(constPixels, width, height);

      expect(variedEntropy).toBeGreaterThan(constEntropy);
    });

    test('LBP returns entropy and uniformity properties', () => {
      const width = 4;
      const height = 4;
      const pixels = new Float32Array(width * height).fill(50);

      const result = computeLBP(pixels, width, height);

      expect(result).toHaveProperty('entropy');
      expect(result).toHaveProperty('uniformity');
      expect(typeof result.entropy).toBe('number');
      expect(typeof result.uniformity).toBe('number');
    });
  });

  // ---- analyzeSpecular ----

  describe('analyzeSpecular', () => {
    test('all-white image has high specular ratio', () => {
      // 4x4 all white RGB image (every pixel R=G=B=255 => max-min=0, all >200)
      const width = 4;
      const height = 4;
      const pixels = new Uint8Array(width * height * 3).fill(255);

      const { ratio } = analyzeSpecular(pixels, width, height);

      // Every pixel qualifies as specular
      expect(ratio).toBeCloseTo(1.0, 5);
    });

    test('all-black image has zero specular ratio', () => {
      const width = 4;
      const height = 4;
      const pixels = new Uint8Array(width * height * 3).fill(0);

      const { ratio, uniformity } = analyzeSpecular(pixels, width, height);

      expect(ratio).toBe(0);
      expect(uniformity).toBe(0);
    });

    test('mixed image: only bright pixels count as specular', () => {
      const width = 4;
      const height = 2;
      const pixels = new Uint8Array(width * height * 3);

      // Top row: all white (specular)
      for (let x = 0; x < width; x++) {
        const idx = x * 3;
        pixels[idx] = 255;
        pixels[idx + 1] = 255;
        pixels[idx + 2] = 255;
      }
      // Bottom row: all dark (not specular)
      for (let x = 0; x < width; x++) {
        const idx = (width + x) * 3;
        pixels[idx] = 50;
        pixels[idx + 1] = 50;
        pixels[idx + 2] = 50;
      }

      const { ratio } = analyzeSpecular(pixels, width, height);

      // Half the pixels are specular
      expect(ratio).toBeCloseTo(0.5, 5);
    });

    test('high-saturation bright pixel is not specular (max-min >= 30)', () => {
      const width = 1;
      const height = 1;
      // R=255, G=210, B=210 => max-min=45 > 30, so NOT specular
      const pixels = new Uint8Array([255, 210, 210]);

      const { ratio } = analyzeSpecular(pixels, width, height);

      expect(ratio).toBe(0);
    });
  });

  // ---- featuresToSignalScores ----

  describe('featuresToSignalScores', () => {
    const baseFeatures = {
      inflammation: { a_star_mean: 5, a_star_std: 3, r_ratio_mean: 0.35 },
      sunDamage: { ita_mean: 30, ita_std: 8, ita_cv: 0.2, spot_count: 3 },
      hydration: { specular_ratio: 0.03, specular_uniformity: 0.3, lbp_entropy: 5, lbp_uniformity: 0.06 },
      structure: { glcm_contrast: 2, glcm_dissimilarity: 1, glcm_homogeneity: 0.6, glcm_energy: 0.1, pore_proxy: 2 },
      elasticity: { wrinkle_index: 8, forehead_glcm: { contrast: 1.5, dissimilarity: 0.8, homogeneity: 0.5, energy: 0.1 } },
    };

    test('returns all 5 signal keys', () => {
      const scores = featuresToSignalScores(baseFeatures);

      expect(scores).toHaveProperty('structure');
      expect(scores).toHaveProperty('hydration');
      expect(scores).toHaveProperty('inflammation');
      expect(scores).toHaveProperty('sunDamage');
      expect(scores).toHaveProperty('elasticity');
    });

    test('all scores are integers in [0, 100]', () => {
      const scores = featuresToSignalScores(baseFeatures);

      for (const key of ['structure', 'hydration', 'inflammation', 'sunDamage', 'elasticity']) {
        expect(Number.isInteger(scores[key])).toBe(true);
        expect(scores[key]).toBeGreaterThanOrEqual(0);
        expect(scores[key]).toBeLessThanOrEqual(100);
      }
    });

    test('high a_star_mean (erythema) produces lower inflammation score', () => {
      const inflamed = {
        ...baseFeatures,
        inflammation: { a_star_mean: 20, a_star_std: 5, r_ratio_mean: 0.42 },
      };
      const healthy = {
        ...baseFeatures,
        inflammation: { a_star_mean: -2, a_star_std: 1, r_ratio_mean: 0.32 },
      };

      const inflamedScores = featuresToSignalScores(inflamed);
      const healthyScores = featuresToSignalScores(healthy);

      // Higher a* = more erythema = worse inflammation score (lower health)
      expect(inflamedScores.inflammation).toBeLessThan(healthyScores.inflammation);
    });

    test('high ita_cv and spot_count produce lower sunDamage score', () => {
      const damaged = {
        ...baseFeatures,
        sunDamage: { ita_mean: 30, ita_std: 15, ita_cv: 0.5, spot_count: 20 },
      };
      const clear = {
        ...baseFeatures,
        sunDamage: { ita_mean: 30, ita_std: 2, ita_cv: 0.05, spot_count: 0 },
      };

      const damagedScores = featuresToSignalScores(damaged);
      const clearScores = featuresToSignalScores(clear);

      expect(damagedScores.sunDamage).toBeLessThan(clearScores.sunDamage);
    });

    test('high wrinkle_index produces lower elasticity score', () => {
      const wrinkled = {
        ...baseFeatures,
        elasticity: { wrinkle_index: 28, forehead_glcm: { contrast: 6, dissimilarity: 3, homogeneity: 0.3, energy: 0.05 } },
      };
      const smooth = {
        ...baseFeatures,
        elasticity: { wrinkle_index: 2, forehead_glcm: { contrast: 0.5, dissimilarity: 0.3, homogeneity: 0.8, energy: 0.3 } },
      };

      const wrinkledScores = featuresToSignalScores(wrinkled);
      const smoothScores = featuresToSignalScores(smooth);

      expect(wrinkledScores.elasticity).toBeLessThan(smoothScores.elasticity);
    });
  });
});

// =====================================================================
// UNIT TESTS: signal-models.js
// =====================================================================

describe('signal-models.js', () => {
  // ---- bboxToZone ----

  describe('bboxToZone', () => {
    test('(0.5, 0.1) maps to forehead (top center)', () => {
      expect(bboxToZone(0.5, 0.1)).toBe('forehead');
    });

    test('(0.2, 0.5) maps to left_cheek', () => {
      expect(bboxToZone(0.2, 0.5)).toBe('left_cheek');
    });

    test('(0.8, 0.5) maps to right_cheek', () => {
      expect(bboxToZone(0.8, 0.5)).toBe('right_cheek');
    });

    test('(0.5, 0.7) maps to chin', () => {
      expect(bboxToZone(0.5, 0.7)).toBe('chin');
    });

    test('(0.5, 0.35) maps to nose (mid center between cheek boundaries)', () => {
      expect(bboxToZone(0.5, 0.35)).toBe('nose');
    });

    test('(0.5, 0.9) maps to jaw (bottom of face)', () => {
      expect(bboxToZone(0.5, 0.9)).toBe('jaw');
    });

    test('(0.1, 0.3) maps to left_cheek (left, mid-upper)', () => {
      expect(bboxToZone(0.1, 0.3)).toBe('left_cheek');
    });

    test('(0.9, 0.3) maps to right_cheek (right, mid-upper)', () => {
      expect(bboxToZone(0.9, 0.3)).toBe('right_cheek');
    });
  });

  // ---- LESION_CLASSES ----

  describe('LESION_CLASSES', () => {
    test('is an array', () => {
      expect(Array.isArray(LESION_CLASSES)).toBe(true);
    });

    test('contains expected dermatological lesion classes', () => {
      expect(LESION_CLASSES).toContain('comedone');
      expect(LESION_CLASSES).toContain('papule');
      expect(LESION_CLASSES).toContain('pustule');
      expect(LESION_CLASSES).toContain('nodule');
      expect(LESION_CLASSES).toContain('macule');
      expect(LESION_CLASSES).toContain('patch');
    });

    test('has exactly 6 classes', () => {
      expect(LESION_CLASSES).toHaveLength(6);
    });
  });

  // ---- mergeSignalScores ----

  describe('mergeSignalScores', () => {
    const layer1Scores = {
      structure: 70,
      hydration: 65,
      inflammation: 80,
      sunDamage: 75,
      elasticity: 60,
    };

    const layer2NoOverrides = {
      signalOverrides: { structure: null, hydration: null, elasticity: null },
      lesions: [],
      signalConfidence: {
        structure: 'med', hydration: 'med', inflammation: 'med',
        sunDamage: 'med', elasticity: 'med',
      },
    };

    const layer3Scores = {
      structure: 50,
      hydration: 55,
      inflammation: 60,
      sunDamage: 65,
      elasticity: 40,
    };

    test('Layer 2 overrides take precedence over weighted merge', () => {
      const layer2WithOverrides = {
        signalOverrides: { structure: 85, hydration: null, elasticity: 92 },
        lesions: [],
        signalConfidence: {
          structure: 'high', hydration: 'med', inflammation: 'med',
          sunDamage: 'med', elasticity: 'high',
        },
      };

      const merged = mergeSignalScores(layer1Scores, layer2WithOverrides, layer3Scores);

      // Structure and elasticity come directly from Layer 2 overrides
      expect(merged.structure).toBe(85);
      expect(merged.elasticity).toBe(92);
      // Hydration has no override, so it should be a weighted merge
      expect(merged.hydration).not.toBe(85);
      expect(merged.hydration).not.toBe(92);
    });

    test('without overrides, uses weighted merge of Layer 1 and Layer 3', () => {
      const merged = mergeSignalScores(layer1Scores, layer2NoOverrides, layer3Scores);

      // Structure: L1*0.6 + L3*0.4 = 70*0.6 + 50*0.4 = 42+20 = 62
      expect(merged.structure).toBe(62);
      // Hydration: L1*0.6 + L3*0.4 = 65*0.6 + 55*0.4 = 39+22 = 61
      expect(merged.hydration).toBe(61);
      // Inflammation: L1*0.7 + L3*0.3 = 80*0.7 + 60*0.3 = 56+18 = 74
      expect(merged.inflammation).toBe(74);
      // SunDamage: L1*0.7 + L3*0.3 = 75*0.7 + 65*0.3 = 52.5+19.5 = 72
      expect(merged.sunDamage).toBe(72);
      // Elasticity: L1*0.6 + L3*0.4 = 60*0.6 + 40*0.4 = 36+16 = 52
      expect(merged.elasticity).toBe(52);
    });

    test('all merged scores are clamped to 0-100 integers', () => {
      const merged = mergeSignalScores(layer1Scores, layer2NoOverrides, layer3Scores);

      for (const key of ['structure', 'hydration', 'inflammation', 'sunDamage', 'elasticity']) {
        expect(Number.isInteger(merged[key])).toBe(true);
        expect(merged[key]).toBeGreaterThanOrEqual(0);
        expect(merged[key]).toBeLessThanOrEqual(100);
      }
    });

    test('null Layer 3 scores fall back to Layer 1 values', () => {
      const merged = mergeSignalScores(layer1Scores, layer2NoOverrides, null);

      // When Layer 3 is null, Layer 1 scores are used for both weights
      // Structure: L1*0.6 + L1*0.4 = L1 = 70
      expect(merged.structure).toBe(70);
      expect(merged.hydration).toBe(65);
      expect(merged.inflammation).toBe(80);
      expect(merged.sunDamage).toBe(75);
      expect(merged.elasticity).toBe(60);
    });

    test('returns all 5 signal keys', () => {
      const merged = mergeSignalScores(layer1Scores, layer2NoOverrides, layer3Scores);

      expect(merged).toHaveProperty('structure');
      expect(merged).toHaveProperty('hydration');
      expect(merged).toHaveProperty('inflammation');
      expect(merged).toHaveProperty('sunDamage');
      expect(merged).toHaveProperty('elasticity');
      expect(Object.keys(merged)).toHaveLength(5);
    });
  });
});

// =====================================================================
// INTEGRATION TESTS: POST /api/vision/analyze (signal fields in response)
// =====================================================================

describe('POST /api/vision/analyze (signal pipeline integration)', () => {
  // ---- Module mocks for integration tests (must be before require) ----

  const mockCreate = jest.fn();

  jest.mock('openai', () => {
    return jest.fn().mockImplementation(() => ({
      chat: { completions: { create: mockCreate } },
    }));
  });

  jest.mock('pg', () => {
    const mockPool = { query: jest.fn() };
    return { Pool: jest.fn(() => mockPool) };
  });

  jest.mock('../rag', () => ({
    seedGuidelines: jest.fn(),
    queryGuidelines: jest.fn().mockResolvedValue([]),
  }));

  // Mock image-processing to return deterministic features
  const mockExtractFeatures = jest.fn();
  const mockFeaturesToSignalScores = jest.fn();
  const mockExtractSummaryFeatures = jest.fn();

  jest.mock('../image-processing', () => ({
    extractFeatures: mockExtractFeatures,
    featuresToSignalScores: mockFeaturesToSignalScores,
    extractSummaryFeatures: mockExtractSummaryFeatures,
    srgbToLab: jest.fn(),
    computeITA: jest.fn(),
    computeGLCM: jest.fn(),
    computeLBP: jest.fn(),
    analyzeSpecular: jest.fn(),
    countSpots: jest.fn(),
    stats: jest.fn(),
  }));

  // Mock signal-models to return deterministic results
  const mockRunAllModels = jest.fn();
  const mockMergeSignalScores = jest.fn();

  jest.mock('../signal-models', () => ({
    initModels: jest.fn().mockResolvedValue({ loaded: [] }),
    runAllModels: mockRunAllModels,
    mergeSignalScores: mockMergeSignalScores,
    bboxToZone: jest.fn(),
    LESION_CLASSES: ['comedone', 'papule', 'pustule', 'nodule', 'macule', 'patch'],
  }));

  const request = require('supertest');
  const app = require('../app');

  const VALID_BODY = {
    image_base64: 'dGVzdGltYWdlZGF0YQ==',
    context: {
      primary_goal: 'acne tracking',
      scan_region: 'full face',
      sunscreen_used: true,
      sleep_quality: 'good',
      stress_level: 'low',
      scan_count: 5,
    },
  };

  const MOCK_FEATURES = {
    inflammation: { a_star_mean: 5, a_star_std: 3, r_ratio_mean: 0.35 },
    sunDamage: { ita_mean: 30, ita_std: 8, ita_cv: 0.2, spot_count: 3 },
    hydration: { specular_ratio: 0.03, specular_uniformity: 0.3, lbp_entropy: 5, lbp_uniformity: 0.06 },
    structure: { glcm_contrast: 2, glcm_dissimilarity: 1, glcm_homogeneity: 0.6, glcm_energy: 0.1, pore_proxy: 2 },
    elasticity: { wrinkle_index: 8, forehead_glcm: { contrast: 1.5, dissimilarity: 0.8, homogeneity: 0.5, energy: 0.1 } },
  };

  const MOCK_LAYER1_SCORES = { structure: 72, hydration: 65, inflammation: 78, sunDamage: 73, elasticity: 61 };

  const MOCK_LAYER2_RESULTS = {
    signalOverrides: { structure: null, hydration: null, elasticity: null },
    lesions: [],
    signalConfidence: {
      structure: 'med', hydration: 'med', inflammation: 'med',
      sunDamage: 'med', elasticity: 'med',
    },
  };

  const MOCK_SUMMARY_FEATURES = {
    inflammation_a_star: 5.0,
    ita_variance: 0.2,
    spot_count: 3,
    pore_density: 2.0,
    wrinkle_index: 8.0,
    specular_ratio: 0.03,
  };

  const MOCK_MERGED_SCORES = { structure: 65, hydration: 62, inflammation: 74, sunDamage: 70, elasticity: 55 };

  function mockGPTResponse(jsonObj) {
    mockCreate.mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify(jsonObj) } }],
    });
  }

  function setupLayer1And2Mocks() {
    mockExtractFeatures.mockResolvedValueOnce(MOCK_FEATURES);
    mockFeaturesToSignalScores.mockReturnValueOnce(MOCK_LAYER1_SCORES);
    mockRunAllModels.mockResolvedValueOnce(MOCK_LAYER2_RESULTS);
    mockExtractSummaryFeatures.mockReturnValueOnce(MOCK_SUMMARY_FEATURES);
    mockMergeSignalScores.mockReturnValueOnce(MOCK_MERGED_SCORES);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.PINECONE_API_KEY;
  });

  test('response includes signal_scores, signal_features, lesions, and signal_confidence', async () => {
    setupLayer1And2Mocks();
    mockGPTResponse({
      acne_score: 25,
      sun_damage_score: 10,
      skin_age_score: 40,
      confidence: 'high',
      primary_driver: 'acne',
      recommended_action: 'Continue retinoid use.',
    });

    const res = await request(app)
      .post('/api/vision/analyze')
      .send(VALID_BODY)
      .expect(200);

    // New signal fields present
    expect(res.body).toHaveProperty('signal_scores');
    expect(res.body).toHaveProperty('signal_features');
    expect(res.body).toHaveProperty('lesions');
    expect(res.body).toHaveProperty('signal_confidence');

    // Verify structure of signal_scores
    expect(res.body.signal_scores).toEqual(MOCK_MERGED_SCORES);

    // Verify signal_features
    expect(res.body.signal_features).toEqual(MOCK_SUMMARY_FEATURES);

    // Verify lesions is an array
    expect(Array.isArray(res.body.lesions)).toBe(true);

    // Verify signal_confidence
    expect(res.body.signal_confidence).toEqual(MOCK_LAYER2_RESULTS.signalConfidence);
  });

  test('backward compatibility: existing fields (acne_score, etc.) are still present', async () => {
    setupLayer1And2Mocks();
    mockGPTResponse({
      acne_score: 30,
      sun_damage_score: 15,
      skin_age_score: 20,
      confidence: 'med',
      primary_driver: 'sun_damage',
      recommended_action: 'Apply SPF daily.',
      personalized_feedback: 'Your skin looks good overall.',
    });

    const res = await request(app)
      .post('/api/vision/analyze')
      .send(VALID_BODY)
      .expect(200);

    // Original fields still present and correct
    expect(res.body.acne_score).toBe(30);
    expect(res.body.sun_damage_score).toBe(15);
    expect(res.body.skin_age_score).toBe(20);
    expect(res.body.confidence).toBe('med');
    expect(res.body.primary_driver).toBe('sun_damage');
    expect(res.body.recommended_action).toBe('Apply SPF daily.');
    expect(res.body.personalized_feedback).toBe('Your skin looks good overall.');
    expect(res.body.conditions).toEqual([]);
    expect(res.body.rag_recommendations).toEqual([]);
  });

  test('Layer 1/2 failure gracefully falls back to Layer 3 only', async () => {
    // Layer 1 fails
    mockExtractFeatures.mockRejectedValueOnce(new Error('sharp not available'));
    // mergeSignalScores should NOT be called in this path

    mockGPTResponse({
      acne_score: 40,
      sun_damage_score: 20,
      skin_age_score: 30,
      confidence: 'high',
      primary_driver: 'acne',
      recommended_action: 'See a dermatologist.',
    });

    const res = await request(app)
      .post('/api/vision/analyze')
      .send(VALID_BODY)
      .expect(200);

    // Should still return signal_scores derived from Layer 3
    expect(res.body).toHaveProperty('signal_scores');
    expect(res.body.signal_scores).toHaveProperty('structure');
    expect(res.body.signal_scores).toHaveProperty('hydration');
    expect(res.body.signal_scores).toHaveProperty('inflammation');
    expect(res.body.signal_scores).toHaveProperty('sunDamage');
    expect(res.body.signal_scores).toHaveProperty('elasticity');

    // All signal scores should be valid 0-100 integers
    for (const key of Object.keys(res.body.signal_scores)) {
      expect(res.body.signal_scores[key]).toBeGreaterThanOrEqual(0);
      expect(res.body.signal_scores[key]).toBeLessThanOrEqual(100);
    }

    // signal_features should be empty object, lesions empty array
    expect(res.body.signal_features).toEqual({});
    expect(res.body.lesions).toEqual([]);

    // signal_confidence should all be 'low' in Layer 3 only mode
    for (const key of Object.keys(res.body.signal_confidence)) {
      expect(res.body.signal_confidence[key]).toBe('low');
    }

    // mergeSignalScores was not called
    expect(mockMergeSignalScores).not.toHaveBeenCalled();
  });

  test('lesions array is passed through from Layer 2 results', async () => {
    const lesionsData = [
      { class: 'papule', confidence: 0.87, bbox: [0.3, 0.4, 0.05, 0.05], zone: 'left_cheek' },
      { class: 'comedone', confidence: 0.72, bbox: [0.5, 0.1, 0.03, 0.03], zone: 'forehead' },
    ];

    mockExtractFeatures.mockResolvedValueOnce(MOCK_FEATURES);
    mockFeaturesToSignalScores.mockReturnValueOnce(MOCK_LAYER1_SCORES);
    mockRunAllModels.mockResolvedValueOnce({
      ...MOCK_LAYER2_RESULTS,
      lesions: lesionsData,
    });
    mockExtractSummaryFeatures.mockReturnValueOnce(MOCK_SUMMARY_FEATURES);
    mockMergeSignalScores.mockReturnValueOnce(MOCK_MERGED_SCORES);

    mockGPTResponse({
      acne_score: 35,
      sun_damage_score: 10,
      skin_age_score: 20,
      confidence: 'high',
      primary_driver: 'acne',
      recommended_action: 'Spot treat breakouts.',
    });

    const res = await request(app)
      .post('/api/vision/analyze')
      .send(VALID_BODY)
      .expect(200);

    expect(res.body.lesions).toEqual(lesionsData);
    expect(res.body.lesions).toHaveLength(2);
    expect(res.body.lesions[0].class).toBe('papule');
    expect(res.body.lesions[1].zone).toBe('forehead');
  });

  test('mergeSignalScores is called with correct layer arguments', async () => {
    setupLayer1And2Mocks();
    mockGPTResponse({
      acne_score: 50,
      sun_damage_score: 30,
      skin_age_score: 25,
      confidence: 'high',
      primary_driver: 'acne',
      recommended_action: 'Use benzoyl peroxide.',
    });

    await request(app)
      .post('/api/vision/analyze')
      .send(VALID_BODY)
      .expect(200);

    // mergeSignalScores should have been called with Layer 1 scores, Layer 2 results, and Layer 3 derived scores
    expect(mockMergeSignalScores).toHaveBeenCalledTimes(1);
    const [l1, l2, l3] = mockMergeSignalScores.mock.calls[0];
    expect(l1).toEqual(MOCK_LAYER1_SCORES);
    expect(l2).toEqual(MOCK_LAYER2_RESULTS);
    // Layer 3 scores are derived from GPT-4o proxy scores
    expect(l3).toHaveProperty('structure');
    expect(l3).toHaveProperty('hydration');
    expect(l3).toHaveProperty('inflammation');
    expect(l3).toHaveProperty('sunDamage');
    expect(l3).toHaveProperty('elasticity');
  });
});
