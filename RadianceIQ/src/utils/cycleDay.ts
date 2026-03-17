import type { UserProfile } from '../types';

/**
 * Estimate the current cycle day from the user's profile.
 * Returns undefined if not applicable or data is missing.
 */
export const getEstimatedCycleDay = (
  user: Pick<UserProfile, 'period_applicable' | 'period_last_start_date' | 'cycle_length_days'> | null | undefined,
): number | undefined => {
  if (!user || user.period_applicable !== 'yes' || !user.period_last_start_date) return undefined;
  const start = new Date(user.period_last_start_date);
  const today = new Date();
  const diff = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const cycleLen = user.cycle_length_days || 28;
  return ((diff % cycleLen) + cycleLen) % cycleLen + 1;
};
