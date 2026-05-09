export const XP_THRESHOLDS: Record<number, number> = {
  1: 0,
  2: 100,
  3: 250,
  4: 500,
  5: 1000,
  6: 2000,
  7: 3500,
  8: 5000,
  9: 7500,
  10: 10000,
};

export function getXpProgress(totalXp: number, level: number) {
  const currentThreshold = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[1];
  const nextThreshold = XP_THRESHOLDS[level + 1] ?? XP_THRESHOLDS[10];

  if (level >= 10) {
    return {
      progressPercent: 100,
      remainingXp: 0,
      remainingLabel: "Max level reached",
    };
  }

  const denominator = nextThreshold - currentThreshold;
  const rawProgress = denominator > 0 ? (totalXp - currentThreshold) / denominator : 1;
  const progressPercent = Math.max(0, Math.min(100, rawProgress * 100));
  const remainingXp = Math.max(0, nextThreshold - totalXp);

  return {
    progressPercent,
    remainingXp,
    remainingLabel: `${nextThreshold} XP to next level`,
  };
}
