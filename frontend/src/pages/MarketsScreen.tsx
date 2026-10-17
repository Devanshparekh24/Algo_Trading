import React from 'react';
import { useNiftyQuote } from '../hooks/useMarket';
import MarketStatusBadge from '../components/common/MarketStatusBadge';
import MarketClosedBanner from '../components/common/MarketClosedBanner';
import ChangePill from '../components/common/ChangePill';
import DayRangeBar from '../components/common/DayRangeBar';
import { formatINR, formatNumber, formatCompactQty } from '../utils/formatters';
import { Zap, ArrowRight, RefreshCw, BarChart2 } from 'lucide-react';
import { useAppStore } from '../store';

interface MarketsScreenProps {
  onNavigateFno?: () => void;
}

export const MarketsScreen: React.FC<MarketsScreenProps> = ({ onNavigateFno }) => {
  const { data, isLoading, isError, error, refetch, isFetching } = useNiftyQuote();
  const setActiveView = useAppStore((state) => state.setActiveView);

  const handleNavigateFno = () => {
    if (onNavigateFno) onNavigateFno();
    else setActiveView('fno');
  };

  const isUp = (data?.percentChange ?? 0) >= 0;

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6 animate-pulse">
        <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-3xl w-full" />
        <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-24 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
        <div className="h-48 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-4xl mx-auto bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load Nifty 50 quote</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error?.message}</p>
        </div>
        <button
          onClick={() => refetch()}
          type="button"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
        >
          Retry Fetching
        </button>
      </div>
    );
  }

  const ohlcStats = [
    { label: 'Open', value: data?.open },
    { label: 'High', value: data?.high, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Low', value: data?.low, cls: 'text-rose-600 dark:text-rose-400' },
    { label: 'Prev Close', value: data?.close },
  ];

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 font-sans">
      {/* Quick Link Banner to F&O Movers */}
      <div className="flex items-center justify-between bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800/80 p-4 rounded-3xl shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <Zap className="w-4 h-4 fill-current" />
          </div>
          <div>
            <div className="text-xs font-extrabold text-blue-900 dark:text-blue-100">
              Top Volatile F&O Movers
            </div>
            <div className="text-[11px] text-blue-700 dark:text-blue-300">
              Track real-time swings across Futures, Calls (CE), and Puts (PE)
            </div>
          </div>
        </div>
        <button
          onClick={handleNavigateFno}
          type="button"
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all hover:scale-105 flex items-center gap-1.5 shrink-0"
        >
          <span>Open F&O Tab</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Header bar */}
      <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                NIFTY 50 Benchmark
              </h2>
              <MarketStatusBadge />
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              National Stock Exchange of India (NSE) · Live Quote Stream
            </p>
          </div>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          type="button"
          className="p-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center justify-center text-gray-700 dark:text-gray-200 shadow-xs"
          title="Refresh Nifty 50 quote"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Market Closed Banner with Reason */}
      <MarketClosedBanner segmentName="NSE Equity Market" />

      {/* Price Hero Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Spot Index</div>
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">
              NIFTY 50
            </div>
            <span className="inline-block mt-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
              {data?.exchange || 'NSE'} · INDEX
            </span>
          </div>

          <div className="text-right">
            <div className={`text-4xl font-extrabold font-mono ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {formatINR(data?.ltp)}
            </div>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <ChangePill
                value={data?.percentChange ?? 0}
                absoluteValue={data?.netChange}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Intraday Range Progress Bar */}
        {data?.high && data?.low && data.high > data.low && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/80">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              <span>Day Range (Low — High)</span>
              <span className="font-mono text-gray-500">Spread: {formatINR(data.high - data.low)}</span>
            </div>
            <DayRangeBar
              current={data.ltp}
              low={data.low}
              high={data.high}
              formatFn={(v) => formatINR(v)}
            />
          </div>
        )}
      </div>

      {/* OHLC Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {ohlcStats.map((cell) => (
          <div
            key={cell.label}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 text-center shadow-xs"
          >
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
              {cell.label}
            </div>
            <div className={`text-lg font-bold font-mono mt-1 ${cell.cls || 'text-gray-900 dark:text-white'}`}>
              {formatINR(cell.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Session & Range Metadata */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs space-y-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          Session & Range Statistics
        </h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 text-xs text-gray-600 dark:text-gray-300">
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">Average Trade Price</span>
            <span className="font-mono font-semibold">{formatINR(data?.avgPrice)}</span>
          </li>
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">Volume</span>
            <span className="font-mono font-semibold">{formatCompactQty(data?.tradeVolume)}</span>
          </li>
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">52-Week High</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatINR(data?.high52)}
            </span>
          </li>
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">52-Week Low</span>
            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
              {formatINR(data?.low52)}
            </span>
          </li>
          <li className="flex justify-between py-1">
            <span className="text-gray-400">Symbol Token</span>
            <span className="font-mono">{data?.symbolToken || '99926000'}</span>
          </li>
          <li className="flex justify-between py-1">
            <span className="text-gray-400">Feed Time</span>
            <span className="font-mono">{data?.exchFeedTime || '—'}</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MarketsScreen;