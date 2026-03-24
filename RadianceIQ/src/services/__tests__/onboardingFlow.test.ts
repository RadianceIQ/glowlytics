import {
  buildOnboardingFlow,
  screenToRoute,
  getNextScreen,
  getPreviousScreen,
} from '../onboardingFlow';

describe('onboardingFlow', () => {
  describe('buildOnboardingFlow', () => {
    it('builds base flow with essential screens', () => {
      const flow = buildOnboardingFlow();
      expect(flow).toContain('welcome');
      expect(flow).toContain('age-range');
      expect(flow).toContain('sex');
      expect(flow).toContain('skin-goal');
      expect(flow).toContain('camera-permission');
      expect(flow).toContain('preview');
      expect(flow).toContain('paywall');
      expect(flow).not.toContain('menstrual');
      expect(flow).not.toContain('cycle-details');
    });

    it('does not include deferred screens', () => {
      const flow = buildOnboardingFlow();
      expect(flow).not.toContain('location');
      expect(flow).not.toContain('products');
      expect(flow).not.toContain('supplements');
      expect(flow).not.toContain('exercise');
      expect(flow).not.toContain('shower-frequency');
      expect(flow).not.toContain('hand-washing');
      expect(flow).not.toContain('scan-reminder');
      expect(flow).not.toContain('ready');
    });

    it('places camera-permission after skin-goal for base flow', () => {
      const flow = buildOnboardingFlow();
      const goalIndex = flow.indexOf('skin-goal');
      const cameraIndex = flow.indexOf('camera-permission');
      expect(cameraIndex).toBe(goalIndex + 1);
    });

    it('builds male flow without menstrual screens', () => {
      const flow = buildOnboardingFlow('male');
      expect(flow).not.toContain('menstrual');
      expect(flow).not.toContain('cycle-details');
      expect(flow.length).toBe(7);
    });

    it('inserts menstrual screen for female users', () => {
      const flow = buildOnboardingFlow('female');
      expect(flow).toContain('menstrual');
      expect(flow).not.toContain('cycle-details');
      const menstrualIndex = flow.indexOf('menstrual');
      const skinGoalIndex = flow.indexOf('skin-goal');
      expect(menstrualIndex).toBeGreaterThan(skinGoalIndex);
    });

    it('inserts cycle-details for female with regular cycle', () => {
      const flow = buildOnboardingFlow('female', 'regular');
      expect(flow).toContain('menstrual');
      expect(flow).toContain('cycle-details');
      const menstrualIndex = flow.indexOf('menstrual');
      const cycleIndex = flow.indexOf('cycle-details');
      expect(cycleIndex).toBe(menstrualIndex + 1);
    });

    it('inserts cycle-details for female with irregular cycle', () => {
      const flow = buildOnboardingFlow('female', 'irregular');
      expect(flow).toContain('cycle-details');
    });

    it('does not insert cycle-details when menstrual status is no', () => {
      const flow = buildOnboardingFlow('female', 'no');
      expect(flow).toContain('menstrual');
      expect(flow).not.toContain('cycle-details');
    });

    it('does not insert cycle-details for prefer_not', () => {
      const flow = buildOnboardingFlow('female', 'prefer_not');
      expect(flow).toContain('menstrual');
      expect(flow).not.toContain('cycle-details');
    });

    it('does not insert menstrual screens for other sex', () => {
      const flow = buildOnboardingFlow('other');
      expect(flow).not.toContain('menstrual');
      expect(flow).not.toContain('cycle-details');
    });

    it('always starts with welcome and ends with paywall', () => {
      const flows = [
        buildOnboardingFlow(),
        buildOnboardingFlow('male'),
        buildOnboardingFlow('female'),
        buildOnboardingFlow('female', 'regular'),
      ];
      for (const flow of flows) {
        expect(flow[0]).toBe('welcome');
        expect(flow[flow.length - 1]).toBe('paywall');
      }
    });

    it('has correct length for each path', () => {
      expect(buildOnboardingFlow().length).toBe(7);              // base
      expect(buildOnboardingFlow('male').length).toBe(7);        // same as base
      expect(buildOnboardingFlow('female').length).toBe(8);      // +menstrual
      expect(buildOnboardingFlow('female', 'regular').length).toBe(9);   // +menstrual +cycle-details
      expect(buildOnboardingFlow('female', 'irregular').length).toBe(9);
      expect(buildOnboardingFlow('female', 'no').length).toBe(8);       // +menstrual only
    });
  });

  describe('screenToRoute', () => {
    it('converts screen name to route path', () => {
      expect(screenToRoute('welcome')).toBe('/onboarding/welcome');
      expect(screenToRoute('age-range')).toBe('/onboarding/age-range');
      expect(screenToRoute('camera-permission')).toBe('/onboarding/camera-permission');
      expect(screenToRoute('preview')).toBe('/onboarding/preview');
      expect(screenToRoute('paywall')).toBe('/onboarding/paywall');
    });
  });

  describe('getNextScreen', () => {
    it('returns next screen in flow', () => {
      const flow = buildOnboardingFlow();
      expect(getNextScreen(flow, 0)).toBe('age-range');
      expect(getNextScreen(flow, 1)).toBe('sex');
    });

    it('returns null at end of flow', () => {
      const flow = buildOnboardingFlow();
      expect(getNextScreen(flow, flow.length - 1)).toBeNull();
    });
  });

  describe('getPreviousScreen', () => {
    it('returns previous screen in flow', () => {
      const flow = buildOnboardingFlow();
      expect(getPreviousScreen(flow, 1)).toBe('welcome');
      expect(getPreviousScreen(flow, 2)).toBe('age-range');
    });

    it('returns null at start of flow', () => {
      const flow = buildOnboardingFlow();
      expect(getPreviousScreen(flow, 0)).toBeNull();
    });
  });
});
