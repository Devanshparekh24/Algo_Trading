import React, { useState, useMemo, useEffect } from 'react';
import {
  Layers,
  BarChart3,
  PieChart,
  Radio,
  X,
  ArrowUpDown,
  FolderOpen,
} from 'lucide-react';
import { usePositions, useHoldings } from '../hooks/usePortfolio';
import { useRealtimePortfolio } from '../hooks/useRealtimePortfolio';
import type { Position, Holding } from '../types';
import SearchInput from '../components/common/SearchInput';
import { formatINR } from '../utils/formatters';

// Reusable Modular Portfolio Components
import PortfolioHeader from '../components/portfolio/PortfolioHeader';
import PortfolioKpiCards from '../components/portfolio/PortfolioKpiCards';
import HoldingsTableView from '../components/portfolio/HoldingsTableView';
import HoldingsCardGrid from '../components/portfolio/HoldingsCardGrid';
import PositionsTableView from '../components/portfolio/PositionsTableView';
import PositionsCardGrid from '../components/portfolio/PositionsCardGrid';
import PortfolioAllocationChart from '../components/portfolio/PortfolioAllocationChart';
import HoldingDetailModal from '../components/portfolio/HoldingDetailModal';

export interface PortfolioScreenProps {
  initialTab?: 'equity' | 'positions' | 'holdings' | 'allocation';
}

type TabType = 'equity' | 'positions' | 'allocation';
type FilterFilterType = 'all' | 'profit' | 'loss';
type SortType = 'value' | 'pnl' | 'dayChange' | 'name';

const PALETTE = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#8B5CF6', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#6366F1', // Indigo
];

