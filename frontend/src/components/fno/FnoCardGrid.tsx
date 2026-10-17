import React from 'react';
import { Star } from 'lucide-react';
import type { FnoMoverItem } from '../../types';
import InstrumentBadge from '../common/InstrumentBadge';
import ChangePill from '../common/ChangePill';
import DayRangeBar from '../common/DayRangeBar';
import { formatINR, formatCompactQty } from '../../utils/formatters';
import { useWatchlistStore } from '../../store';

export interface FnoCardGridProps {
  items: FnoMoverItem[];
  onSelectContract: (item: FnoMoverItem) => void;
}

export const FnoCardGrid: React.FC<FnoCardGridProps> = ({ items, onSelectContract }) => {
  const { togglePin, isPinned } = useWatchlistStore();

  if (items.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-xs bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/80 p-8">
        No contracts match the current filters.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {items.map((item) => {
        const isUp = item.percentChange >= 0;

        return (
          <div
            key={item.symbolToken || item.tradingSymbol}
            onClick={() => onSelectContract(item)}
            className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700/80 p-5 shadow-xs hover:shadow-md cursor-pointer transition-all hover:border-blue-300 dark:hover:border-blue-700 group space-y-3"
          >
            {/* Header: Symbol & Instrument Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    togglePin(item.symbolToken || item.tradingSymbol);
                  }}
                  title={isPinned(item.symbolToken || item.tradingSymbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                  className="p-1 rounded-md text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors mt-0.5"
                >
                  <Star
                    className={`w-4 h-4 ${
                      isPinned(item.symbolToken || item.tradingSymbol)
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                    }`}
                  />
                </button>
                <div>
                  <div className="font-extrabold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                    {item.tradingSymbol}
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    {item.name} · Expiry: {item.expiry}
                  </div>
                </div>
              </div>
              <InstrumentBadge type={item.instrumentType} />
            </div>

            {/* Price & Change */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <div className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">LTP</div>
                <div className="text-2xl font-extrabold font-mono text-gray-900 dark:text-white">
                  {formatINR(item.ltp)}
                </div>
              </div>
              <div className="text-right flex flex-col items-end">
                <ChangePill value={item.percentChange} size="sm" />
                <div className={`text-[11px] font-mono mt-1 ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {isUp ? '+' : ''}{item.netChange.toFixed(2)}
                </div>
              </div>
            </div>

            {/* Day Range */}
            {item.high && item.low && item.high > item.low && (
              <div className="pt-1">
                <DayRangeBar
                  current={item.ltp}
                  low={item.low}
                  high={item.high}
                  showLabels={true}
                />
              </div>
            )}

            {/* Volume & OI Footer */}
            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-100 dark:border-gray-700/80 text-xs text-gray-600 dark:text-gray-300 font-mono">
              <div>
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Volume</span>
                <span className="font-semibold">{formatCompactQty(item.tradeVolume)}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] text-gray-400 uppercase block font-bold">Open Interest</span>
                <span className="font-semibold">{formatCompactQty(item.opnInterest)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FnoCardGrid;
