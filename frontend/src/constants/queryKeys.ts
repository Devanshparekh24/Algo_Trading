/**
 * Centralized React Query Keys Factory
 * Provides type-safe and consistent cache keys across the entire application.
 */

export const queryKeys = {
  market: {
    all: ['market'] as const,
    niftyQuote: () => [...queryKeys.market.all, 'niftyQuote'] as const,
    fnoMovers: (refresh?: boolean) => [...queryKeys.market.all, 'fnoMovers', { refresh }] as const,
    status: () => [...queryKeys.market.all, 'status'] as const,
  },
  portfolio: {
    all: ['portfolio'] as const,
    positions: () => [...queryKeys.portfolio.all, 'positions'] as const,
    holdings: () => [...queryKeys.portfolio.all, 'holdings'] as const,
  },
  user: {
    all: ['user'] as const,
    profile: () => [...queryKeys.user.all, 'profile'] as const,
    rmsLimit: () => [...queryKeys.user.all, 'rmsLimit'] as const,
  },
} as const;
