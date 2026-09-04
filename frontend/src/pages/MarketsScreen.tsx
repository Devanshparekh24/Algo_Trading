import React from 'react';
import { useNiftyQuote } from '../hooks/useMarket';

export const MarketsScreen: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useNiftyQuote();

  const fmt = (val?: string | number | null, decimals = 2) => {
    if (val === undefined || val === null || val === '') return '—';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '—';
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
  };

  const change = (() => {
    const v = data?.percentChange ?? (data?.netChange ?? null);
    if (v === undefined || v === null || isNaN(v)) return { text: '—', pos: true };
    const text = `${v >= 0 ? '+' : ''}${v.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
    return { text, pos: v >= 0 };
  })();

  const isUp = data?.percentChange !== undefined && data?.percentChange !== null
    ? data.percentChange >= 0
    : change.pos;

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto animate-pulse">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/3 mb-6"></div>
        <div className="h-24 bg-gray-200 dark:bg-gray-700 rounded-3xl mb-4"></div>
        <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded-3xl"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-3xl mx-auto bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load Nifty 50 quote</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error?.message}</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
        >
          Retry Fetching
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 font-sans">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>Nifty 50</span> Live
        </h2>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          title="Refresh Nifty 50 quote"
        >
          <span className={isFetching ? 'animate-spin inline-block' : ''}>🔄</span>
        </button>
      </div>

      {/* Price Hero Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-extrabold text-gray-900 dark:text-white">NIFTY</div>
            <span className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
              {data?.exchange || 'NSE'} · index
            </span>
          </div>
          <div className="text-right">
            <div className={`text-4xl font-extrabold font-mono ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {fmt(data?.ltp)}
            </div>
            <div className={`text-xs font-bold font-mono ${isUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {change.text}
              {data?.percentChange !== undefined && data?.percentChange !== null
                ? ` (${(data.percentChange >= 0 ? '+' : '')}${data.percentChange.toFixed(2)}%)`
                : ''}
            </div>
          </div>
        </div>
      </div>

      {/* OHLC Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Open', value: data?.open },
          { label: 'High', value: data?.high, cls: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Low', value: data?.low, cls: 'text-rose-600 dark:text-rose-400' },
          { label: 'Prev Close', value: data?.close },
        ].map((cell) => (
          <div key={cell.label} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 text-center shadow-sm">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">{cell.label}</div>
            <div className={`text-lg font-bold font-mono mt-1 ${cell.cls || 'text-gray-900 dark:text-white'}`}>
              {fmt(cell.value)}
            </div>
          </div>
        ))}
      </div>

      {/* Session & Range Stats */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm space-y-3">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">Session & Range</h3>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs text-gray-600 dark:text-gray-300">
          <li className="flex justify-between">
            <span className="text-gray-400">Avg Price</span>
            <span className="font-mono">{fmt(data?.avgPrice)}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-400">Trade Volume</span>
            <span className="font-mono">{fmt(data?.tradeVolume, 0)}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-400">52-Week High</span>
            <span className="font-mono text-emerald-600 dark:text-emerald-400">{fmt(data?.high52)}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-400">52-Week Low</span>
            <span className="font-mono text-rose-600 dark:text-rose-400">{fmt(data?.low52)}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-400">Symbol Token</span>
            <span className="font-mono">{data?.symbolToken || '99926000'}</span>
          </li>
          <li className="flex justify-between">
            <span className="text-gray-400">Feed Time</span>
            <span className="font-mono">{data?.exchFeedTime || '—'}</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MarketsScreen;