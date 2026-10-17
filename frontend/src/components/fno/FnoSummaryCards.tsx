import React from 'react';
import { Flame, TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { FnoMoversSummary, FnoMoverItem } from '../../types';
import InstrumentBadge from '../common/InstrumentBadge';
import ChangePill from '../common/ChangePill';
import { formatINR } from '../../utils/formatters';

export interface FnoSummaryCardsProps {
  summary?: FnoMoversSummary;
  onSelectContract?: (contract: FnoMoverItem) => void;
}

export const FnoSummaryCards: React.FC<FnoSummaryCardsProps> = ({
  summary,
  onSelectContract,
}) => {
  if (!summary) return null;

  const totalBreadth = summary.gainersCount + summary.losersCount;
  const gainersRatio = totalBreadth > 0 ? (summary.gainersCount / totalBreadth) * 100 : 50;
  const losersRatio = totalBreadth > 0 ? (summary.losersCount / totalBreadth) * 100 : 50;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. Most Volatile */}
      <div
        onClick={() => summary.mostVolatile && onSelectContract?.(summary.mostVolatile)}
        className="bg-gradient-to-br from-indigo-50/70 to-blue-50/70 dark:from-indigo-950/30 dark:to-blue-900/20 border border-indigo-200 dark:border-indigo-800/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
      >
        <div className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          <span>Most Volatile Contract</span>
        </div>
        {summary.mostVolatile ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold truncate text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                {summary.mostVolatile.tradingSymbol}
              </span>
              <InstrumentBadge type={summary.mostVolatile.instrumentType} />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl font-extrabold font-mono text-gray-900 dark:text-white">
                {formatINR(summary.mostVolatile.ltp)}
              </span>
              <ChangePill value={summary.mostVolatile.percentChange} size="xs" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 mt-2">No active mover</div>
        )}
      </div>

      {/* 2. Top Gainer (Ups) */}
      <div
        onClick={() => summary.topGainer && onSelectContract?.(summary.topGainer)}
        className="bg-gradient-to-br from-emerald-50/70 to-teal-50/70 dark:from-emerald-950/30 dark:to-teal-900/20 border border-emerald-200 dark:border-emerald-800/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Top Gainer (Ups)</span>
        </div>
        {summary.topGainer ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold truncate text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                {summary.topGainer.tradingSymbol}
              </span>
              <InstrumentBadge type={summary.topGainer.instrumentType} />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl font-extrabold font-mono text-gray-900 dark:text-white">
                {formatINR(summary.topGainer.ltp)}
              </span>
              <ChangePill value={summary.topGainer.percentChange} size="xs" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 mt-2">No active gainer</div>
        )}
      </div>

      {/* 3. Top Loser (Downs) */}
      <div
        onClick={() => summary.topLoser && onSelectContract?.(summary.topLoser)}
        className="bg-gradient-to-br from-rose-50/70 to-orange-50/70 dark:from-rose-950/30 dark:to-orange-900/20 border border-rose-200 dark:border-rose-800/60 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer group"
      >
        <div className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 tracking-wider flex items-center gap-1.5">
          <TrendingDown className="w-3.5 h-3.5" />
          <span>Top Loser (Downs)</span>
        </div>
        {summary.topLoser ? (
          <div className="mt-2.5">
            <div className="flex items-center justify-between gap-1">
              <span className="text-xs font-bold truncate text-gray-900 dark:text-white group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
                {summary.topLoser.tradingSymbol}
              </span>
              <InstrumentBadge type={summary.topLoser.instrumentType} />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-xl font-extrabold font-mono text-gray-900 dark:text-white">
                {formatINR(summary.topLoser.ltp)}
              </span>
              <ChangePill value={summary.topLoser.percentChange} size="xs" />
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 mt-2">No active loser</div>
        )}
      </div>

      {/* 4. Market Breadth & Sentiment */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-sm flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span>F&O Breadth</span>
          </span>
          <span
            className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
              summary.marketSentiment === 'BULLISH'
                ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                : summary.marketSentiment === 'BEARISH'
                ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
          >
            {summary.marketSentiment}
          </span>
        </div>

        <div className="space-y-1.5 mt-2">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-emerald-600 dark:text-emerald-400">
              {summary.gainersCount} Ups
            </span>
            <span className="text-rose-600 dark:text-rose-400">
              {summary.losersCount} Downs
            </span>
          </div>

          {/* Ratio bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 h-2 rounded-full overflow-hidden flex">
            <div
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${gainersRatio}%` }}
              title={`Ups: ${summary.gainersCount}`}
            />
            <div
              className="bg-rose-500 h-full transition-all duration-300"
              style={{ width: `${losersRatio}%` }}
              title={`Downs: ${summary.losersCount}`}
            />
          </div>

          <div className="flex justify-between text-[10px] text-gray-400 font-medium pt-0.5">
            <span>{summary.callsCount} Calls</span>
            <span>{summary.putsCount} Puts</span>
            <span>{summary.futuresCount} FUT</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FnoSummaryCards;
