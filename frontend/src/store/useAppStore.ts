import { create } from 'zustand';

export type ActiveView = 'home' | 'positions' | 'markets' | 'fno';

export interface AppState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  marketBannerDismissed: boolean;
  dismissMarketBanner: () => void;
  restoreMarketBanner: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  activeView: 'fno',
  setActiveView: (view: ActiveView) => set({ activeView: view }),
  marketBannerDismissed: false,
  dismissMarketBanner: () => set({ marketBannerDismissed: true }),
  restoreMarketBanner: () => set({ marketBannerDismissed: false }),
}));

export default useAppStore;
