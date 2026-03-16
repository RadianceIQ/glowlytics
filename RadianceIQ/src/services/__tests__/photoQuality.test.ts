import { checkPhotoQuality, PhotoQualityResult } from '../photoQuality';

// ── Mock expo-face-detector ──────────────────────────────────────────

const mockDetectFacesAsync = jest.fn();

jest.mock('expo-face-detector', () => ({
  detectFacesAsync: (...args: unknown[]) => mockDetectFacesAsync(...args),
  FaceDetectorMode: { fast: 1, accurate: 2 },
  FaceDetectorLandmarks: { none: 1, all: 2 },
  FaceDetectorClassifications: { none: 1, all: 2 },
}));

// ── Helpers ──────────────────────────────────────────────────────────

/** Build a minimal FaceFeature object for testing. */
function makeFace(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  yawAngle?: number;
  rollAngle?: number;
}) {
  return {
    bounds: {
      origin: { x: opts.x, y: opts.y },
      size: { width: opts.width, height: opts.height },
    },
    yawAngle: opts.yawAngle,
    rollAngle: opts.rollAngle,
  };
}

const FRAME_W = 1000;
const FRAME_H = 1000;

// ── Tests ────────────────────────────────────────────────────────────

describe('checkPhotoQuality', () => {
  afterEach(() => {
    mockDetectFacesAsync.mockReset();
  });

  it('returns failure with "No face detected" when no faces are found', async () => {
    mockDetectFacesAsync.mockResolvedValue({
      faces: [],
      image: { uri: 'file://test.jpg', width: FRAME_W, height: FRAME_H, orientation: 1 },
    });

    const result: PhotoQualityResult = await checkPhotoQuality(
      'file://test.jpg',
      FRAME_W,
      FRAME_H,
    );

    expect(result.faceDetected).toBe(false);
    expect(result.overallPass).toBe(false);
    expect(result.issues).toContain('No face detected');
  });

  it('returns "Move closer" when face is too small (<20% fill)', async () => {
    // 100x100 face in 1000x1000 frame = 1% fill
    mockDetectFacesAsync.mockResolvedValue({
      faces: [makeFace({ x: 450, y: 450, width: 100, height: 100, yawAngle: 0, rollAngle: 0 })],
      image: { uri: 'file://test.jpg', width: FRAME_W, height: FRAME_H, orientation: 1 },
    });

    const result = await checkPhotoQuality('file://test.jpg', FRAME_W, FRAME_H);

    expect(result.faceDetected).toBe(true);
    expect(result.fillPercent).toBeLessThan(20);
    expect(result.overallPass).toBe(false);
    expect(result.issues).toContain('Move closer');
  });

  it('returns "Center your face" when face is off-center', async () => {
    // Face in the top-left corner: origin (0,0), size 300x300 => center at (150,150).
    // Center band (50% tolerance) is 250..750, so (150,150) is outside on both axes.
    mockDetectFacesAsync.mockResolvedValue({
      faces: [makeFace({ x: 0, y: 0, width: 300, height: 300, yawAngle: 0, rollAngle: 0 })],
      image: { uri: 'file://test.jpg', width: FRAME_W, height: FRAME_H, orientation: 1 },
    });

    const result = await checkPhotoQuality('file://test.jpg', FRAME_W, FRAME_H);

    expect(result.faceDetected).toBe(true);
    expect(result.centered).toBe(false);
    expect(result.issues).toContain('Center your face');
  });

  it('returns "Face camera directly" when yaw/roll exceed 15 degrees', async () => {
    // Centered, large face but with a 25-degree yaw
    mockDetectFacesAsync.mockResolvedValue({
      faces: [
        makeFace({ x: 200, y: 200, width: 600, height: 600, yawAngle: 25, rollAngle: 0 }),
      ],
      image: { uri: 'file://test.jpg', width: FRAME_W, height: FRAME_H, orientation: 1 },
    });

    const result = await checkPhotoQuality('file://test.jpg', FRAME_W, FRAME_H);

    expect(result.faceDetected).toBe(true);
    expect(result.angleValid).toBe(false);
    expect(result.overallPass).toBe(false);
    expect(result.issues).toContain('Face camera directly');
  });

  it('returns overallPass true with no issues for a valid face', async () => {
    // Well-centered, large, straight-on face
    // Face: origin (200,200), size (600,600) => center (500,500), fill = 36%
    mockDetectFacesAsync.mockResolvedValue({
      faces: [
        makeFace({ x: 200, y: 200, width: 600, height: 600, yawAngle: 5, rollAngle: -3 }),
      ],
      image: { uri: 'file://test.jpg', width: FRAME_W, height: FRAME_H, orientation: 1 },
    });

    const result = await checkPhotoQuality('file://test.jpg', FRAME_W, FRAME_H);

    expect(result.faceDetected).toBe(true);
    expect(result.centered).toBe(true);
    expect(result.fillPercent).toBeGreaterThanOrEqual(20);
    expect(result.angleValid).toBe(true);
    expect(result.overallPass).toBe(true);
    expect(result.issues).toHaveLength(0);
  });
});
