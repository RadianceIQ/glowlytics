import {
  simulateScannerDiscovery,
  simulateConnection,
  simulateScanReading,
  simulatePhotoQualityCheck,
} from '../mockScanner';

describe('simulateScannerDiscovery', () => {
  it('returns an array of device names', async () => {
    const devices = await simulateScannerDiscovery();
    expect(Array.isArray(devices)).toBe(true);
    expect(devices.length).toBeGreaterThan(0);
    devices.forEach((name) => {
      expect(typeof name).toBe('string');
      expect(name).toMatch(/^BioScan-/);
    });
  });
});

describe('simulateConnection', () => {
  it('resolves to true', async () => {
    const result = await simulateConnection('BioScan-4821');
    expect(result).toBe(true);
  });
});

describe('simulateScanReading', () => {
  it('returns valid index values without baseline', async () => {
    const reading = await simulateScanReading();
    expect(reading.inflammation_index).toBeGreaterThanOrEqual(0);
    expect(reading.inflammation_index).toBeLessThanOrEqual(100);
    expect(reading.pigmentation_index).toBeGreaterThanOrEqual(0);
    expect(reading.pigmentation_index).toBeLessThanOrEqual(100);
    expect(reading.texture_index).toBeGreaterThanOrEqual(0);
    expect(reading.texture_index).toBeLessThanOrEqual(100);
  });

  it('returns values within baseline variance range', async () => {
    const baseline = {
      inflammation_index: 50,
      pigmentation_index: 40,
      texture_index: 45,
    };
    const reading = await simulateScanReading(baseline);
    expect(reading.inflammation_index).toBeGreaterThanOrEqual(0);
    expect(reading.inflammation_index).toBeLessThanOrEqual(100);
    expect(reading.pigmentation_index).toBeGreaterThanOrEqual(0);
    expect(reading.pigmentation_index).toBeLessThanOrEqual(100);
    expect(reading.texture_index).toBeGreaterThanOrEqual(0);
    expect(reading.texture_index).toBeLessThanOrEqual(100);
  });

  it('daily readings cluster around baseline', async () => {
    const baseline = {
      inflammation_index: 50,
      pigmentation_index: 40,
      texture_index: 45,
    };
    const readings = await Promise.all(
      Array.from({ length: 20 }, () => simulateScanReading(baseline))
    );
    const avgInflammation =
      readings.reduce((s, r) => s + r.inflammation_index, 0) / readings.length;
    expect(Math.abs(avgInflammation - baseline.inflammation_index)).toBeLessThan(12);
  });

  // ──────────── Seeded determinism ────────────

  it('produces identical results with same seed', async () => {
    const baseline = { inflammation_index: 50, pigmentation_index: 40, texture_index: 45 };
    const r1 = await simulateScanReading(baseline, 42);
    const r2 = await simulateScanReading(baseline, 42);
    expect(r1.inflammation_index).toBe(r2.inflammation_index);
    expect(r1.pigmentation_index).toBe(r2.pigmentation_index);
    expect(r1.texture_index).toBe(r2.texture_index);
  }, 10000);

  it('produces different results with different seeds', async () => {
    const baseline = { inflammation_index: 50, pigmentation_index: 40, texture_index: 45 };
    const r1 = await simulateScanReading(baseline, 1);
    const r2 = await simulateScanReading(baseline, 999);
    // At least one index should differ
    const allEqual =
      r1.inflammation_index === r2.inflammation_index &&
      r1.pigmentation_index === r2.pigmentation_index &&
      r1.texture_index === r2.texture_index;
    expect(allEqual).toBe(false);
  }, 10000);

  it('produces deterministic baseline readings with seed', async () => {
    const r1 = await simulateScanReading(undefined, 123);
    const r2 = await simulateScanReading(undefined, 123);
    expect(r1.inflammation_index).toBe(r2.inflammation_index);
    expect(r1.pigmentation_index).toBe(r2.pigmentation_index);
    expect(r1.texture_index).toBe(r2.texture_index);
  }, 10000);
});

describe('simulatePhotoQualityCheck', () => {
  it('returns quality check result with expected fields', async () => {
    const result = await simulatePhotoQualityCheck();
    expect(typeof result.centered).toBe('boolean');
    expect(typeof result.lighting).toBe('boolean');
    expect(typeof result.blur).toBe('boolean');
    expect(typeof result.angle).toBe('boolean');
    expect(typeof result.score).toBe('number');
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(1);
  });

  it('has roughly 85% pass rate over many checks', async () => {
    const results = await Promise.all(
      Array.from({ length: 100 }, () => simulatePhotoQualityCheck())
    );
    const passCount = results.filter((r) => r.score >= 0.7).length;
    expect(passCount).toBeGreaterThan(60);
    expect(passCount).toBeLessThan(100);
  });
});
