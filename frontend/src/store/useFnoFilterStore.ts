import { create } from 'zustand';
import type { FnoMoverItem } from '../types';

export type SegmentFilter = 'all' | 'FUT' | 'CE' | 'PE' | 'watchlist';
export type DirectionFilter = 'volatile' | 'gainers' | 'losers';
export type UnderlyingFilter = 'ALL' | 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'STOCKS';
export type ViewMode = 'table' | 'cards';

export interface FnoFilterState {
  segment: SegmentFilter;
  direction: DirectionFilter;
  underlying: UnderlyingFilter;
  searchQuery: string;
  viewMode: ViewMode;
  selectedContract: FnoMoverItem | null;

  setSegment: (seg: SegmentFilter) => void;
  setDirection: (dir: DirectionFilter) => void;
  setUnderlying: (und: UnderlyingFilter) => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSelectedContract: (contract: FnoMoverItem | null) => void;
  resetFilters: () => void;
}

const initialState = {
  segment: 'all' as SegmentFilter,
  direction: 'volatile' as DirectionFilter,
  underlying: 'ALL' as UnderlyingFilter,
  searchQuery: '',
  viewMode: 'table' as ViewMode,
  selectedContract: null as FnoMoverItem | null,
};

export const useFnoFilterStore = create<FnoFilterState>((set) => ({
  ...initialState,

  setSegment: (segment) => set({ segment }),
  setDirection: (direction) => set({ direction }),
  setUnderlying: (underlying) => set({ underlying }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setViewMode: (viewMode) => set({ viewMode }),
  setSelectedContract: (selectedContract) => set({ selectedContract }),
  resetFilters: () => set({ ...initialState, viewMode: 'table' }),
}));

export default useFnoFilterStore;
