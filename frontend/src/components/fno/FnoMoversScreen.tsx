import React, { useMemo, useState } from 'react';
import { RefreshCw, Table as TableIcon, LayoutGrid, Zap, Activity, BarChart3, Flame, Layers } from 'lucide-react';
import { useFnoMovers } from '../../hooks/useMarket';
import { useRealtimeFnoMovers } from '../../hooks/useRealtimeFnoMovers';
import type { FnoMoverItem } from '../../types';
import MarketStatusBadge from '../common/MarketStatusBadge';
import MarketClosedBanner from '../common/MarketClosedBanner';
import FnoSummaryCards from './FnoSummaryCards';
import FnoFilterBar from './FnoFilterBar';
import FnoTableView from './FnoTableView';
import FnoCardGrid from './FnoCardGrid';
import ContractDetailModal from './ContractDetailModal';
import SmartApiGainersLosersView from './SmartApiGainersLosersView';
import OptionChainView from './OptionChainView';
import { useFnoFilterStore, useWatchlistStore } from '../../store';

export const FnoMoversScreen: React.FC = () => {
  const [fnoActiveView, setFnoActiveView] = useState<'SMARTAPI_GAINERS' | 'VOLATILE_STREAM' | 'OPTION_CHAIN'>('OPTION_CHAIN');
  const { data, isLoading, isError, error, refetch, isFetching } = useFnoMovers();
  const {
    liveData,
    isConnected,
    lastTickTime,
    tickCount,
    flashes,
    requestImmediateRefresh,
  } = useRealtimeFnoMovers(data);

  // Active dataset prioritizes instantaneous WebSocket liveData
  const activeData = liveData || data;

  // Screen presentation and filter state backed by Zustand
  const {
    segment,
    setSegment,
    direction,
    setDirection,
    underlying,
    setUnderlying,
    searchQuery,
    setSearchQuery,
    viewMode,
    setViewMode,
    selectedContract,
    setSelectedContract,
  } = useFnoFilterStore();

  const isPinned = useWatchlistStore((state) => state.isPinned);

  const handleSelectGainersContract = (symbol: string, token?: string, contractData?: any) => {
    const found = activeData?.all?.find((c) => c.tradingSymbol === symbol || c.symbolToken === token);
    if (found) {
      setSelectedContract({
        ...found,
        ...(contractData?.ltp ? { ltp: contractData.ltp, netChange: contractData.netChange, percentChange: contractData.percentChange } : {}),
      });
    } else {
      setSelectedContract({
        tradingSymbol: symbol,
        symbolToken: token || '',
        name: symbol.replace(/(FUT|CE|PE).*$/, ''),
        instrumentType: symbol.endsWith('CE') ? 'CE' : symbol.endsWith('PE') ? 'PE' : 'FUT',
        strike: contractData?.strike ?? null,
        expiry: contractData?.expiry || 'NEAR',
        ltp: contractData?.ltp ?? 0,
        netChange: contractData?.netChange ?? 0,
        percentChange: contractData?.percentChange ?? 0,
        open: contractData?.open,
        high: contractData?.high,
        low: contractData?.low,
        close: contractData?.close,
        tradeVolume: contractData?.tradeVolume,
        opnInterest: contractData?.opnInterest,
        exchange: 'NFO',
      });
    }
  };

  // Keep modal contract updated with live real-time price ticks
  const liveSelectedContract = useMemo(() => {
    if (!selectedContract || !activeData?.all) return selectedContract;
    return (
      activeData.all.find(
        (item) =>
          item.symbolToken === selectedContract.symbolToken ||
          item.tradingSymbol.toUpperCase() === selectedContract.tradingSymbol.toUpperCase()
      ) || selectedContract
    );
  }, [selectedContract, activeData?.all]);

  // Filter list based on segment, direction, underlying, search, and watchlist
  const filteredItems = useMemo(() => {
    if (!activeData) return [];

    let list: FnoMoverItem[] = [];

    // 1. Direction filtering
    if (direction === 'gainers') {
      list = [...activeData.gainers];
    } else if (direction === 'losers') {
      list = [...activeData.losers];
    } else {
      list = [...activeData.all];
    }

    // 2. Segment filtering (Watchlist or FUT / CE / PE)
    if (segment === 'watchlist') {
      list = list.filter((item) => isPinned(item.symbolToken || item.tradingSymbol));
    } else if (segment !== 'all') {
      list = list.filter((item) => item.instrumentType === segment);
    }

    // 3. Underlying filtering
    if (underlying !== 'ALL') {
      if (underlying === 'STOCKS') {
        const majorIndices = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY', 'NIFTYNXT50'];
        list = list.filter((item) => !majorIndices.includes(item.name.toUpperCase()));
      } else {
        list = list.filter((item) => item.name.toUpperCase() === underlying);
      }
    }

    // 4. Search query filtering
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (item) =>
          item.tradingSymbol.toLowerCase().includes(q) ||
          item.name.toLowerCase().includes(q) ||
          (item.strike && String(item.strike).includes(q))
      );
    }

    return list;
  }, [activeData, segment, direction, underlying, searchQuery, isPinned]);

  if (isLoading && !activeData) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-14 bg-gray-200 dark:bg-gray-800 rounded-3xl w-full" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
          <div className="h-28 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        </div>
        <div className="h-20 bg-gray-200 dark:bg-gray-800 rounded-2xl" />
        <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-3xl" />
      </div>
    );
  }

  if (isError && !activeData) {
    return (
      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load F&O movers data</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error?.message}</p>
        </div>
        <button
          onClick={() => {
            refetch();
            requestImmediateRefresh();
          }}
          type="button"
          className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-200 dark:border-gray-700/80 shadow-xs">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              <span>Top Volatile F&O Movers</span>
            </h2>
            <MarketStatusBadge />
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Derivatives Feed
            </span>

            {/* Live WebSocket Connection Pill */}
            {isConnected ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-400/50 text-emerald-700 dark:text-emerald-300 shadow-2xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>WebSocket Live Stream (1.5s)</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-300/40">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                <span>Connecting to WebSocket...</span>
              </span>
            )}

            {/* Live Tick Counter */}
            {tickCount > 0 && (
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-blue-100 dark:bg-blue-950/60 border border-blue-400/40 text-blue-700 dark:text-blue-300">
                <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                <span>{tickCount.toLocaleString()} ticks</span>
              </span>
            )}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Real-time highest swings, ups & downs across Futures, Call (CE) & Put (PE) options powered by Angel One SmartAPI WebSocket.
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono hidden md:block">
            {lastTickTime
              ? `Live Tick: ${lastTickTime}`
              : activeData?.summary?.lastUpdated
              ? `Updated ${new Date(activeData.summary.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : ''}
          </div>

          {/* View Mode Toggle: Table / Cards */}
          <div className="flex bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
            <button
              onClick={() => setViewMode('table')}
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                viewMode === 'table'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('cards')}
              type="button"
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1.5 ${
                viewMode === 'cards'
                  ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Cards</span>
            </button>
          </div>

          {/* Refresh Action */}
          <button
            onClick={() => {
              refetch();
              requestImmediateRefresh();
            }}
            disabled={isFetching}
            type="button"
            className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all disabled:opacity-50"
            title="Refresh F&O market movers"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Primary Navigation Tabs: Option Chain Matrix vs Official SmartAPI Gainers/Losers vs High-Volatility Radar */}
      <div className="flex items-center gap-2 border-b border-gray-200 dark:border-gray-700/80 pb-3 flex-wrap">
        <button
          type="button"
          onClick={() => setFnoActiveView('OPTION_CHAIN')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            fnoActiveView === 'OPTION_CHAIN'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25 ring-2 ring-emerald-400/40'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Layers className="w-4 h-4 text-emerald-300" />
          <span>Interactive Option Chain Matrix</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 dark:bg-black/30 font-mono">
            Greeks & PCR
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFnoActiveView('SMARTAPI_GAINERS')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            fnoActiveView === 'SMARTAPI_GAINERS'
              ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25 ring-2 ring-purple-400/40'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <BarChart3 className="w-4 h-4 text-amber-300" />
          <span>Official SmartAPI Gainers / Losers</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 dark:bg-black/30 font-mono">
            marketData/v1
          </span>
        </button>

        <button
          type="button"
          onClick={() => setFnoActiveView('VOLATILE_STREAM')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            fnoActiveView === 'VOLATILE_STREAM'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-2 ring-blue-400/40'
              : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
          }`}
        >
          <Flame className="w-4 h-4 text-amber-400" />
          <span>High-Volatility Call & Put Stream</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 dark:bg-black/30 font-mono">
            WebSocket
          </span>
        </button>
      </div>

      {/* VIEW 1: Interactive Option Chain Matrix */}
      {fnoActiveView === 'OPTION_CHAIN' ? (
        <OptionChainView onSelectContract={handleSelectGainersContract} />
      ) : fnoActiveView === 'SMARTAPI_GAINERS' ? (
        /* VIEW 2: Official SmartAPI Top Gainers / Losers (Derivatives Segment) */
        <SmartApiGainersLosersView
          viewMode={viewMode}
          onSelectContract={handleSelectGainersContract}
        />
      ) : (
        /* VIEW 3: High Volatility Derivatives Movers & Live Stream */
        <div className="space-y-6">
          {/* Market Closed Notification Banner with Reason */}
          <MarketClosedBanner segmentName="Derivatives (F&O) Market" />

          {/* Top Metric Cards */}
          <FnoSummaryCards
            summary={activeData?.summary}
            onSelectContract={(contract) => setSelectedContract(contract)}
            flashes={flashes}
          />

          {/* Segment, Direction, Underlying & Search Filters */}
          <FnoFilterBar
            segment={segment}
            onSegmentChange={setSegment}
            direction={direction}
            onDirectionChange={setDirection}
            underlying={underlying}
            onUnderlyingChange={setUnderlying}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            summary={activeData?.summary}
          />

          {/* Results Sub-header */}
          <div className="flex justify-between items-center px-1 text-xs text-gray-500 dark:text-gray-400">
            <div>
              Showing <span className="font-bold text-gray-900 dark:text-white">{filteredItems.length}</span> contracts
              {searchQuery ? ` matching "${searchQuery}"` : ''}
            </div>
            <div className="text-[11px] hidden sm:block">
              Click any contract row or card to inspect complete market depth
            </div>
          </div>

          {/* Main View: Table or Cards */}
          {viewMode === 'table' ? (
            <FnoTableView
              items={filteredItems}
              onSelectContract={(contract) => setSelectedContract(contract)}
              flashes={flashes}
            />
          ) : (
            <FnoCardGrid
              items={filteredItems}
              onSelectContract={(contract) => setSelectedContract(contract)}
              flashes={flashes}
            />
          )}
        </div>
      )}

      {/* Contract Detail Modal */}
      <ContractDetailModal
        contract={liveSelectedContract}
        onClose={() => setSelectedContract(null)}
      />
    </div>
  );
};

export default FnoMoversScreen;
