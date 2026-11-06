import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Layers,
  Calendar,
  RefreshCw,
  Search,
  ExternalLink,
  Zap,
  Activity,
  Award,
  BarChart3,
  Flame,
} from 'lucide-react';
import { useGainersLosers } from '../../hooks/useMarket';
import {
  type GainersLosersDataType,
  type GainersLosersExpiryType,
} from '../../services/marketService';
import { formatINR, formatCompactQty } from '../../utils/formatters';
import { useAppStore } from '../../store';
import { getSocket, type RealtimeTickData } from '../../services/socketService';
import ChangePill from '../common/ChangePill';

export interface SmartApiGainersLosersViewProps {
  viewMode?: 'table' | 'cards';
  onSelectContract?: (symbol: string, token?: string, contractData?: any) => void;
}

const DATA_TYPES: { id: GainersLosersDataType; label: string; desc: string; icon: any; color: string }[] = [
  {
    id: 'PercPriceGainers',
    label: 'Price Gainers',
    desc: 'Top % price appreciation in derivatives',
    icon: TrendingUp,
    color: 'emerald',
  },
  {
    id: 'PercPriceLosers',
    label: 'Price Losers',
    desc: 'Top % price depreciation in derivatives',
    icon: TrendingDown,
    color: 'rose',
  },
  {
    id: 'PercOIGainers',
    label: 'OI Gainers',
    desc: 'Heavy Open Interest accumulation / buildup',
    icon: Layers,
    color: 'purple',
  },
  {
    id: 'PercOILosers',
    label: 'OI Losers',
    desc: 'Heavy Open Interest unwinding / profit-booking',
    icon: Flame,
    color: 'amber',
  },
];

const EXPIRY_TYPES: { id: GainersLosersExpiryType; label: string; desc: string }[] = [
  { id: 'NEAR', label: 'Near Month', desc: 'Current Month Expiry' },
  { id: 'NEXT', label: 'Next Month', desc: 'Next Month Expiry' },
  { id: 'FAR', label: 'Far Month', desc: 'Far Forward Expiry' },
];

