import { getDirections } from '../faceTracking';

// Mock expo-face-detector
jest.mock('expo-face-detector', () => ({
  detectFacesAsync: jest.fn(),
  FaceDetectorMode: { fast: 1, accurate: 2 },
  FaceDetectorLandmarks: { none: 0 },
  FaceDetectorClassifications: { none: 0 },
}));

describe('faceTracking', () => {
  describe('getDirections', () => {
    it('returns empty array for no issues', () => {
      expect(getDirections([])).toEqual([]);
    });

    it('maps "Move closer" to closer direction', () => {
      expect(getDirections(['Move closer'])).toEqual(['closer']);
    });

    it('maps "Move left" to left direction', () => {
      expect(getDirections(['Move left'])).toEqual(['left']);
    });

    it('maps "Move right" to right direction', () => {
      expect(getDirections(['Move right'])).toEqual(['right']);
    });

    it('maps "Turn toward camera" to face_camera direction', () => {
      expect(getDirections(['Turn toward camera'])).toEqual(['face_camera']);
    });

    it('maps multiple issues to multiple directions', () => {
      const dirs = getDirections(['Move closer', 'Move left', 'Turn toward camera']);
      expect(dirs).toEqual(['closer', 'left', 'face_camera']);
    });

    it('maps "Move up" and "Move down" correctly', () => {
      expect(getDirections(['Move up'])).toEqual(['up']);
      expect(getDirections(['Move down'])).toEqual(['down']);
    });

    it('ignores unknown issues', () => {
      expect(getDirections(['Position your face in the frame'])).toEqual([]);
    });
  });
});
