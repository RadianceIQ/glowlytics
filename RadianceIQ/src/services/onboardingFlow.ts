import type { BiologicalSex, MenstrualStatus, OnboardingScreenName } from '../types';

/**
 * Builds the onboarding screen flow based on user answers.
 * Female users get menstrual/cycle screens inserted after skin-goal.
 */
export function buildOnboardingFlow(
  sex?: BiologicalSex,
  menstrualStatus?: MenstrualStatus,
): OnboardingScreenName[] {
  const flow: OnboardingScreenName[] = [
    'welcome',
    'age-range',
    'sex',
    'location',
    'skin-goal',
  ];

  if (sex === 'female') {
    flow.push('menstrual');
    if (menstrualStatus === 'regular' || menstrualStatus === 'irregular') {
      flow.push('cycle-details');
    }
  }

  flow.push(
    'supplements',
    'exercise',
    'shower-frequency',
    'hand-washing',
    'scan-reminder',
    'camera-permission',
    'ready',
    'paywall',
  );

  return flow;
}

/**
 * Maps an OnboardingScreenName to the Expo Router path.
 */
export function screenToRoute(screen: OnboardingScreenName): string {
  return `/onboarding/${screen}`;
}

/**
 * Returns the next screen in the flow, or null if at the end.
 */
export function getNextScreen(
  flow: OnboardingScreenName[],
  currentIndex: number,
): OnboardingScreenName | null {
  if (currentIndex + 1 >= flow.length) return null;
  return flow[currentIndex + 1];
}

/**
 * Returns the previous screen in the flow, or null if at the start.
 */
export function getPreviousScreen(
  flow: OnboardingScreenName[],
  currentIndex: number,
): OnboardingScreenName | null {
  if (currentIndex <= 0) return null;
  return flow[currentIndex - 1];
}
