import React, { useState, useMemo } from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, Star } from 'lucide-react';
import type { FnoMoverItem } from '../../types';
import InstrumentBadge from '../common/InstrumentBadge';
import ChangePill from '../common/ChangePill';
import DayRangeBar from '../common/DayRangeBar';
import { formatINR, formatCompactQty, formatNumber } from '../../utils/formatters';
import { useWatchlistStore } from '../../store';

export type SortField = 'tradingSymbol' | 'instrumentType' | 'strike' | 'ltp' | 'netChange' | 'percentChange' | 'tradeVolume' | 'opnInterest';
export type SortOrder = 'asc' | 'desc';

export interface FnoTableViewProps {
  items: FnoMoverItem[];
  onSelectContract: (item: FnoMoverItem) => void;
  flashes?: Record<string, 'up' | 'down'>;
}

export const FnoTableView: React.FC<FnoTableViewProps> = ({ items, onSelectContract, flashes }) => {
  const { togglePin, isPinned } = useWatchlistStore();
  const [sortField, setSortField] = useState<SortField>('percentChange');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      let aVal = a[sortField];
      let bVal = b[sortField];

      if (aVal === undefined || aVal === null) aVal = 0;
      if (bVal === undefined || bVal === null) bVal = 0;

      if (typeof aVal === 'string') {
        return sortOrder === 'asc'
          ? (aVal as string).localeCompare(bVal as string)
          : (bVal as string).localeCompare(aVal as string);
      }

      return sortOrder === 'asc' ? Number(aVal) - Number(bVal) : Number(bVal) - Number(aVal);
    });
  }, [items, sortField, sortOrder]);

  const renderSortHeader = (label: string, field: SortField, align: 'left' | 'right' | 'center' = 'left') => {
    const isActive = sortField === field;
    return (
      <th
        onClick={() => handleSort(field)}
        className={`py-3 px-3 cursor-pointer select-none transition-colors hover:bg-gray-100 dark:hover:bg-gray-700/80 ${
          align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
        }`}
      >
        <div className={`inline-flex items-center gap-1 ${align === 'right' ? 'justify-end' : align === 'center' ? 'justify-center' : 'justify-start'}`}>
          <span>{label}</span>
          {isActive ? (
            sortOrder === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            ) : (
              <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />
            )
          ) : (
            <ArrowUpDown className="w-3 h-3 text-gray-400 opacity-60" />
          )}
        </div>
      </th>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-gray-50/90 dark:bg-gray-700/50 text-[10px] uppercase font-bold text-gray-400 tracking-wider border-b border-gray-200 dark:border-gray-700">
            <tr>
              {renderSortHeader('Contract / Instrument', 'tradingSymbol', 'left')}
              {renderSortHeader('Type', 'instrumentType', 'left')}
              {renderSortHeader('Strike', 'strike', 'right')}
              {renderSortHeader('LTP (₹)', 'ltp', 'right')}
              {renderSortHeader('Net Change', 'netChange', 'right')}
              {renderSortHeader('% Change', 'percentChange', 'right')}
              {renderSortHeader('Volume', 'tradeVolume', 'right')}
              {renderSortHeader('Open Interest', 'opnInterest', 'right')}
              <th className="py-3 px-4 text-center">Day Range</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-sans">
            {sortedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-12 text-gray-400 text-xs">
                  No contracts match the current filters.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => {
                const isUp = item.percentChange >= 0;
                const flash = flashes?.[item.symbolToken] || flashes?.[item.tradingSymbol];

                return (
                  <tr
                    key={item.symbolToken || item.tradingSymbol}
                    onClick={() => onSelectContract(item)}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors group"
                  >
                    {/* Contract / Instrument */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            togglePin(item.symbolToken || item.tradingSymbol);
                          }}
                          title={isPinned(item.symbolToken || item.tradingSymbol) ? 'Remove from Watchlist' : 'Add to Watchlist'}
                          className="p-1 rounded-md text-gray-400 hover:text-amber-500 hover:bg-gray-100 dark:hover:bg-gray-700/60 transition-colors"
                        >
                          <Star
                            className={`w-3.5 h-3.5 ${
                              isPinned(item.symbolToken || item.tradingSymbol)
                                ? 'fill-amber-400 text-amber-500'
                                : 'text-gray-300 dark:text-gray-600 hover:text-amber-400'
                            }`}
                          />
                        </button>
                        <div>
                          <div className="font-bold text-gray-900 dark:text-white text-xs group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {item.tradingSymbol}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                            {item.name} · {item.expiry}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Type Badge */}
                    <td className="py-3.5 px-3">
                      <InstrumentBadge type={item.instrumentType} />
                    </td>

                    {/* Strike */}
                    <td className="py-3.5 px-3 text-right font-mono font-medium text-gray-700 dark:text-gray-300">
                      {item.strike ? formatNumber(item.strike, 0) : '—'}
                    </td>

                    {/* LTP */}
                    <td className="py-3.5 px-3 text-right">
                      <span
                        className={`inline-block font-extrabold font-mono text-sm px-2 py-0.5 rounded-lg transition-all duration-300 ${
                          flash === 'up'
                            ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 scale-105 shadow-xs font-black'
                            : flash === 'down'
                            ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 scale-105 shadow-xs font-black'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {formatINR(item.ltp)}
                      </span>
                    </td>

                    {/* Net Change */}
                    <td className="py-3.5 px-3 text-right font-mono font-semibold">
                      <span className={isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                        {isUp ? '+' : ''}{item.netChange.toFixed(2)}
                      </span>
                    </td>

                    {/* % Change Pill */}
                    <td className="py-3.5 px-3 text-right">
                      <ChangePill value={item.percentChange} size="sm" />
                    </td>

                    {/* Volume */}
                    <td className="py-3.5 px-3 text-right font-mono text-gray-600 dark:text-gray-300 font-medium">
                      {formatCompactQty(item.tradeVolume)}
                    </td>

                    {/* OI */}
                    <td className="py-3.5 px-3 text-right font-mono text-gray-600 dark:text-gray-300 font-medium">
                      {formatCompactQty(item.opnInterest)}
                    </td>

                    {/* Day Range Bar */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="w-24 mx-auto">
                        <DayRangeBar
                          current={item.ltp}
                          low={item.low}
                          high={item.high}
                          showLabels={true}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FnoTableView;
