import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calendar,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Target,
} from 'lucide-react';
import { useOptionChain } from '../../hooks/useMarket';
import type { OptionContractDetails } from '../../types';
import { formatINR, formatCompactQty, formatNumber } from '../../utils/formatters';
import { getSocket, type RealtimeTickData } from '../../services/socketService';

export interface OptionChainViewProps {
  onSelectContract?: (symbol: string, token?: string, contractData?: any) => void;
}

const MAJOR_UNDERLYINGS = [
  { id: 'NIFTY', label: 'NIFTY 50' },
  { id: 'BANKNIFTY', label: 'BANK NIFTY' },
  { id: 'FINNIFTY', label: 'FIN NIFTY' },
  { id: 'MIDCPNIFTY', label: 'MIDCAP NIFTY' },
];

export const OptionChainView: React.FC<OptionChainViewProps> = ({ onSelectContract }) => {
  const [underlying, setUnderlying] = useState<string>('NIFTY');
  const [customSearch, setCustomSearch] = useState<string>('');
  const [selectedExpiry, setSelectedExpiry] = useState<string>('');
  const [strikeRange, setStrikeRange] = useState<number>(12);

  const { data: chainData, isLoading, isFetching, isError, error, refetch } = useOptionChain({
    underlying,
    expiry: selectedExpiry || undefined,
    strikeCount: strikeRange,
  });

  // Local live tick updates for active option tokens
  const [liveTicks, setLiveTicks] = useState<Record<string, { ltp: number; change?: number; percentChange?: number }>>({});
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastPrices = useRef<Record<string, number>>({});

  // Sync selectedExpiry if empty
  useEffect(() => {
    if (chainData?.selectedExpiry && !selectedExpiry) {
      setSelectedExpiry(chainData.selectedExpiry);
    }
  }, [chainData?.selectedExpiry, selectedExpiry]);

  // WebSocket Live Stream for Option Chain Strikes
  useEffect(() => {
    const socket = getSocket();

    const handleTick = (tick: RealtimeTickData) => {
      const token = tick.symbolToken ? String(tick.symbolToken).trim() : '';
      const symbol = tick.tradingSymbol ? String(tick.tradingSymbol).trim().toUpperCase() : '';
      const key = token || symbol;
      if (!key) return;

      const freshLtp = Number(tick.ltp);
      if (!freshLtp || isNaN(freshLtp)) return;

      const prevPrice = lastPrices.current[key];
      lastPrices.current[key] = freshLtp;
      if (token) lastPrices.current[token] = freshLtp;
      if (symbol) lastPrices.current[symbol] = freshLtp;

      // Only flash if price actually changed!
      if (prevPrice !== undefined && freshLtp !== prevPrice) {
        const direction: 'up' | 'down' = freshLtp > prevPrice ? 'up' : 'down';
        setFlashes((prev) => ({
          ...prev,
          ...(token ? { [token]: direction } : {}),
          ...(symbol ? { [symbol]: direction } : {}),
        }));

        if (flashTimers.current[key]) {
          clearTimeout(flashTimers.current[key]);
        }
        flashTimers.current[key] = setTimeout(() => {
          setFlashes((prev) => {
            const next = { ...prev };
            if (token) delete next[token];
            if (symbol) delete next[symbol];
            return next;
          });
        }, 800);
      }

      setLiveTicks((prev) => ({
        ...prev,
        ...(token ? { [token]: { ltp: freshLtp, change: tick.change, percentChange: tick.percentChange } } : {}),
        ...(symbol ? { [symbol]: { ltp: freshLtp, change: tick.change, percentChange: tick.percentChange } } : {}),
      }));
    };

    socket.on('fno_tick', handleTick);
    socket.on('ai_price_tick', handleTick);

    return () => {
      socket.off('fno_tick', handleTick);
      socket.off('ai_price_tick', handleTick);
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, []);

  const handleUnderlyingChange = (val: string) => {
    setUnderlying(val);
    setSelectedExpiry('');
  };

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (customSearch.trim()) {
      setUnderlying(customSearch.trim().toUpperCase());
      setSelectedExpiry('');
      setCustomSearch('');
    }
  };

  const handleContractClick = (contract?: OptionContractDetails) => {
    if (!contract || !onSelectContract) return;
    const live = liveTicks[contract.symbolToken] || liveTicks[contract.tradingSymbol];
    onSelectContract(contract.tradingSymbol, contract.symbolToken, {
      ltp: live?.ltp ?? contract.ltp,
      netChange: live?.change ?? contract.netChange,
      percentChange: live?.percentChange ?? contract.percentChange,
      open: contract.open,
      high: contract.high,
      low: contract.low,
      close: contract.close,
      tradeVolume: contract.tradeVolume,
      opnInterest: contract.opnInterest,
      strike: contract.strike,
      expiry: contract.expiry,
      instrumentType: contract.instrumentType,
    });
  };

  // Find max OI across all rows to render proportional depth bars
  const maxOI = useMemo(() => {
    if (!chainData?.rows) return 1;
    let max = 1;
    for (const r of chainData.rows) {
      if (r.call?.opnInterest && r.call.opnInterest > max) max = r.call.opnInterest;
      if (r.put?.opnInterest && r.put.opnInterest > max) max = r.put.opnInterest;
    }
    return max;
  }, [chainData?.rows]);

  if (isLoading && !chainData) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-3xl w-full" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
        <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
      </div>
    );
  }

  if (isError && !chainData) {
    return (
      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load Option Chain</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{(error as any)?.message || 'Unknown network error'}</p>
        </div>
        <button
          onClick={() => refetch()}
          type="button"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl"
        >
          Retry
        </button>
      </div>
    );
  }

  const spot = chainData?.spotPrice ?? 0;
  const spotChange = chainData?.spotChange ?? 0;
  const spotPct = chainData?.spotPercentChange ?? 0;
  const isSpotUp = spotChange >= 0;
  const pcr = chainData?.pcr ?? 1.0;
  const pcrSentiment = chainData?.pcrSentiment ?? 'NEUTRAL';
  const totalCallOI = chainData?.totalCallOI ?? 0;
  const totalPutOI = chainData?.totalPutOI ?? 0;
  const combinedOI = totalCallOI + totalPutOI || 1;
  const callOIPct = Math.round((totalCallOI / combinedOI) * 100);
  const putOIPct = Math.round((totalPutOI / combinedOI) * 100);

  return (
    <div className="space-y-4 font-sans">
      {/* 1. Control & Filter Deck */}
      <div className="bg-white dark:bg-gray-800 p-4 sm:p-5 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          {/* Underlying Selection Pills */}
          <div className="flex flex-wrap items-center gap-2">
            {MAJOR_UNDERLYINGS.map((idx) => (
              <button
                key={idx.id}
                type="button"
                onClick={() => handleUnderlyingChange(idx.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                  underlying === idx.id
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/25 ring-2 ring-blue-400/40'
                    : 'bg-gray-100 dark:bg-gray-700/60 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                {idx.label}
              </button>
            ))}

            {/* Custom Scrip Search Form */}
            <form onSubmit={handleCustomSearchSubmit} className="relative flex items-center">
              <input
                type="text"
                placeholder="Stock Symbol..."
                value={customSearch}
                onChange={(e) => setCustomSearch(e.target.value)}
                className="w-32 sm:w-36 px-2.5 py-1.5 pl-7 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white uppercase font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 pointer-events-none" />
            </form>
          </div>

          {/* Expiry Selector, Strike Range & Refresh */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Expiry Dropdown */}
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Expiry:</span>
              <select
                value={selectedExpiry || chainData?.selectedExpiry || ''}
                onChange={(e) => setSelectedExpiry(e.target.value)}
                className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
              >
                {(chainData?.availableExpiries || []).map((exp) => (
                  <option key={exp} value={exp} className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white">
                    {exp}
                  </option>
                ))}
              </select>
            </div>

            {/* Strike Range Selector */}
            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-gray-900 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700">
              <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400">Strikes:</span>
              <select
                value={strikeRange}
                onChange={(e) => setStrikeRange(Number(e.target.value))}
                className="bg-transparent text-xs font-bold text-gray-900 dark:text-white focus:outline-none cursor-pointer"
              >
                <option value={8} className="bg-white dark:bg-gray-800">±8 Strikes</option>
                <option value={12} className="bg-white dark:bg-gray-800">±12 Strikes</option>
                <option value={16} className="bg-white dark:bg-gray-800">±16 Strikes</option>
                <option value={20} className="bg-white dark:bg-gray-800">±20 Strikes</option>
              </select>
            </div>

            {/* Refresh Action */}
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              type="button"
              className="p-2 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 text-blue-600 dark:text-blue-400 rounded-xl transition-all disabled:opacity-50"
              title="Refresh Option Chain"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* 2. Key Metrics Telemetry Banner */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-gray-100 dark:border-gray-700/60">
          {/* Spot Price */}
          <div className="p-3 bg-gray-50/70 dark:bg-gray-900/60 rounded-2xl border border-gray-200/70 dark:border-gray-700/60">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
              {underlying} Spot
            </span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base sm:text-lg font-black font-mono text-gray-900 dark:text-white">
                {formatINR(spot)}
              </span>
              <span
                className={`text-xs font-bold font-mono ${
                  isSpotUp ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isSpotUp ? '+' : ''}{spotChange.toFixed(2)} ({isSpotUp ? '+' : ''}{spotPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Put-Call Ratio (PCR) */}
          <div className="p-3 bg-gray-50/70 dark:bg-gray-900/60 rounded-2xl border border-gray-200/70 dark:border-gray-700/60">
            <div className="flex justify-between items-center">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
                PCR (Put/Call)
              </span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  pcrSentiment === 'BULLISH'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                    : pcrSentiment === 'BEARISH'
                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                }`}
              >
                {pcrSentiment}
              </span>
            </div>
            <div className="mt-0.5 text-base sm:text-lg font-black font-mono text-gray-900 dark:text-white">
              {pcr.toFixed(2)}
              <span className="text-[11px] font-normal text-gray-400 ml-1.5">
                {pcr > 1.2 ? 'Heavy Put Support' : pcr < 0.8 ? 'Heavy Call Resistance' : 'Balanced'}
              </span>
            </div>
          </div>

          {/* Max Pain Strike */}
          <div className="p-3 bg-gray-50/70 dark:bg-gray-900/60 rounded-2xl border border-gray-200/70 dark:border-gray-700/60">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider flex items-center gap-1">
              <Target className="w-3 h-3 text-purple-500" />
              <span>Max Pain Strike</span>
            </span>
            <div className="mt-0.5 text-base sm:text-lg font-black font-mono text-purple-600 dark:text-purple-400">
              {chainData?.maxPainStrike ? formatNumber(chainData.maxPainStrike, 0) : '—'}
              <span className="text-[11px] font-normal text-gray-400 ml-1.5 font-sans">
                ATM: {chainData?.atmStrike ? formatNumber(chainData.atmStrike, 0) : '—'}
              </span>
            </div>
          </div>

          {/* Total OI Call vs Put Split */}
          <div className="p-3 bg-gray-50/70 dark:bg-gray-900/60 rounded-2xl border border-gray-200/70 dark:border-gray-700/60">
            <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">
              Total Open Interest
            </span>
            <div className="mt-1 flex items-center justify-between text-xs font-mono font-bold">
              <span className="text-emerald-600 dark:text-emerald-400">CE: {callOIPct}%</span>
              <span className="text-rose-600 dark:text-rose-400">PE: {putOIPct}%</span>
            </div>
            <div className="w-full bg-rose-200 dark:bg-rose-950 h-1.5 rounded-full overflow-hidden mt-1 flex">
              <div
                className="bg-emerald-500 h-full transition-all duration-500"
                style={{ width: `${callOIPct}%` }}
              />
              <div
                className="bg-rose-500 h-full transition-all duration-500"
                style={{ width: `${putOIPct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Two-Sided Option Chain Matrix */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-xs overflow-hidden">
        {/* Table Top Header Labels */}
        <div className="grid grid-cols-11 bg-gray-100/90 dark:bg-gray-750/90 border-b border-gray-200 dark:border-gray-700 text-center font-bold text-xs uppercase tracking-wider py-2">
          <div className="col-span-5 text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>CALL OPTIONS (CE)</span>
          </div>
          <div className="col-span-1 text-gray-900 dark:text-white font-extrabold flex items-center justify-center">
            <span>STRIKE</span>
          </div>
          <div className="col-span-5 text-rose-700 dark:text-rose-400 flex items-center justify-center gap-1.5">
            <TrendingDown className="w-3.5 h-3.5" />
            <span>PUT OPTIONS (PE)</span>
          </div>
        </div>

        {/* Scrollable Matrix Table */}
        <div className="overflow-x-auto max-h-[700px] overflow-y-auto">
          <table className="w-full text-xs text-left border-collapse font-sans">
            <thead className="bg-gray-50/90 dark:bg-gray-700/70 text-[10px] uppercase font-bold text-gray-400 tracking-wider sticky top-0 z-10 backdrop-blur-xs border-b border-gray-200 dark:border-gray-700">
              <tr>
                {/* Calls Headers */}
                <th className="py-2.5 px-3 text-right">OI (Shares)</th>
                <th className="py-2.5 px-2.5 text-right hidden md:table-cell">Volume</th>
                <th className="py-2.5 px-2 text-right hidden lg:table-cell">IV</th>
                <th className="py-2.5 px-2 text-right hidden sm:table-cell">Delta (Δ)</th>
                <th className="py-2.5 px-2.5 text-right hidden sm:table-cell">Net Chg</th>
                <th className="py-2.5 px-3 text-right bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 font-extrabold">
                  Call LTP
                </th>

                {/* Strike Center Header */}
                <th className="py-2.5 px-3 text-center bg-gray-200 dark:bg-gray-700 font-black text-gray-900 dark:text-white">
                  Strike
                </th>

                {/* Puts Headers */}
                <th className="py-2.5 px-3 text-left bg-rose-500/10 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-extrabold">
                  Put LTP
                </th>
                <th className="py-2.5 px-2.5 text-left hidden sm:table-cell">Net Chg</th>
                <th className="py-2.5 px-2 text-left hidden sm:table-cell">Delta (Δ)</th>
                <th className="py-2.5 px-2 text-left hidden lg:table-cell">IV</th>
                <th className="py-2.5 px-2.5 text-left hidden md:table-cell">Volume</th>
                <th className="py-2.5 px-3 text-left">OI (Shares)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-mono text-[11px]">
              {(chainData?.rows || []).map((row) => {
                const isAtm = row.isAtm;
                const call = row.call;
                const put = row.put;

                // Live dynamic ticks
                const callLive = call ? liveTicks[call.symbolToken] || liveTicks[call.tradingSymbol] : undefined;
                const putLive = put ? liveTicks[put.symbolToken] || liveTicks[put.tradingSymbol] : undefined;

                const callLtp = callLive?.ltp ?? call?.ltp ?? 0;
                const callChg = callLive?.change ?? call?.netChange ?? 0;
                const callPct = callLive?.percentChange ?? call?.percentChange ?? 0;

                const putLtp = putLive?.ltp ?? put?.ltp ?? 0;
                const putChg = putLive?.change ?? put?.netChange ?? 0;
                const putPct = putLive?.percentChange ?? put?.percentChange ?? 0;

                const callFlash = call ? flashes[call.symbolToken] || flashes[call.tradingSymbol] : undefined;
                const putFlash = put ? flashes[put.symbolToken] || flashes[put.tradingSymbol] : undefined;

                // Visual OI depth bars
                const callOiRatio = call?.opnInterest ? Math.min(100, (call.opnInterest / maxOI) * 100) : 0;
                const putOiRatio = put?.opnInterest ? Math.min(100, (put.opnInterest / maxOI) * 100) : 0;

                // ITM shading: standard yellow/amber shading for ITM options
                const callItmBg = call?.isItm
                  ? 'bg-amber-500/10 dark:bg-amber-400/5'
                  : 'bg-white dark:bg-gray-800';

                const putItmBg = put?.isItm
                  ? 'bg-amber-500/10 dark:bg-amber-400/5'
                  : 'bg-white dark:bg-gray-800';

                return (
                  <tr
                    key={row.strike}
                    className={`hover:bg-blue-50/50 dark:hover:bg-blue-900/15 transition-colors ${
                      isAtm ? 'ring-2 ring-blue-500/60 dark:ring-blue-400/60 bg-blue-500/10 dark:bg-blue-950/40 z-1 font-bold' : ''
                    }`}
                  >
                    {/* CALL: OI */}
                    <td className={`py-2 px-3 text-right relative ${callItmBg}`}>
                      <div
                        className="absolute right-0 top-0 bottom-0 bg-emerald-500/15 pointer-events-none"
                        style={{ width: `${callOiRatio}%` }}
                      />
                      <span className="relative z-1 font-semibold text-gray-700 dark:text-gray-300">
                        {call?.opnInterest ? formatCompactQty(call.opnInterest) : '—'}
                      </span>
                    </td>

                    {/* CALL: Volume */}
                    <td className={`py-2 px-2.5 text-right text-gray-500 dark:text-gray-400 hidden md:table-cell ${callItmBg}`}>
                      {call?.tradeVolume ? formatCompactQty(call.tradeVolume) : '—'}
                    </td>

                    {/* CALL: IV */}
                    <td className={`py-2 px-2 text-right text-purple-600 dark:text-purple-400 font-semibold hidden lg:table-cell ${callItmBg}`}>
                      {call?.greeks?.iv ? `${call.greeks.iv.toFixed(1)}%` : '—'}
                    </td>

                    {/* CALL: Delta */}
                    <td className={`py-2 px-2 text-right text-emerald-700 dark:text-emerald-400 font-bold hidden sm:table-cell ${callItmBg}`}>
                      {call?.greeks?.delta !== undefined ? call.greeks.delta.toFixed(2) : '—'}
                    </td>

                    {/* CALL: Net Change */}
                    <td
                      className={`py-2 px-2.5 text-right font-semibold hidden sm:table-cell ${
                        callChg >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      } ${callItmBg}`}
                    >
                      <div>{callChg > 0 ? '+' : ''}{callChg.toFixed(2)}</div>
                      <div className="text-[9px] opacity-75">{callPct > 0 ? '+' : ''}{callPct.toFixed(1)}%</div>
                    </td>

                    {/* CALL: LTP (Interactive Click to Inspect/Buy) */}
                    <td
                      onClick={() => handleContractClick(call)}
                      className={`py-2 px-3 text-right cursor-pointer group/call transition-all ${
                        callFlash === 'up'
                          ? 'bg-emerald-500/30 font-black'
                          : callFlash === 'down'
                          ? 'bg-rose-500/30 font-black'
                          : 'bg-emerald-500/10 dark:bg-emerald-950/20 hover:bg-emerald-500/25'
                      }`}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span className="font-extrabold text-xs text-emerald-700 dark:text-emerald-300 group-hover/call:underline">
                          {callLtp > 0 ? formatINR(callLtp) : '—'}
                        </span>
                      </div>
                    </td>

                    {/* CENTER: Strike Price */}
                    <td
                      className={`py-2 px-3 text-center font-black text-xs select-none border-x border-gray-200 dark:border-gray-700 ${
                        isAtm
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'bg-gray-100 dark:bg-gray-750 text-gray-900 dark:text-white'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>{formatNumber(row.strike, 0)}</span>
                        {isAtm && (
                          <span className="text-[9px] px-1 py-0.2 bg-white/25 rounded uppercase tracking-tighter">
                            ATM
                          </span>
                        )}
                      </div>
                    </td>

                    {/* PUT: LTP (Interactive Click to Inspect/Buy) */}
                    <td
                      onClick={() => handleContractClick(put)}
                      className={`py-2 px-3 text-left cursor-pointer group/put transition-all ${
                        putFlash === 'up'
                          ? 'bg-emerald-500/30 font-black'
                          : putFlash === 'down'
                          ? 'bg-rose-500/30 font-black'
                          : 'bg-rose-500/10 dark:bg-rose-950/20 hover:bg-rose-500/25'
                      }`}
                    >
                      <div className="flex items-center justify-start gap-1">
                        <span className="font-extrabold text-xs text-rose-700 dark:text-rose-300 group-hover/put:underline">
                          {putLtp > 0 ? formatINR(putLtp) : '—'}
                        </span>
                      </div>
                    </td>

                    {/* PUT: Net Change */}
                    <td
                      className={`py-2 px-2.5 text-left font-semibold hidden sm:table-cell ${
                        putChg >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      } ${putItmBg}`}
                    >
                      <div>{putChg > 0 ? '+' : ''}{putChg.toFixed(2)}</div>
                      <div className="text-[9px] opacity-75">{putPct > 0 ? '+' : ''}{putPct.toFixed(1)}%</div>
                    </td>

                    {/* PUT: Delta */}
                    <td className={`py-2 px-2 text-left text-rose-700 dark:text-rose-400 font-bold hidden sm:table-cell ${putItmBg}`}>
                      {put?.greeks?.delta !== undefined ? put.greeks.delta.toFixed(2) : '—'}
                    </td>

                    {/* PUT: IV */}
                    <td className={`py-2 px-2 text-left text-purple-600 dark:text-purple-400 font-semibold hidden lg:table-cell ${putItmBg}`}>
                      {put?.greeks?.iv ? `${put.greeks.iv.toFixed(1)}%` : '—'}
                    </td>

                    {/* PUT: Volume */}
                    <td className={`py-2 px-2.5 text-left text-gray-500 dark:text-gray-400 hidden md:table-cell ${putItmBg}`}>
                      {put?.tradeVolume ? formatCompactQty(put.tradeVolume) : '—'}
                    </td>

                    {/* PUT: OI */}
                    <td className={`py-2 px-3 text-left relative ${putItmBg}`}>
                      <div
                        className="absolute left-0 top-0 bottom-0 bg-rose-500/15 pointer-events-none"
                        style={{ width: `${putOiRatio}%` }}
                      />
                      <span className="relative z-1 font-semibold text-gray-700 dark:text-gray-300">
                        {put?.opnInterest ? formatCompactQty(put.opnInterest) : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Matrix Footer Legend */}
        <div className="p-3 bg-gray-50 dark:bg-gray-900/60 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 flex flex-wrap justify-between items-center gap-2 font-sans">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-400/40" />
              <span>In-The-Money (ITM) Shaded</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-blue-600 text-[9px] text-white font-bold flex items-center justify-center">
                •
              </span>
              <span>At-The-Money (ATM)</span>
            </span>
          </div>
          <div className="text-[11px] font-mono">
            Lot Size: {chainData?.lotSize || 50} shares • Greeks evaluated via Black-Scholes engine
          </div>
        </div>
      </div>
    </div>
  );
};

export default OptionChainView;
