import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface WatchlistState {
  pinnedTokens: string[];
  togglePin: (symbolToken: string) => void;
  isPinned: (symbolToken: string) => boolean;
  clearWatchlist: () => void;
}

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      pinnedTokens: [],
      togglePin: (symbolToken: string) => {
        const current = get().pinnedTokens;
        if (current.includes(symbolToken)) {
          set({ pinnedTokens: current.filter((t) => t !== symbolToken) });
        } else {
          set({ pinnedTokens: [...current, symbolToken] });
        }
      },
      isPinned: (symbolToken: string) => {
        return get().pinnedTokens.includes(symbolToken);
      },
      clearWatchlist: () => set({ pinnedTokens: [] }),
    }),
    {
      name: 'algo_trading_watchlist',
    }
  )
);

export default useWatchlistStore;
