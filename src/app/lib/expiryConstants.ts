export const EXPIRY_THRESHOLDS = {
  CRITICAL_MAX_DAYS: 100, // <= 100 days remaining: Critical (priority outflow)
  MODERATE_MIN_DAYS: 101,
  MODERATE_MAX_DAYS: 150, // 101 to 150 days: Moderate shelf-life
  SAFE_MIN_DAYS: 151      // > 150 days: Safe / Stable reserve
} as const;

export type ExpiryTier = 'critical' | 'moderate' | 'safe' | 'expired';

export function getDaysRemaining(expirationDate: string | Date | undefined | null): number {
  if (!expirationDate) return 999;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expirationDate);
  if (isNaN(exp.getTime())) return 999;
  exp.setHours(0, 0, 0, 0);
  return Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getExpiryTier(expirationDate: string | Date | undefined | null): ExpiryTier {
  const days = getDaysRemaining(expirationDate);
  if (days <= 0) return 'expired';
  if (days <= EXPIRY_THRESHOLDS.CRITICAL_MAX_DAYS) return 'critical';
  if (days <= EXPIRY_THRESHOLDS.MODERATE_MAX_DAYS) return 'moderate';
  return 'safe';
}

export function getExpiryBadgeConfig(tier: ExpiryTier): {
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  switch (tier) {
    case 'expired':
      return {
        label: 'Expired',
        badgeClass: 'bg-red-100 text-red-900 border-red-300',
        dotClass: 'bg-red-600'
      };
    case 'critical':
      return {
        label: 'Critical (<= 100d)',
        badgeClass: 'bg-red-50 text-red-800 border-red-200',
        dotClass: 'bg-red-500'
      };
    case 'moderate':
      return {
        label: 'Moderate (101-150d)',
        badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
        dotClass: 'bg-amber-500'
      };
    case 'safe':
      return {
        label: 'Safe (> 150d)',
        badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
        dotClass: 'bg-emerald-500'
      };
  }
}

