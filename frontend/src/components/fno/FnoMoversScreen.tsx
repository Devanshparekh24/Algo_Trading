import React, { useMemo } from 'react';
import { RefreshCw, Table as TableIcon, LayoutGrid } from 'lucide-react';
import { useFnoMovers } from '../../hooks/useMarket';
import type { FnoMoverItem } from '../../types';
import MarketStatusBadge from '../common/MarketStatusBadge';
import MarketClosedBanner from '../common/MarketClosedBanner';
import FnoSummaryCards from './FnoSummaryCards';
import FnoFilterBar from './FnoFilterBar';
import FnoTableView from './FnoTableView';
import FnoCardGrid from './FnoCardGrid';
import ContractDetailModal from './ContractDetailModal';
import { useFnoFilterStore, useWatchlistStore } from '../../store';

export const FnoMoversScreen: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useFnoMovers();

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

  // Filter list based on segment, direction, underlying, search, and watchlist
  const filteredItems = useMemo(() => {
    if (!data) return [];

    let list: FnoMoverItem[] = [];

    // 1. Direction filtering
    if (direction === 'gainers') {
      list = [...data.gainers];
    } else if (direction === 'losers') {
      list = [...data.losers];
    } else {
      list = [...data.all];
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
  }, [data, segment, direction, underlying, searchQuery, isPinned]);

  if (isLoading) {
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

  if (isError) {
    return (
      <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load F&O movers data</h3>
          <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error?.message}</p>
        </div>
        <button
          onClick={() => refetch()}
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
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white tracking-tight">
              Top Volatile F&O Movers
            </h2>
            <MarketStatusBadge />
            <span className="px-2 py-0.5 text-[11px] font-bold rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">
              Derivatives Feed
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Real-time highest swings, ups & downs across Futures, Call (CE) & Put (PE) options
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-between sm:justify-start">
          <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono hidden md:block">
            {data?.summary?.lastUpdated
              ? `Updated ${new Date(data.summary.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
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
            onClick={() => refetch()}
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

      {/* Market Closed Notification Banner with Reason */}
      <MarketClosedBanner segmentName="Derivatives (F&O) Market" />

      {/* Top Metric Cards */}
      <FnoSummaryCards
        summary={data?.summary}
        onSelectContract={(contract) => setSelectedContract(contract)}
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
        summary={data?.summary}
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
        />
      ) : (
        <FnoCardGrid
          items={filteredItems}
          onSelectContract={(contract) => setSelectedContract(contract)}
        />
      )}

      {/* Contract Detail Modal */}
      <ContractDetailModal
        contract={selectedContract}
        onClose={() => setSelectedContract(null)}
      />
    </div>
  );
};

export default FnoMoversScreen;
