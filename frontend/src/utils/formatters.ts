/**
 * Enterprise Financial & Numerical Formatters
 * Standardized across Indian Stock & Derivatives Markets
 */

/**
 * Format a number as Indian Rupee (INR) currency string
 * e.g., 24523.5 -> "₹24,523.50"
 */
export function formatINR(val?: number | string | null, decimals = 2): string {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';

  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/**
 * Format plain number with Indian numbering system (thousands, lakhs, crores)
 */
export function formatNumber(val?: number | string | null, decimals = 2): string {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';

  return num.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format percentage change with optional sign
 * e.g., 2.345 -> "+2.35%", -1.2 -> "-1.20%"
 */
export function formatPercent(val?: number | string | null, includeSign = true, decimals = 2): string {
  if (val === undefined || val === null || val === '') return '—';
  const num = typeof val === 'string' ? parseFloat(val) : val;
  if (isNaN(num)) return '—';

  const sign = includeSign && num > 0 ? '+' : '';
  return `${sign}${num.toFixed(decimals)}%`;
}

/**
 * Format volume or open interest into compact Indian units (Cr, L) or localized integer
 * e.g., 15000000 -> "1.50 Cr", 250000 -> "2.50 L"
 */
export function formatCompactQty(qty?: number | string | null): string {
  if (qty === undefined || qty === null || qty === '') return '—';
  const num = typeof qty === 'string' ? parseFloat(qty) : qty;
  if (isNaN(num) || num === 0) return '—';

  if (Math.abs(num) >= 10000000) {
    return `${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `${(num / 100000).toFixed(2)} L`;
  }
  return num.toLocaleString('en-IN');
}

/**
 * Compute progress percentage (0 - 100) between Low and High price
 */
export function calculateRangeProgress(
  current?: number | null,
  low?: number | null,
  high?: number | null
): number {
  if (!current || !low || !high || high <= low) return 50;
  const progress = ((current - low) / (high - low)) * 100;
  return Math.min(Math.max(progress, 0), 100);
}
