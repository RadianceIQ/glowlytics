// Simulates biophotonic scanner readings
export interface ScannerReading {
  inflammation_index: number;
  pigmentation_index: number;
  texture_index: number;
}

/**
 * Mulberry32 -- a simple 32-bit seeded PRNG.
 *
 * Returns a function that produces the next pseudo-random float in [0, 1)
 * each time it is called. The sequence is fully deterministic for a given
 * seed, which makes scanner readings reproducible in tests.
 *
 * Reference: https://gist.github.com/tommyettinger/46a874533244883189143505d203312c
 */
const mulberry32 = (seed: number): (() => number) => {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Returns a random float between min and max, rounded to 2 decimal places.
 * Uses the provided `rand` function (seeded or Math.random).
 */
const randomBetween = (min: number, max: number, rand: () => number = Math.random) =>
  Math.round((rand() * (max - min) + min) * 100) / 100;

export const simulateScannerDiscovery = (): Promise<string[]> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(['BioScan-4821', 'BioScan-7103', 'BioScan-2956']);
    }, 2000);
  });
};

export const simulateConnection = (deviceName: string): Promise<boolean> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 1500);
  });
};

/**
 * Simulate a biophotonic scanner reading.
 *
 * @param baselineValues - If provided, daily readings vary slightly from this baseline.
 *                         If omitted, generates a fresh baseline reading.
 * @param seed           - Optional numeric seed for the PRNG. When provided, the
 *                         returned reading is fully deterministic (same seed + same
 *                         baseline = same output every time). When omitted, falls
 *                         back to Math.random() for non-deterministic behavior.
 */
export const simulateScanReading = (baselineValues?: ScannerReading, seed?: number): Promise<ScannerReading> => {
  const rand = seed != null ? mulberry32(seed) : Math.random;

  return new Promise((resolve) => {
    setTimeout(() => {
      if (baselineValues) {
        // Daily scan: small variation from baseline
        resolve({
          inflammation_index: Math.max(0, Math.min(100,
            baselineValues.inflammation_index + randomBetween(-8, 8, rand))),
          pigmentation_index: Math.max(0, Math.min(100,
            baselineValues.pigmentation_index + randomBetween(-5, 5, rand))),
          texture_index: Math.max(0, Math.min(100,
            baselineValues.texture_index + randomBetween(-6, 6, rand))),
        });
      } else {
        // Baseline scan: random initial values
        resolve({
          inflammation_index: randomBetween(20, 65, rand),
          pigmentation_index: randomBetween(15, 55, rand),
          texture_index: randomBetween(25, 60, rand),
        });
      }
    }, 2500);
  });
};

export const simulatePhotoQualityCheck = (): Promise<{
  centered: boolean;
  lighting: boolean;
  blur: boolean;
  angle: boolean;
  score: number;
}> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      const pass = Math.random() > 0.15; // 85% pass rate
      resolve({
        centered: pass || Math.random() > 0.3,
        lighting: pass || Math.random() > 0.3,
        blur: pass || Math.random() > 0.3,
        angle: pass || Math.random() > 0.3,
        score: pass ? randomBetween(0.8, 1.0) : randomBetween(0.4, 0.7),
      });
    }, 800);
  });
};
