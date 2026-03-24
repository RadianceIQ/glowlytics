import { Colors, FontFamily, FontSize, BorderRadius, Spacing, Motion } from '../theme';

describe('Theme constants', () => {
  describe('FontFamily', () => {
    it('maps sansMedium to Switzer-Medium (not Regular)', () => {
      expect(FontFamily.sansMedium).toBe('Switzer-Medium');
      expect(FontFamily.sansMedium).not.toBe(FontFamily.sans);
    });

    it('has distinct weights for sans, sansMedium, sansBold', () => {
      const weights = new Set([FontFamily.sans, FontFamily.sansMedium, FontFamily.sansBold]);
      expect(weights.size).toBe(3);
    });

    it('maps all font families to valid Switzer variants', () => {
      const validFonts = ['Switzer-Regular', 'Switzer-Medium', 'Switzer-Bold'];
      Object.values(FontFamily).forEach((font) => {
        expect(validFonts).toContain(font);
      });
    });
  });

  describe('FontSize', () => {
    it('includes xxs token', () => {
      expect(FontSize.xxs).toBe(10);
    });

    it('has monotonically increasing sizes', () => {
      const sizes = [FontSize.xxs, FontSize.xs, FontSize.sm, FontSize.md, FontSize.lg, FontSize.xl, FontSize.xxl, FontSize.hero, FontSize.display];
      for (let i = 1; i < sizes.length; i++) {
        expect(sizes[i]).toBeGreaterThan(sizes[i - 1]);
      }
    });
  });

  describe('BorderRadius', () => {
    it('includes xs token', () => {
      expect(BorderRadius.xs).toBe(6);
    });

    it('has monotonically increasing radii (excluding full)', () => {
      const radii = [BorderRadius.xs, BorderRadius.sm, BorderRadius.md, BorderRadius.lg, BorderRadius.xl, BorderRadius.xxl];
      for (let i = 1; i < radii.length; i++) {
        expect(radii[i]).toBeGreaterThan(radii[i - 1]);
      }
    });

    it('full is 999', () => {
      expect(BorderRadius.full).toBe(999);
    });
  });

  describe('Colors', () => {
    it('includes backgroundWarm token', () => {
      expect(Colors.backgroundWarm).toBe('#EDE9E3');
    });

    it('textOnDark is white', () => {
      expect(Colors.textOnDark).toBe('#FFFFFF');
    });
  });

  describe('Spacing', () => {
    it('follows 2x progression for core values', () => {
      expect(Spacing.sm).toBe(Spacing.xs * 2);
      expect(Spacing.md).toBe(Spacing.sm * 2);
      expect(Spacing.lg).toBe(Spacing.md + Spacing.sm);
      expect(Spacing.xl).toBe(Spacing.md * 2);
    });
  });

  describe('Motion', () => {
    it('has increasing durations', () => {
      expect(Motion.fast).toBeLessThan(Motion.base);
      expect(Motion.base).toBeLessThan(Motion.slow);
      expect(Motion.slow).toBeLessThan(Motion.graceful);
      expect(Motion.graceful).toBeLessThan(Motion.dramatic);
      expect(Motion.dramatic).toBeLessThan(Motion.breathe);
    });
  });
});
