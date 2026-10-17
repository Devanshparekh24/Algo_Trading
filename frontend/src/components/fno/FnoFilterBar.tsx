import React from 'react';
import { Layers, Zap, ArrowUpRight, ArrowDownRight, Flame, TrendingUp, TrendingDown, Star } from 'lucide-react';
import type { FnoMoversSummary } from '../../types';
import SearchInput from '../common/SearchInput';
import { useWatchlistStore } from '../../store';

export type SegmentFilter = 'all' | 'FUT' | 'CE' | 'PE' | 'watchlist';
export type DirectionFilter = 'volatile' | 'gainers' | 'losers';
export type UnderlyingFilter = 'ALL' | 'NIFTY' | 'BANKNIFTY' | 'FINNIFTY' | 'STOCKS';

export interface FnoFilterBarProps {
  segment: SegmentFilter;
  onSegmentChange: (seg: SegmentFilter) => void;
  direction: DirectionFilter;
  onDirectionChange: (dir: DirectionFilter) => void;
  underlying: UnderlyingFilter;
  onUnderlyingChange: (und: UnderlyingFilter) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  summary?: FnoMoversSummary;
}

const UNDERLYING_OPTIONS: UnderlyingFilter[] = ['ALL', 'NIFTY', 'BANKNIFTY', 'FINNIFTY', 'STOCKS'];

export const FnoFilterBar: React.FC<FnoFilterBarProps> = ({
  segment,
  onSegmentChange,
  direction,
  onDirectionChange,
  underlying,
  onUnderlyingChange,
  searchQuery,
  onSearchChange,
  summary,
}) => {
  const pinnedTokens = useWatchlistStore((state) => state.pinnedTokens);
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/80 p-3 shadow-xs space-y-3">
      {/* Primary Row: Segment Tabs & Direction Filters */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Main Segment Tabs: All / FUT / CE / PE */}
        <div className="flex flex-wrap items-center gap-1.5 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onSegmentChange('all')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              segment === 'all'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>All F&O</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-gray-200 dark:bg-gray-700 rounded-full font-mono">
              {summary?.totalCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSegmentChange('FUT')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              segment === 'FUT'
                ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-blue-500" />
            <span>Futures</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-full font-mono">
              {summary?.futuresCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSegmentChange('CE')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              segment === 'CE'
                ? 'bg-white dark:bg-gray-800 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
            <span>Calls (CE)</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 rounded-full font-mono">
              {summary?.callsCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSegmentChange('PE')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              segment === 'PE'
                ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
            <span>Puts (PE)</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300 rounded-full font-mono">
              {summary?.putsCount || 0}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSegmentChange('watchlist')}
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              segment === 'watchlist'
                ? 'bg-white dark:bg-gray-800 text-amber-600 dark:text-amber-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${segment === 'watchlist' ? 'text-amber-500 fill-amber-500' : 'text-gray-400'}`} />
            <span>Watchlist</span>
            <span className="text-[10px] px-1.5 py-0.2 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 rounded-full font-mono">
              {pinnedTokens.length}
            </span>
          </button>
        </div>

        {/* Direction Filter: Top Volatile / Ups / Downs */}
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
          <button
            type="button"
            onClick={() => onDirectionChange('volatile')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              direction === 'volatile'
                ? 'bg-white dark:bg-gray-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-3.5 h-3.5 text-indigo-500" />
            <span>Top Volatile</span>
          </button>

          <button
            type="button"
            onClick={() => onDirectionChange('gainers')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              direction === 'gainers'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Ups (Gainers)</span>
          </button>

          <button
            type="button"
            onClick={() => onDirectionChange('losers')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
              direction === 'losers'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20'
            }`}
          >
            <TrendingDown className="w-3.5 h-3.5" />
            <span>Downs (Losers)</span>
          </button>
        </div>
      </div>

      {/* Secondary Row: Underlying Quick Chips & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/80">
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <span className="text-gray-400 font-semibold mr-1 text-[11px] uppercase tracking-wider">
            Index / Underlying:
          </span>
          {UNDERLYING_OPTIONS.map((u) => (
            <button
              key={u}
              type="button"
              onClick={() => onUnderlyingChange(u)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                underlying === u
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'bg-gray-100 dark:bg-gray-700/50 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {u}
            </button>
          ))}
        </div>

        <SearchInput
          value={searchQuery}
          onChange={onSearchChange}
          placeholder="Search symbol or strike (e.g. 23200)..."
          className="w-full sm:w-64"
        />
      </div>
    </div>
  );
};

export default FnoFilterBar;
