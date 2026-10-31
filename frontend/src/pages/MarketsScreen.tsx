import React, { useState } from 'react';
import { useNiftyQuote, useMajorIndices } from '../hooks/useMarket';
import { useRealtimeMarket } from '../hooks/useRealtimeMarket';
import MarketStatusBadge from '../components/common/MarketStatusBadge';
import MarketClosedBanner from '../components/common/MarketClosedBanner';
import ChangePill from '../components/common/ChangePill';
import DayRangeBar from '../components/common/DayRangeBar';
import { formatINR, formatCompactQty } from '../utils/formatters';
import { Zap, ArrowRight, RefreshCw, BarChart2, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import { useAppStore } from '../store';
import type { NiftyQuote } from '../types';

interface MarketsScreenProps {
  onNavigateFno?: () => void;
}

export const MarketsScreen: React.FC<MarketsScreenProps> = ({ onNavigateFno }) => {
  const [selectedToken, setSelectedToken] = useState<string>('99926000');
  const niftyQuery = useNiftyQuote();
  const indicesQuery = useMajorIndices();
  const setActiveView = useAppStore((state) => state.setActiveView);

  // Real-time market WebSocket subscriber
  const { isConnected, lastMarketTickTime, flashes, requestLiveRefresh } = useRealtimeMarket();

  const handleNavigateFno = () => {
    if (onNavigateFno) onNavigateFno();
    else setActiveView('fno');
  };

  const handleManualRefresh = () => {
    niftyQuery.refetch();
    indicesQuery.refetch();
    requestLiveRefresh();
  };

  // Determine the active index quote
  const activeQuote: NiftyQuote | undefined = React.useMemo(() => {
    const list = indicesQuery.data || [];
    const found = list.find((item) => item.symbolToken === selectedToken);
    if (found) return found;
    return niftyQuery.data;
  }, [indicesQuery.data, selectedToken, niftyQuery.data]);

  const isUp = (Number(activeQuote?.percentChange) || 0) >= 0;

  const activeTokenKey = activeQuote?.symbolToken || selectedToken;
  const activeFlash = flashes[activeTokenKey] || flashes[activeQuote?.tradingSymbol || ''];
  const isRecentFlash = activeFlash && Date.now() - activeFlash.timestamp < 2500;

  if (niftyQuery.isLoading && !indicesQuery.data) {
    return (
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-3xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
        </div>
        <div className="h-44 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
      </div>
    );
  }

  if (niftyQuery.isError && !indicesQuery.data) {
    return (
      <div className="max-w-5xl mx-auto bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 shadow-xs flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load live market quotes</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{niftyQuery.error?.message}</p>
        </div>
        <button
          onClick={handleManualRefresh}
          type="button"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
        >
          Retry Fetching
        </button>
      </div>
    );
  }

  const ohlcStats = [
    { label: 'Open', value: activeQuote?.open },
    { label: 'High', value: activeQuote?.high, cls: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Low', value: activeQuote?.low, cls: 'text-rose-600 dark:text-rose-400' },
    { label: 'Prev Close', value: activeQuote?.close },
  ];

  const majorIndicesList = indicesQuery.data || [
    {
      name: 'NIFTY 50',
      symbolToken: '99926000',
      tradingSymbol: 'Nifty 50',
      ltp: niftyQuery.data?.ltp || 0,
      netChange: niftyQuery.data?.netChange || 0,
      percentChange: niftyQuery.data?.percentChange || 0,
      exchange: 'NSE',
    },
  ];

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6 font-sans">
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
              Track real-time market swings across Futures, Calls (CE), and Puts (PE)
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

      {/* Header bar with Live Stream Connection Status */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-white">
                Live Market Benchmarks
              </h2>
              <MarketStatusBadge />

              {/* Real-time WebSocket connection badge */}
              <span
                className={`text-[11px] px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                  isConnected
                    ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                {isConnected ? 'Angel One Live Stream Connected' : 'Connecting to Stream...'}
              </span>

              {lastMarketTickTime && (
                <span className="text-[10px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  Live Tick: {lastMarketTickTime}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              National Stock Exchange of India (NSE) · Live Quote Stream via Angel One SmartAPI
            </p>
          </div>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={niftyQuery.isFetching || indicesQuery.isFetching}
          type="button"
          className="p-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 flex items-center gap-2 shadow-xs"
          title="Refresh live market quotes"
        >
          <RefreshCw className={`w-4 h-4 ${niftyQuery.isFetching || indicesQuery.isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh Live</span>
        </button>
      </div>

      {/* Major Benchmark Indices Live Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {majorIndicesList.map((idx) => {
          const isSelected = (idx.symbolToken || '') === selectedToken;
          const idxUp = (Number(idx.percentChange) || 0) >= 0;
          const flash = flashes[idx.symbolToken || ''] || flashes[idx.tradingSymbol || ''];
          const flashActive = flash && Date.now() - flash.timestamp < 2500;

          return (
            <div
              key={idx.symbolToken || idx.tradingSymbol}
              onClick={() => setSelectedToken(idx.symbolToken || '99926000')}
              className={`p-4 rounded-3xl border transition-all cursor-pointer shadow-xs ${
                isSelected
                  ? 'bg-blue-50/70 dark:bg-blue-950/40 border-blue-500 dark:border-blue-500 ring-2 ring-blue-500/20 shadow-md'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700/80 hover:border-blue-300 dark:hover:border-blue-700'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
                    {idx.exchange || 'NSE'} Index
                  </span>
                  <span className="text-base font-extrabold text-gray-900 dark:text-white">
                    {idx.name || idx.tradingSymbol}
                  </span>
                </div>
                <span
                  className={`p-1.5 rounded-xl ${
                    idxUp
                      ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {idxUp ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                </span>
              </div>

              <div className="mt-3 flex items-baseline justify-between">
                <span
                  className={`text-xl font-extrabold font-mono transition-all duration-300 rounded px-1 ${
                    flashActive
                      ? flash.direction === 'up'
                        ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300'
                      : 'text-gray-900 dark:text-white'
                  }`}
                >
                  {formatINR(idx.ltp)}
                </span>
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    idxUp
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {idxUp ? '+' : ''}
                  {Number(idx.percentChange || 0).toFixed(2)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Market Closed Banner with Reason */}
      <MarketClosedBanner segmentName="NSE Equity Market" />

      {/* Active Selected Index Spot Hero Card */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-3xl p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wider">Spot Index Live Feed</div>
            <div className="text-2xl font-extrabold text-gray-900 dark:text-white mt-0.5">
              {activeQuote?.name || activeQuote?.tradingSymbol || 'NIFTY 50'}
            </div>
            <span className="inline-block mt-1 px-2.5 py-0.5 text-[10px] font-extrabold bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
              {activeQuote?.exchange || 'NSE'} · SPOT INDEX
            </span>
          </div>

          <div className="text-right">
            {/* Live LTP with Flash Indicator */}
            <div
              className={`text-4xl font-extrabold font-mono transition-all duration-300 rounded px-2 ${
                isRecentFlash
                  ? activeFlash.direction === 'up'
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 ring-2 ring-emerald-500'
                    : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 ring-2 ring-rose-500'
                  : isUp
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {formatINR(activeQuote?.ltp)}
            </div>
            <div className="mt-1 flex items-center justify-end gap-1.5">
              <ChangePill
                value={Number(activeQuote?.percentChange) || 0}
                absoluteValue={activeQuote?.netChange !== null && activeQuote?.netChange !== undefined ? Number(activeQuote.netChange) : undefined}
                size="md"
              />
            </div>
          </div>
        </div>

        {/* Intraday Range Progress Bar */}
        {activeQuote?.high && activeQuote?.low && Number(activeQuote.high) > Number(activeQuote.low) && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700/80">
            <div className="flex justify-between items-center text-[10px] uppercase font-bold text-gray-400 mb-1.5">
              <span>Day Range (Low — High)</span>
              <span className="font-mono text-gray-500">
                Spread: {formatINR(Number(activeQuote.high) - Number(activeQuote.low))}
              </span>
            </div>
            <DayRangeBar
              current={Number(activeQuote.ltp)}
              low={Number(activeQuote.low)}
              high={Number(activeQuote.high)}
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
            <span className="font-mono font-semibold">{formatINR(activeQuote?.avgPrice)}</span>
          </li>
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">Volume</span>
            <span className="font-mono font-semibold">{formatCompactQty(activeQuote?.tradeVolume)}</span>
          </li>
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">52-Week High</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatINR(activeQuote?.high52)}
            </span>
          </li>
          <li className="flex justify-between py-1 border-b border-gray-50 dark:border-gray-700/50">
            <span className="text-gray-400">52-Week Low</span>
            <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
              {formatINR(activeQuote?.low52)}
            </span>
          </li>
          <li className="flex justify-between py-1">
            <span className="text-gray-400">Symbol Token</span>
            <span className="font-mono">{activeQuote?.symbolToken || selectedToken}</span>
          </li>
          <li className="flex justify-between py-1">
            <span className="text-gray-400">Feed Time</span>
            <span className="font-mono">{activeQuote?.exchFeedTime || '—'}</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default MarketsScreen;