export const PortfolioScreen: React.FC<PortfolioScreenProps> = ({ initialTab = 'equity' }) => {
  const normalizedInitial = initialTab === 'holdings' ? 'equity' : initialTab;
  const [activeTab, setActiveTab] = useState<TabType>(normalizedInitial as TabType);
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('table');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<FilterFilterType>('all');
  const [sortBy, setSortBy] = useState<SortType>('value');
  const [selectedItem, setSelectedItem] = useState<{
    item: Holding | Position;
    type: 'holding' | 'position';
  } | null>(null);

  useEffect(() => {
    if (initialTab) {
      setActiveTab((initialTab === 'holdings' ? 'equity' : initialTab) as TabType);
    }
  }, [initialTab]);

  // Automatically adapt default view mode for mobile devices
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setViewMode('cards');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const positionsQuery = usePositions(false);
  const holdingsQuery = useHoldings(false);

  // Real-time WebSocket connection to Angel One live stream
  const {
    isConnected,
    lastTickTime,
    lastWebhookEvent,
    flashes,
    requestImmediateRefresh,
    dismissWebhookBanner,
  } = useRealtimePortfolio();

  const parseNum = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  const positionsList: Position[] = useMemo(() => {
    return positionsQuery.data || [];
  }, [positionsQuery.data]);

  const holdingsList: Holding[] = useMemo(() => {
    return holdingsQuery.data?.holdings || [];
  }, [holdingsQuery.data]);

  const totalHoldingSummary = holdingsQuery.data?.totalholding;

  // Aggregate stats calculations
  const totalPositionsPnL = useMemo(() => {
    return positionsList.reduce((sum: number, pos: Position) => sum + parseNum(pos.pnl || pos.m2m), 0);
  }, [positionsList]);

  const totalEquityInvested = useMemo(() => {
    if (totalHoldingSummary?.totalinvvalue !== undefined) {
      return parseNum(totalHoldingSummary.totalinvvalue);
    }
    return holdingsList.reduce((sum: number, h: Holding) => {
      const qty = parseNum(h.quantity);
      const avg = parseNum(h.averageprice);
      return sum + qty * avg;
    }, 0);
  }, [totalHoldingSummary, holdingsList]);

  const totalEquityValue = useMemo(() => {
    if (totalHoldingSummary?.totalholdingvalue !== undefined) {
      return parseNum(totalHoldingSummary.totalholdingvalue);
    }
    return holdingsList.reduce((sum: number, h: Holding) => {
      const qty = parseNum(h.quantity);
      const ltp = parseNum(h.ltp);
      return sum + qty * ltp;
    }, 0);
  }, [totalHoldingSummary, holdingsList]);

  const totalEquityPnL = useMemo(() => {
    if (totalHoldingSummary?.totalprofitandloss !== undefined) {
      return parseNum(totalHoldingSummary.totalprofitandloss);
    }
    return holdingsList.reduce((sum: number, h: Holding) => sum + parseNum(h.profitandloss), 0);
  }, [totalHoldingSummary, holdingsList]);

  const totalEquityPnlPercent = useMemo(() => {
    if (totalHoldingSummary?.totalpnlpercentage !== undefined) {
      return parseNum(totalHoldingSummary.totalpnlpercentage);
    }
    return totalEquityInvested > 0 ? (totalEquityPnL / totalEquityInvested) * 100 : 0;
  }, [totalHoldingSummary, totalEquityPnL, totalEquityInvested]);

  // Today's Live Equity Gain/Loss
  const todayEquityPnL = useMemo(() => {
    return holdingsList.reduce((sum: number, h: Holding) => {
      const qty = parseNum(h.quantity);
      const ltp = parseNum(h.ltp);
      const close = parseNum(h.close) || ltp;
      return sum + (ltp - close) * qty;
    }, 0);
  }, [holdingsList]);

  const todayEquityPnlPercent = useMemo(() => {
    const prevDayValue = totalEquityValue - todayEquityPnL;
    return prevDayValue > 0 ? (todayEquityPnL / prevDayValue) * 100 : 0;
  }, [totalEquityValue, todayEquityPnL]);

  // Stock allocation percentages
  const equityAllocations = useMemo(() => {
    return holdingsList.map((h: Holding, index: number) => {
      const qty = parseNum(h.quantity);
      const ltp = parseNum(h.ltp);
      const curVal = qty * ltp;
      const weight = totalEquityValue > 0 ? (curVal / totalEquityValue) * 100 : 0;
      return {
        symbol: h.tradingsymbol || 'Unknown',
        value: curVal,
        weight,
        color: PALETTE[index % PALETTE.length] || '#3B82F6',
      };
    });
  }, [holdingsList, totalEquityValue]);

  // Filter & Sort Holdings
  const filteredAndSortedHoldings = useMemo(() => {
    return holdingsList
      .filter((h: Holding) => {
        const sym = (h.tradingsymbol || '').toLowerCase();
        const ex = (h.exchange || '').toLowerCase();
        const isin = (h.isin || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        const matchesQuery = !query || sym.includes(query) || ex.includes(query) || isin.includes(query);

        if (!matchesQuery) return false;

        const pnl = parseNum(h.profitandloss ?? (parseNum(h.ltp) - parseNum(h.averageprice)) * parseNum(h.quantity));
        if (filterType === 'profit') return pnl > 0;
        if (filterType === 'loss') return pnl < 0;
        return true;
      })
      .sort((a: Holding, b: Holding) => {
        const aVal = parseNum(a.ltp) * parseNum(a.quantity);
        const bVal = parseNum(b.ltp) * parseNum(b.quantity);
        const aPnl = parseNum(a.profitandloss);
        const bPnl = parseNum(b.profitandloss);

        if (sortBy === 'value') return bVal - aVal;
        if (sortBy === 'pnl') return bPnl - aPnl;
        if (sortBy === 'dayChange') {
          const aDay = (parseNum(a.ltp) - (parseNum(a.close) || parseNum(a.ltp))) * parseNum(a.quantity);
          const bDay = (parseNum(b.ltp) - (parseNum(b.close) || parseNum(b.ltp))) * parseNum(b.quantity);
          return bDay - aDay;
        }
        return (a.tradingsymbol || '').localeCompare(b.tradingsymbol || '');
      });
  }, [holdingsList, searchQuery, filterType, sortBy]);

  // Filter & Sort Positions
  const filteredAndSortedPositions = useMemo(() => {
    return positionsList
      .filter((pos: Position) => {
        const sym = (pos.tradingsymbol || pos.symbol || '').toLowerCase();
        const ex = (pos.exchange || '').toLowerCase();
        const query = searchQuery.toLowerCase();
        const matchesQuery = !query || sym.includes(query) || ex.includes(query);

        if (!matchesQuery) return false;

        const pnl = parseNum(pos.pnl || pos.m2m);
        if (filterType === 'profit') return pnl > 0;
        if (filterType === 'loss') return pnl < 0;
        return true;
      })
      .sort((a: Position, b: Position) => {
        const aPnl = parseNum(a.pnl || a.m2m);
        const bPnl = parseNum(b.pnl || b.m2m);
        if (sortBy === 'pnl') return bPnl - aPnl;
        return (a.tradingsymbol || '').localeCompare(b.tradingsymbol || '');
      });
  }, [positionsList, searchQuery, filterType, sortBy]);

  const handleManualRefresh = () => {
    requestImmediateRefresh();
    if (activeTab === 'positions') {
      positionsQuery.refetch();
    } else {
      holdingsQuery.refetch();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 font-sans">
      {/* 1. Header with Live Status & Controls */}
      <PortfolioHeader
        isConnected={isConnected}
        lastTickTime={lastTickTime}
        isFetching={positionsQuery.isFetching || holdingsQuery.isFetching}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onRefresh={handleManualRefresh}
      />

      {/* 2. Webhook Notification Banner (if any live event received) */}
      {lastWebhookEvent && (
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-3 px-4 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
              <Radio className="w-3 h-3 text-blue-600 animate-pulse" />
              Live Trade Webhook
            </span>
            <span className="font-semibold text-gray-900 dark:text-white">
              [{lastWebhookEvent.eventType}] {lastWebhookEvent.symbol || 'Portfolio'}{' '}
              {lastWebhookEvent.price ? `@ ${formatINR(lastWebhookEvent.price)}` : ''}
            </span>
            <span className="text-gray-400 font-mono text-[11px]">
              {new Date(lastWebhookEvent.receivedAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            type="button"
            onClick={dismissWebhookBanner}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors ml-2"
            title="Dismiss Webhook Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* 3. Top Portfolio KPI Metric Cards */}
      <PortfolioKpiCards
        activeTab={activeTab}
        totalPositionsPnL={totalPositionsPnL}
        totalEquityPnL={totalEquityPnL}
        totalEquityPnlPercent={totalEquityPnlPercent}
        totalEquityValue={totalEquityValue}
        totalEquityInvested={totalEquityInvested}
        todayEquityPnL={todayEquityPnL}
        todayEquityPnlPercent={todayEquityPnlPercent}
      />

      {/* 4. Tab Navigation Bar + Search & Filter Toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
        {/* Horizontally scrollable tabs on small screens */}
        <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full sm:w-fit overflow-x-auto no-scrollbar whitespace-nowrap border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => setActiveTab('equity')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'equity'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Equity Holdings ({holdingsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'positions'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Open Positions ({positionsList.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('allocation')}
            className={`flex items-center gap-2 px-3.5 sm:px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'allocation'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Asset Allocation</span>
          </button>
        </div>

        {/* Search, Filter Pills & Sort Controls */}
        {activeTab !== 'allocation' && (
          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* Quick Profit / Loss Filter Pills */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
              <button
                type="button"
                onClick={() => setFilterType('all')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'all'
                    ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-bold shadow-xs'
                    : 'text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType('profit')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'profit'
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-700'
                    : 'text-emerald-600 dark:text-emerald-400 hover:opacity-80'
                }`}
              >
                In Profit
              </button>
              <button
                type="button"
                onClick={() => setFilterType('loss')}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  filterType === 'loss'
                    ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold border border-rose-300 dark:border-rose-700'
                    : 'text-rose-600 dark:text-rose-400 hover:opacity-80'
                }`}
              >
                In Loss
              </button>
            </div>

            {/* Sort Selector */}
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs text-gray-600 dark:text-gray-300">
              <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortType)}
                className="bg-transparent font-medium focus:outline-none cursor-pointer"
              >
                <option value="value">Highest Value</option>
                <option value="pnl">Highest P&L</option>
                <option value="dayChange">Today's Moves</option>
                <option value="name">Alphabetical</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="flex-1 sm:w-64">
              <SearchInput
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder="Search symbol, ISIN..."
                className="w-full"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. Main View Area */}
      {activeTab === 'equity' ? (
        holdingsQuery.isLoading ? (
          <TableSkeleton />
        ) : filteredAndSortedHoldings.length === 0 ? (
          <EmptyState
            title="No Equity Holdings Found"
            description={
              searchQuery || filterType !== 'all'
                ? 'No holdings match your search and filter criteria.'
                : 'You currently have no equity delivery shares in your Angel One Demat account.'
            }
          />
        ) : viewMode === 'table' ? (
          <HoldingsTableView
            holdings={filteredAndSortedHoldings}
            flashes={flashes}
            totalEquityValue={totalEquityValue}
            onSelectHolding={(h) => setSelectedItem({ item: h, type: 'holding' })}
          />
        ) : (
          <HoldingsCardGrid
            holdings={filteredAndSortedHoldings}
            flashes={flashes}
            totalEquityValue={totalEquityValue}
            onSelectHolding={(h) => setSelectedItem({ item: h, type: 'holding' })}
          />
        )
      ) : activeTab === 'positions' ? (
        positionsQuery.isLoading ? (
          <TableSkeleton />
        ) : filteredAndSortedPositions.length === 0 ? (
          <EmptyState
            title="No Open Positions Found"
            description={
              searchQuery || filterType !== 'all'
                ? 'No open trading positions match your search criteria.'
                : 'You currently have no open intraday or derivative trading positions.'
            }
          />
        ) : viewMode === 'table' ? (
          <PositionsTableView
            positions={filteredAndSortedPositions}
            flashes={flashes}
            onSelectPosition={(p) => setSelectedItem({ item: p, type: 'position' })}
          />
        ) : (
          <PositionsCardGrid
            positions={filteredAndSortedPositions}
            flashes={flashes}
            onSelectPosition={(p) => setSelectedItem({ item: p, type: 'position' })}
          />
        )
      ) : (
        /* Asset Allocation Tab */
        <PortfolioAllocationChart
          allocations={equityAllocations}
          totalEquityValue={totalEquityValue}
          totalPositionsPnL={totalPositionsPnL}
          holdingsCount={holdingsList.length}
          positionsCount={positionsList.length}
        />
      )}

      {/* 6. Holding / Position Detail Inspection Modal */}
      {selectedItem && (
        <HoldingDetailModal
          item={selectedItem.item}
          type={selectedItem.type}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
};

// UI Skeleton Helper
const TableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-xs animate-pulse space-y-4">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-1/4" />
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-12 bg-gray-100 dark:bg-gray-750 rounded-xl w-full" />
      ))}
    </div>
  </div>
);

// Empty State Helper
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-12 text-center shadow-xs">
    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
      <FolderOpen className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="font-bold text-gray-900 dark:text-white text-base">{title}</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">{description}</p>
  </div>
);

export default PortfolioScreen;