export const SmartApiGainersLosersView: React.FC<SmartApiGainersLosersViewProps> = ({
  viewMode = 'table',
  onSelectContract,
}) => {
  const [datatype, setDatatype] = useState<GainersLosersDataType>('PercOIGainers');
  const [expirytype, setExpirytype] = useState<GainersLosersExpiryType>('NEAR');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const setActiveView = useAppStore((state) => state.setActiveView);

  const { data: rawItems, isLoading, isFetching, isError, error, refetch } = useGainersLosers({
    datatype,
    expirytype,
  });

  const [liveTicks, setLiveTicks] = useState<Record<string, { ltp: number; change?: number; percentChange?: number }>>({});
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastTickTime, setLastTickTime] = useState<string | null>(null);
  const [tickCount, setTickCount] = useState<number>(0);
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const lastPrices = useRef<Record<string, number>>({});

  // Sync initial LTP prices from server fetch
  useEffect(() => {
    if (rawItems && rawItems.length > 0) {
      for (const item of rawItems) {
        if (item.ltp && item.ltp > 0) {
          const token = String(item.symbolToken || '');
          const symbol = String(item.tradingSymbol || '').toUpperCase();
          if (token) lastPrices.current[token] = item.ltp;
          if (symbol) lastPrices.current[symbol] = item.ltp;
        }
      }
    }
  }, [rawItems]);

  // Connect to WebSocket for instant 1.5s live market ticks
  useEffect(() => {
    const socket = getSocket();

    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    const handleTick = (tick: RealtimeTickData) => {
      const token = tick.symbolToken ? String(tick.symbolToken).trim() : '';
      const symbol = tick.tradingSymbol ? String(tick.tradingSymbol).trim().toUpperCase() : '';
      const freshLtp = Number(tick.ltp);
      if (!freshLtp || isNaN(freshLtp)) return;

      const key = token || symbol;
      if (!key) return;

      setTickCount((c) => c + 1);
      setLastTickTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

      // Flash determination
      const prevPrice = lastPrices.current[key] ?? freshLtp;
      const direction: 'up' | 'down' = freshLtp >= prevPrice ? 'up' : 'down';
      lastPrices.current[key] = freshLtp;
      if (token) lastPrices.current[token] = freshLtp;
      if (symbol) lastPrices.current[symbol] = freshLtp;

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
      }, 1000);

      setLiveTicks((prev) => ({
        ...prev,
        ...(token ? { [token]: { ltp: freshLtp, change: tick.change, percentChange: tick.percentChange } } : {}),
        ...(symbol ? { [symbol]: { ltp: freshLtp, change: tick.change, percentChange: tick.percentChange } } : {}),
      }));
    };

    if (socket.connected) {
      setIsConnected(true);
    }

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('fno_tick', handleTick);
    socket.on('ai_price_tick', handleTick);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('fno_tick', handleTick);
      socket.off('ai_price_tick', handleTick);
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, []);

  const items = useMemo(() => rawItems || [], [rawItems]);

  // Client-side search filtering
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase().trim();
    return items.filter(
      (item) =>
        item.tradingSymbol?.toLowerCase().includes(q) ||
        String(item.symbolToken).toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  // Metric Computations
  const isOIQuery = datatype === 'PercOIGainers' || datatype === 'PercOILosers';
  const isGainers = datatype === 'PercPriceGainers' || datatype === 'PercOIGainers';

  const topItem = items[0] || null;
  const topItemToken = topItem ? String(topItem.symbolToken) : '';
  const topItemLive = topItemToken
    ? liveTicks[topItemToken] || (topItem?.tradingSymbol ? liveTicks[topItem.tradingSymbol] : undefined)
    : undefined;
  const topLiveLtp = topItemLive?.ltp ?? topItem?.ltp ?? 0;
  const topLiveChange = topItemLive?.change ?? topItem?.netChange ?? 0;
  const maxPercentChange = topItem ? topItem.percentChange : 0;
  const totalOI = items.reduce((sum, item) => sum + (Number(item.opnInterest) || 0), 0);
  const totalNetOIChange = items.reduce((sum, item) => sum + (Number(item.netChangeOpnInterest) || 0), 0);

  return (
    <div className="space-y-5 font-sans">
      {/* Control Banner: Datatype Pills & Expiry Selector */}
      <div className="p-5 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                <BarChart3 className="w-4 h-4" />
              </span>
              <h3 className="text-base font-bold text-gray-900 dark:text-white">
                Angel One SmartAPI: marketData/v1/gainersLosers
              </h3>
              {isConnected ? (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-400/50 text-emerald-700 dark:text-emerald-300 shadow-2xs">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  <span>WebSocket Live Stream (1.5s)</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                  <span>Connecting...</span>
                </span>
              )}
              {tickCount > 0 && (
                <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-purple-100 dark:bg-purple-950/60 border border-purple-400/40 text-purple-700 dark:text-purple-300">
                  <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <span>{tickCount.toLocaleString()} ticks</span>
                </span>
              )}
              {lastTickTime && (
                <span className="text-[10px] text-gray-400 font-mono hidden md:inline">
                  Live: {lastTickTime}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Official institutional derivatives analytics across price swings and Open Interest (OI) buildup cycles.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              type="button"
              className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-purple-500' : ''}`} />
              <span>Refresh API</span>
            </button>
            <button
              onClick={() => setActiveView('ai-trading')}
              type="button"
              className="px-3.5 py-1.5 bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 hover:bg-purple-100 dark:hover:bg-purple-900/50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span>AI Greek Sniper</span>
            </button>
          </div>
        </div>

        {/* 1. Datatype Selector Tabs */}
        <div>
          <label className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block mb-2">
            1. Select Market Mover Datatype:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {DATA_TYPES.map((dt) => {
              const Icon = dt.icon;
              const isSelected = datatype === dt.id;
              return (
                <button
                  key={dt.id}
                  type="button"
                  onClick={() => setDatatype(dt.id)}
                  className={`p-3 rounded-2xl border text-left transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-purple-50/80 border-purple-500 text-gray-900 dark:bg-purple-950/40 dark:border-purple-500 dark:text-white shadow-2xs ring-1 ring-purple-500/30'
                      : 'bg-gray-50 hover:bg-gray-100/80 text-gray-700 border-gray-200 dark:bg-gray-900/40 dark:border-gray-700/80 dark:hover:border-gray-600 dark:text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Icon className={`w-3.5 h-3.5 ${
                        dt.id.includes('Gainers') ? 'text-emerald-500' : 'text-rose-500'
                      }`} />
                      <span>{dt.label}</span>
                    </span>
                    {isSelected && (
                      <span className="w-2 h-2 rounded-full bg-purple-500 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight line-clamp-1">
                    {dt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Expiry Cycle Selector & Search Filter */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-gray-100 dark:border-gray-700/60">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mr-1 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-500" />
              <span>Expiry Cycle:</span>
            </span>
            {EXPIRY_TYPES.map((exp) => (
              <button
                key={exp.id}
                type="button"
                onClick={() => setExpirytype(exp.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  expirytype === exp.id
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 dark:bg-gray-700/70 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600'
                }`}
                title={exp.desc}
              >
                <span>{exp.label}</span>
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter contracts (e.g. NIFTY, YESBANK)..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Top Ranked Mover */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-purple-500" />
              <span>#1 Ranked Contract</span>
            </span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950 text-purple-700 dark:text-purple-300 font-bold">
              {expirytype}
            </span>
          </div>
          <div className="mt-2">
            <div className="font-bold text-sm text-gray-900 dark:text-white truncate">
              {topItem ? topItem.tradingSymbol : 'Loading...'}
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-[11px] text-gray-500 font-mono">
                Token: {topItem ? topItem.symbolToken : '—'}
              </span>
              {topLiveLtp > 0 && (
                <div className="flex items-baseline gap-1 font-mono">
                  <span className="font-bold text-xs text-gray-900 dark:text-white">
                    {formatINR(topLiveLtp)}
                  </span>
                  {topLiveChange !== 0 && (
                    <span className={`text-[10px] font-bold ${topLiveChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {topLiveChange > 0 ? '+' : ''}{topLiveChange.toFixed(2)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Peak % Change */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1">
              <Activity className="w-3.5 h-3.5 text-blue-500" />
              <span>{isOIQuery ? 'Top % OI Shift' : 'Top % Price Move'}</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400">Peak #1</span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <span
              className={`text-2xl font-black font-mono ${
                isGainers ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {maxPercentChange > 0 ? '+' : ''}{maxPercentChange}%
            </span>
            <span className="text-[11px] text-gray-500">
              {isOIQuery ? 'OI Delta' : 'LTP Delta'}
            </span>
          </div>
        </div>

        {/* Card 3: Total Open Interest Pool */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              <span>Top 10 OI Pool</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400">{items.length} Scrips</span>
          </div>
          <div className="mt-2">
            <div className="text-2xl font-black font-mono text-gray-900 dark:text-white">
              {totalOI > 0 ? formatCompactQty(totalOI) : '—'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Cumulative Open Interest in shares
            </div>
          </div>
        </div>

        {/* Card 4: Total Net OI Change */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-gray-500 dark:text-gray-400 tracking-wider flex items-center gap-1">
              <Flame className="w-3.5 h-3.5 text-amber-500" />
              <span>Net OI Day Shift</span>
            </span>
            <span className="text-[10px] font-mono text-gray-400">Net Flow</span>
          </div>
          <div className="mt-2">
            <div
              className={`text-2xl font-black font-mono ${
                totalNetOIChange >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {totalNetOIChange !== 0 ? `${totalNetOIChange > 0 ? '+' : ''}${formatCompactQty(totalNetOIChange)}` : '—'}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              Net position accumulation across leaders
            </div>
          </div>
        </div>
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between px-1 text-xs text-gray-500 dark:text-gray-400">
        <div>
          Showing <span className="font-bold text-gray-900 dark:text-white">{filteredItems.length}</span> derivative contracts for{' '}
          <strong className="text-purple-600 dark:text-purple-400 font-mono">{datatype}</strong> ({expirytype} cycle)
        </div>
        <div className="text-[11px] hidden sm:block">
          Direct feed from SmartAPI MarketData Gateway
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="p-12 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center space-y-3 shadow-xs">
          <RefreshCw className="w-8 h-8 text-purple-600 dark:text-purple-400 animate-spin" />
          <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Querying Angel One SmartAPI Gainers / Losers for {datatype} ({expirytype})...
          </p>
        </div>
      )}

      {/* Error State */}
      {isError && !isLoading && (
        <div className="p-6 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h4 className="font-bold text-rose-800 dark:text-rose-200 text-sm">
              Failed to fetch Gainers / Losers data
            </h4>
            <p className="text-xs text-rose-600 dark:text-rose-400 mt-0.5">
              {error?.message || 'SmartAPI server returned an error'}
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all"
          >
            Retry Fetch
          </button>
        </div>
      )}

      {/* Content: Table View */}
      {!isLoading && !isError && viewMode === 'table' && (
        <div className="overflow-x-auto rounded-3xl border border-gray-200 dark:border-gray-700/80 bg-white dark:bg-gray-800 shadow-xs">
          <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
            <thead className="bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-200 dark:border-gray-700/80">
              <tr>
                <th className="py-3.5 px-4 text-center w-12">#</th>
                <th className="py-3.5 px-4">Derivative Contract</th>
                <th className="py-3.5 px-4 text-right">LTP (₹)</th>
                <th className="py-3.5 px-4 text-right">
                  {isOIQuery ? '% OI Change' : '% Price Change'}
                </th>
                <th className="py-3.5 px-4 text-right">Open Interest (OI)</th>
                <th className="py-3.5 px-4 text-right">Net Change in OI</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-mono">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-gray-500 font-sans">
                    No contracts found matching your search.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, index) => {
                  const isCall = item.tradingSymbol?.endsWith('CE');
                  const isPut = item.tradingSymbol?.endsWith('PE');
                  const tokenStr = String(item.symbolToken || '');
                  const symStr = String(item.tradingSymbol || '').toUpperCase();
                  const live = liveTicks[tokenStr] || liveTicks[symStr];
                  const currentLtp = live?.ltp ?? item.ltp;
                  const currentChange = live?.change ?? item.netChange;
                  const currentPct = (!isOIQuery && live?.percentChange !== undefined) ? live.percentChange : item.percentChange;
                  const flash = flashes[tokenStr] || flashes[symStr];

                  return (
                    <tr
                      key={item.symbolToken || item.tradingSymbol}
                      className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors group"
                    >
                      {/* Rank # */}
                      <td className="py-3.5 px-4 text-center font-bold text-gray-400 group-hover:text-purple-600">
                        {index + 1}
                      </td>

                      {/* Contract Symbol & Type */}
                      <td className="py-3.5 px-4 font-sans">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 dark:text-white text-xs group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            {item.tradingSymbol}
                          </span>
                          <span
                            className={`px-1.5 py-0.2 rounded text-[10px] font-black uppercase font-mono ${
                              isCall
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : isPut
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                            }`}
                          >
                            {isCall ? 'CE' : isPut ? 'PE' : 'FUT'}
                          </span>
                        </div>
                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                          Token: {item.symbolToken} • Expiry: {expirytype}
                        </div>
                      </td>

                      {/* LTP */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={`inline-block font-extrabold font-mono text-sm px-2 py-0.5 rounded-lg transition-all duration-300 ${
                              flash === 'up'
                                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 scale-105 shadow-xs font-black'
                                : flash === 'down'
                                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400 scale-105 shadow-xs font-black'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {currentLtp !== undefined && currentLtp !== null && currentLtp > 0 ? formatINR(currentLtp) : '—'}
                          </span>
                          {currentChange !== undefined && currentChange !== null && currentChange !== 0 && (
                            <span
                              className={`text-[10px] font-semibold mt-0.5 ${
                                currentChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}
                            >
                              {currentChange > 0 ? '+' : ''}{currentChange.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* % Change */}
                      <td className="py-3.5 px-4 text-right">
                        <ChangePill value={currentPct} size="sm" />
                      </td>

                      {/* Open Interest */}
                      <td className="py-3.5 px-4 text-right text-gray-800 dark:text-gray-200">
                        {item.opnInterest !== undefined && item.opnInterest !== null ? (
                          <div>
                            <div className="font-bold">{formatCompactQty(item.opnInterest)}</div>
                            <div className="text-[10px] text-gray-400">
                              {Number(item.opnInterest).toLocaleString('en-IN')} shares
                            </div>
                          </div>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Net Change in OI */}
                      <td className="py-3.5 px-4 text-right">
                        {item.netChangeOpnInterest !== undefined && item.netChangeOpnInterest !== null ? (
                          <span
                            className={`font-semibold ${
                              item.netChangeOpnInterest >= 0
                                ? 'text-emerald-600 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {item.netChangeOpnInterest > 0 ? '+' : ''}
                            {formatCompactQty(item.netChangeOpnInterest)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <button
                          onClick={() => {
                            if (onSelectContract) {
                              onSelectContract(item.tradingSymbol, String(item.symbolToken), {
                                ...item,
                                ltp: currentLtp,
                                netChange: currentChange,
                                percentChange: currentPct,
                              });
                            } else {
                              setActiveView('ai-trading');
                            }
                          }}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-gray-100 hover:bg-purple-100 dark:bg-gray-700/60 dark:hover:bg-purple-900/40 text-gray-700 dark:text-gray-300 hover:text-purple-700 dark:hover:text-purple-300 transition-all inline-flex items-center gap-1"
                        >
                          <span>Analyze</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Content: Cards View */}
      {!isLoading && !isError && viewMode === 'cards' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.length === 0 ? (
            <div className="col-span-full py-12 text-center text-gray-500 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700">
              No contracts found matching your search.
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isCall = item.tradingSymbol?.endsWith('CE');
              const isPut = item.tradingSymbol?.endsWith('PE');
              const tokenStr = String(item.symbolToken || '');
              const symStr = String(item.tradingSymbol || '').toUpperCase();
              const live = liveTicks[tokenStr] || liveTicks[symStr];
              const currentLtp = live?.ltp ?? item.ltp;
              const currentChange = live?.change ?? item.netChange;
              const currentPct = (!isOIQuery && live?.percentChange !== undefined) ? live.percentChange : item.percentChange;
              const flash = flashes[tokenStr] || flashes[symStr];

              return (
                <div
                  key={item.symbolToken || item.tradingSymbol}
                  className="p-5 rounded-3xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 shadow-xs hover:shadow-md hover:border-purple-300 dark:hover:border-purple-500/50 transition-all space-y-3 flex flex-col justify-between"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 text-[10px] font-mono font-bold flex items-center justify-center shrink-0">
                          #{index + 1}
                        </span>
                        <h4 className="font-bold text-sm text-gray-900 dark:text-white truncate">
                          {item.tradingSymbol}
                        </h4>
                        <span
                          className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase font-mono ${
                            isCall
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : isPut
                              ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                          }`}
                        >
                          {isCall ? 'CE' : isPut ? 'PE' : 'FUT'}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-400 font-mono mt-1">
                        Token: {item.symbolToken} • Expiry: {expirytype}
                      </div>
                    </div>

                    <ChangePill value={currentPct} size="sm" />
                  </div>

                  {/* Pricing & OI Metrics */}
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-2 border-t border-gray-100 dark:border-gray-700/60">
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/40">
                      <span className="text-[10px] text-gray-400 block font-sans">LTP Price</span>
                      <span
                        className={`font-bold text-sm block font-mono transition-all duration-300 ${
                          flash === 'up'
                            ? 'text-emerald-600 dark:text-emerald-400 font-black'
                            : flash === 'down'
                            ? 'text-rose-600 dark:text-rose-400 font-black'
                            : 'text-gray-900 dark:text-white'
                        }`}
                      >
                        {currentLtp !== undefined && currentLtp !== null && currentLtp > 0 ? formatINR(currentLtp) : '—'}
                      </span>
                      {currentChange !== undefined && currentChange !== null && currentChange !== 0 && (
                        <span className={`text-[10px] font-mono block ${currentChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {currentChange > 0 ? '+' : ''}{currentChange.toFixed(2)}
                        </span>
                      )}
                    </div>

                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-100 dark:border-gray-700/40">
                      <span className="text-[10px] text-gray-400 block font-sans">Open Interest</span>
                      <span className="font-bold text-gray-900 dark:text-white text-sm">
                        {item.opnInterest !== undefined && item.opnInterest !== null
                          ? formatCompactQty(item.opnInterest)
                          : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Net Change in OI */}
                  {item.netChangeOpnInterest !== undefined && item.netChangeOpnInterest !== null && (
                    <div className="text-[11px] flex items-center justify-between text-gray-500 font-mono px-1">
                      <span>Net OI Change:</span>
                      <span
                        className={`font-bold ${
                          item.netChangeOpnInterest >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {item.netChangeOpnInterest > 0 ? '+' : ''}
                        {formatCompactQty(item.netChangeOpnInterest)}
                      </span>
                    </div>
                  )}

                  {/* Bottom Action */}
                  <button
                    onClick={() => {
                      if (onSelectContract) {
                        onSelectContract(item.tradingSymbol, String(item.symbolToken), {
                          ...item,
                          ltp: currentLtp,
                          netChange: currentChange,
                          percentChange: currentPct,
                        });
                      } else {
                        setActiveView('ai-trading');
                      }
                    }}
                    className="w-full py-2 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5"
                  >
                    <span>Analyze in AI Greek Sniper</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

export default SmartApiGainersLosersView;
