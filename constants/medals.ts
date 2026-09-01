export type MedalTier = 'gold' | 'silver' | 'bronze' | 'none';

export const MEDAL_THRESHOLDS = {
  gold: 300,
  silver: 150,
  bronze: 50,
} as const;

export const MEDAL_LABELS: Record<Exclude<MedalTier, 'none'>, string> = {
  gold: 'Eco Oro',
  silver: 'Eco Plata',
  bronze: 'Eco Bronce',
};

export const MEDAL_COLORS: Record<Exclude<MedalTier, 'none'>, string> = {
  gold: '#F59E0B',
  silver: '#9CA3AF',
  bronze: '#CD7F32',
};

export function computeMedalTier(ecoPoints: number): MedalTier {
  if (ecoPoints >= MEDAL_THRESHOLDS.gold) return 'gold';
  if (ecoPoints >= MEDAL_THRESHOLDS.silver) return 'silver';
  if (ecoPoints >= MEDAL_THRESHOLDS.bronze) return 'bronze';
  return 'none';
}

export function getNextMedalTier(currentPoints: number): {
  tier: Exclude<MedalTier, 'none'>;
  pointsNeeded: number;
} | null {
  if (currentPoints >= MEDAL_THRESHOLDS.gold) return null;
  if (currentPoints >= MEDAL_THRESHOLDS.silver) {
    return { tier: 'gold', pointsNeeded: MEDAL_THRESHOLDS.gold - currentPoints };
  }
  if (currentPoints >= MEDAL_THRESHOLDS.bronze) {
    return { tier: 'silver', pointsNeeded: MEDAL_THRESHOLDS.silver - currentPoints };
  }
  return { tier: 'bronze', pointsNeeded: MEDAL_THRESHOLDS.bronze - currentPoints };
}

export function formatCompetitionMonth(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });
}
