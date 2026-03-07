// Simulates biophotonic scanner readings
export interface ScannerReading {
  inflammation_index: number;
  pigmentation_index: number;
  texture_index: number;
}

const randomBetween = (min: number, max: number) =>
  Math.round((Math.random() * (max - min) + min) * 100) / 100;

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

export const simulateScanReading = (baselineValues?: ScannerReading): Promise<ScannerReading> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      if (baselineValues) {
        // Daily scan: small variation from baseline
        resolve({
          inflammation_index: Math.max(0, Math.min(100,
            baselineValues.inflammation_index + randomBetween(-8, 8))),
          pigmentation_index: Math.max(0, Math.min(100,
            baselineValues.pigmentation_index + randomBetween(-5, 5))),
          texture_index: Math.max(0, Math.min(100,
            baselineValues.texture_index + randomBetween(-6, 6))),
        });
      } else {
        // Baseline scan: random initial values
        resolve({
          inflammation_index: randomBetween(20, 65),
          pigmentation_index: randomBetween(15, 55),
          texture_index: randomBetween(25, 60),
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
