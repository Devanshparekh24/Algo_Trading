import React, { useState, useMemo, useEffect } from 'react';
import {
  RefreshCw,
  TrendingUp,
  BarChart3,
  FolderOpen,
  Wallet,
  IndianRupee,
  Layers,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  X,
  CheckCircle2,
} from 'lucide-react';
import { usePositions, useHoldings } from '../hooks/usePortfolio';
import { useRealtimePortfolio } from '../hooks/useRealtimePortfolio';
import type { Position, Holding } from '../types';
import SearchInput from '../components/common/SearchInput';
import { formatINR, formatNumber } from '../utils/formatters';

interface PortfolioScreenProps {
  initialTab?: 'equity' | 'positions' | 'holdings' | 'allocation';
}

type TabType = 'equity' | 'positions' | 'allocation';

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
  const [useRootEndpoint, setUseRootEndpoint] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (initialTab) {
      setActiveTab((initialTab === 'holdings' ? 'equity' : initialTab) as TabType);
    }
  }, [initialTab]);

  const positionsQuery = usePositions(useRootEndpoint);
  const holdingsQuery = useHoldings(useRootEndpoint);

  // Real-time WebSocket and Webhook subscriber connected to Angel One live stream
  const {
    isConnected,
    lastTickTime,
    lastWebhookEvent,
    flashes,
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

  // Aggregate stats calculations using true live values
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

  // Today's Real Live Equity Gain/Loss calculated using (ltp - close) * quantity
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
        color: PALETTE[index % PALETTE.length],
      };
    });
  }, [holdingsList, totalEquityValue]);

  // Filtered lists based on search query
  const filteredPositions = useMemo(() => {
    return positionsList.filter((pos: Position) => {
      const sym = (pos.tradingsymbol || pos.symbol || '').toLowerCase();
      const ex = (pos.exchange || '').toLowerCase();
      const prd = (pos.producttype || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return sym.includes(query) || ex.includes(query) || prd.includes(query);
    });
  }, [positionsList, searchQuery]);

  const filteredHoldings = useMemo(() => {
    return holdingsList.filter((h: Holding) => {
      const sym = (h.tradingsymbol || '').toLowerCase();
      const ex = (h.exchange || '').toLowerCase();
      const isin = (h.isin || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return sym.includes(query) || ex.includes(query) || isin.includes(query);
    });
  }, [holdingsList, searchQuery]);

  const currentEndpointUrl = useRootEndpoint
    ? activeTab === 'positions'
      ? 'http://localhost:5000/positions'
      : 'http://localhost:5000/holdings'
    : activeTab === 'positions'
      ? 'http://localhost:5000/api/v1/portfolio/positions'
      : 'http://localhost:5000/api/v1/portfolio/holdings';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
      {/* Top Header & Live Stream Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Portfolio Console</h2>
            
            {/* Live Angel One connection badge */}
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1.5 ${
                isConnected
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              {isConnected ? 'Angel One Live Stream Connected' : 'Connecting to Live Feed...'}
            </span>

            {lastTickTime && (
              <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-md flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                Live Quote: {lastTickTime}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Real-time equity market feed & live holdings stream directly from Angel One SmartAPI
          </p>
        </div>

        {/* Live Refresh Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100 dark:bg-gray-800 p-1 rounded-xl border border-gray-200 dark:border-gray-700 text-xs">
            <button
              onClick={() => setUseRootEndpoint(false)}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                !useRootEndpoint
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              /api/v1/portfolio
            </button>
            <button
              onClick={() => setUseRootEndpoint(true)}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                useRootEndpoint
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Root
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'positions') positionsQuery.refetch();
              else holdingsQuery.refetch();
            }}
            disabled={positionsQuery.isFetching || holdingsQuery.isFetching}
            className="flex items-center space-x-2 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
            title="Fetch fresh live quotes directly from Angel One SmartAPI"
          >
            <RefreshCw
              className={`w-4 h-4 ${positionsQuery.isFetching || holdingsQuery.isFetching ? 'animate-spin' : ''}`}
            />
            <span>Refresh Live Data</span>
          </button>
        </div>
      </div>

      {/* Live Webhook Alert Notification Banner */}
      {lastWebhookEvent && (
        <div className="bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10 border border-blue-200 dark:border-blue-800/80 rounded-2xl p-3 px-4 flex items-center justify-between text-xs animate-in fade-in slide-in-from-top-2 duration-200 shadow-sm">
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
              Source: {lastWebhookEvent.source} • {new Date(lastWebhookEvent.receivedAt).toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={dismissWebhookBanner}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded-lg transition-colors ml-2"
            title="Dismiss Webhook Alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Equity & Portfolio Live KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Equity / Positions P&L */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm transition-all hover:shadow">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>{activeTab === 'positions' ? 'Positions P&L' : 'Total Equity P&L'}</span>
            <span
              className={`p-1.5 rounded-lg ${
                (activeTab === 'positions' ? totalPositionsPnL : totalEquityPnL) >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span
              className={`text-2xl font-extrabold transition-colors duration-300 ${
                (activeTab === 'positions' ? totalPositionsPnL : totalEquityPnL) >= 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {(activeTab === 'positions' ? totalPositionsPnL : totalEquityPnL) >= 0 ? '+' : ''}
              {formatINR(activeTab === 'positions' ? totalPositionsPnL : totalEquityPnL)}
            </span>
            {activeTab !== 'positions' && (
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  totalEquityPnlPercent >= 0
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                }`}
              >
                {totalEquityPnlPercent >= 0 ? '+' : ''}
                {totalEquityPnlPercent.toFixed(2)}%
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {activeTab === 'positions' ? 'Realized + unrealized M2M' : 'Net profit/loss against purchase value'}
          </p>
        </div>

        {/* Current Live Equity Value */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm transition-all hover:shadow">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Live Equity Market Value</span>
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatINR(totalEquityValue)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Portfolio valuation at live market LTP</p>
        </div>

        {/* Total Equity Invested */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm transition-all hover:shadow">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Capital Invested</span>
            <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
              <IndianRupee className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-2xl font-extrabold text-gray-900 dark:text-white">
              {formatINR(totalEquityInvested)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Total buy value of shares held</p>
        </div>

        {/* Today's Real Live Gain/Loss */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm transition-all hover:shadow">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Today's Market Gain/Loss</span>
            <span
              className={`p-1.5 rounded-lg ${
                todayEquityPnL >= 0
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                  : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
              }`}
            >
              {todayEquityPnL >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span
              className={`text-2xl font-extrabold ${
                todayEquityPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {todayEquityPnL >= 0 ? '+' : ''}
              {formatINR(todayEquityPnL)}
            </span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                todayEquityPnlPercent >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              }`}
            >
              {todayEquityPnlPercent >= 0 ? '+' : ''}
              {todayEquityPnlPercent.toFixed(2)}%
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Intraday change vs previous closing price</p>
        </div>
      </div>

      {/* Equity Allocation Distribution Bar */}
      {holdingsList.length > 0 && activeTab !== 'positions' && (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
              <PieChart className="w-4 h-4 text-blue-600" />
              Equity Demat Distribution
            </span>
            <span className="text-gray-400 font-mono text-[11px]">{holdingsList.length} Active Stock Position(s)</span>
          </div>

          {/* Allocation Progress Bar */}
          <div className="h-3 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
            {equityAllocations.map((item) => (
              <div
                key={item.symbol}
                style={{ width: `${item.weight}%`, backgroundColor: item.color }}
                className="h-full transition-all hover:opacity-80 cursor-pointer"
                title={`${item.symbol}: ${item.weight.toFixed(1)}% (${formatINR(item.value)})`}
              />
            ))}
          </div>

          {/* Scrip Pills */}
          <div className="flex flex-wrap gap-2 text-xs">
            {equityAllocations.map((item) => (
              <div
                key={item.symbol}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-750 border border-gray-200 dark:border-gray-700"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                <span className="font-bold text-gray-800 dark:text-gray-200">{item.symbol.replace('-EQ', '')}</span>
                <span className="text-gray-500 dark:text-gray-400 font-mono text-[11px]">{item.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Tab Buttons */}
        <div className="flex bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('equity')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'equity'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Equity Holdings ({holdingsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('positions')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'positions'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Open Positions ({positionsList.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('allocation')}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'allocation'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <PieChart className="w-3.5 h-3.5" />
            <span>Asset Allocation</span>
          </button>
        </div>

        {/* Search Input */}
        {activeTab !== 'allocation' && (
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search by symbol, exchange, ISIN..."
            className="max-w-md w-full"
          />
        )}
      </div>

      {/* Main Content Area */}
      {activeTab === 'equity' ? (
        /* Equity Holdings Table */
        holdingsQuery.isLoading ? (
          <TableSkeleton />
        ) : holdingsQuery.isError ? (
          <ErrorBanner message={holdingsQuery.error.message} onRetry={() => holdingsQuery.refetch()} />
        ) : filteredHoldings.length === 0 ? (
          <EmptyState
            title="No Equity Holdings Found"
            description={
              searchQuery
                ? 'No equity stocks match your search criteria.'
                : `You currently have no equity holdings at ${currentEndpointUrl}.`
            }
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-3.5 px-4">Equity Stock</th>
                    <th className="py-3.5 px-4 text-right">Quantity</th>
                    <th className="py-3.5 px-4 text-right">Avg Buy Price</th>
                    <th className="py-3.5 px-4 text-right">Live LTP</th>
                    <th className="py-3.5 px-4 text-right">Today's P&L</th>
                    <th className="py-3.5 px-4 text-right">Invested Val</th>
                    <th className="py-3.5 px-4 text-right">Current Val</th>
                    <th className="py-3.5 px-4 text-right">Total P&L</th>
                    <th className="py-3.5 px-4 text-right">Portfolio Weight</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium text-gray-800 dark:text-gray-200">
                  {filteredHoldings.map((h: Holding, idx: number) => {
                    const qty = parseNum(h.quantity);
                    const avgPrice = parseNum(h.averageprice);
                    const ltp = parseNum(h.ltp);
                    const close = parseNum(h.close) || ltp;
                    const investedVal = avgPrice * qty;
                    const curVal = ltp * qty;
                    const pnlVal = parseNum(h.profitandloss ?? (ltp - avgPrice) * qty);
                    const pnlPct =
                      h.pnlpercentage !== undefined
                        ? parseNum(h.pnlpercentage)
                        : investedVal > 0
                        ? (pnlVal / investedVal) * 100
                        : 0;

                    const dayChange = (ltp - close) * qty;
                    const dayChangePct = close > 0 ? ((ltp - close) / close) * 100 : 0;
                    const weightPct = totalEquityValue > 0 ? (curVal / totalEquityValue) * 100 : 0;

                    const symbolKey = h.tradingsymbol || '';
                    const flash = flashes[symbolKey];
                    const isRecentFlash = flash && Date.now() - flash.timestamp < 2500;

                    return (
                      <tr
                        key={h.symboltoken || h.isin || idx}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        {/* Symbol & Segments */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              {h.tradingsymbol || 'N/A'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                              EQUITY
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {h.exchange || 'NSE'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-0.5">
                            {h.isin && <span>ISIN: {h.isin}</span>}
                            {h.symboltoken && <span>• Token: {h.symboltoken}</span>}
                          </div>
                        </td>

                        {/* Qty */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">{qty}</td>

                        {/* Avg Price */}
                        <td className="py-3.5 px-4 text-right font-mono">{formatINR(avgPrice)}</td>

                        {/* Live LTP (with Realtime Flash) */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">
                          <span
                            className={`px-2 py-0.5 rounded transition-all duration-300 ${
                              isRecentFlash
                                ? flash.direction === 'up'
                                  ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold ring-1 ring-emerald-500'
                                  : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-extrabold ring-1 ring-rose-500'
                                : 'text-gray-900 dark:text-white'
                            }`}
                          >
                            {formatINR(ltp)}
                          </span>
                        </td>

                        {/* Today's Change */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span
                            className={`font-semibold block ${
                              dayChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {dayChange >= 0 ? '+' : ''}
                            {formatINR(dayChange)}
                          </span>
                          <span className="text-[10px] text-gray-400">
                            {dayChangePct >= 0 ? '+' : ''}
                            {dayChangePct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Invested Value */}
                        <td className="py-3.5 px-4 text-right font-mono text-gray-600 dark:text-gray-300">
                          {formatINR(investedVal)}
                        </td>

                        {/* Current Value */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-900 dark:text-white">
                          {formatINR(curVal)}
                        </td>

                        {/* Total PnL */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span
                            className={`font-bold text-sm block ${
                              pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {pnlVal >= 0 ? '+' : ''}
                            {formatINR(pnlVal)}
                          </span>
                          <span
                            className={`text-xs font-semibold ${
                              pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {pnlPct >= 0 ? '+' : ''}
                            {pnlPct.toFixed(2)}%
                          </span>
                        </td>

                        {/* Portfolio Weight */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          <span className="font-semibold">{weightPct.toFixed(1)}%</span>
                          <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 ml-auto overflow-hidden">
                            <div className="h-full bg-blue-600 rounded-full" style={{ width: `${weightPct}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : activeTab === 'positions' ? (
        /* Open Positions Table */
        positionsQuery.isLoading ? (
          <TableSkeleton />
        ) : positionsQuery.isError ? (
          <ErrorBanner message={positionsQuery.error.message} onRetry={() => positionsQuery.refetch()} />
        ) : filteredPositions.length === 0 ? (
          <EmptyState
            title="No Positions Found"
            description={
              searchQuery
                ? 'No positions match your search criteria.'
                : `You currently have no open trading positions at ${currentEndpointUrl}.`
            }
          />
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-3.5 px-4">Instrument / Symbol</th>
                    <th className="py-3.5 px-4">Product</th>
                    <th className="py-3.5 px-4 text-right">Net Qty</th>
                    <th className="py-3.5 px-4 text-right">Avg Price</th>
                    <th className="py-3.5 px-4 text-right">LTP</th>
                    <th className="py-3.5 px-4 text-right">P&L (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium text-gray-800 dark:text-gray-200">
                  {filteredPositions.map((pos, idx) => {
                    const pnlVal = parseNum(pos.pnl || pos.m2m);
                    const netQtyVal = parseNum(pos.netqty || pos.quantity);
                    const isBuy = netQtyVal >= 0;

                    return (
                      <tr
                        key={pos.symboltoken || idx}
                        className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors"
                      >
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">
                              {pos.tradingsymbol || pos.symbol || 'N/A'}
                            </span>
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">
                              {pos.exchange || 'NSE'}
                            </span>
                          </div>
                          <span className="text-[10px] text-gray-400 font-mono">Token: {pos.symboltoken || '-'}</span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {pos.producttype || 'DELIVERY'}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                                isBuy
                                  ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                                  : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                              }`}
                            >
                              {isBuy ? 'BUY' : 'SELL'}
                            </span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono font-semibold">
                          {formatNumber(netQtyVal, 0)}
                        </td>

                        <td className="py-3.5 px-4 text-right font-mono">{formatINR(pos.averageprice)}</td>

                        <td className="py-3.5 px-4 text-right font-mono font-semibold">
                          {formatINR(pos.lp || pos.ltp)}
                        </td>

                        <td
                          className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${
                            pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                          }`}
                        >
                          {pnlVal >= 0 ? '+' : ''}
                          {formatINR(pnlVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : (
        /* Asset Allocation View */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-5 h-5 text-blue-600" />
              <span>Equity Stock Distribution</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Breakdown of your equity portfolio by individual stock position
            </p>

            <div className="space-y-3 pt-2">
              {equityAllocations.map((item) => (
                <div key={item.symbol} className="space-y-1">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold text-gray-800 dark:text-gray-200">{item.symbol}</span>
                    <span className="font-mono text-gray-600 dark:text-gray-400">
                      {formatINR(item.value)} ({item.weight.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${item.weight}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-base text-gray-900 dark:text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-emerald-600" />
              <span>Portfolio Asset Classes</span>
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Overview of equity holdings vs open active derivatives
            </p>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/60">
                <span className="text-[10px] font-bold uppercase text-blue-600 block">Equity Delivery (Cash)</span>
                <span className="text-xl font-extrabold text-gray-900 dark:text-white mt-1 block">
                  {formatINR(totalEquityValue)}
                </span>
                <span className="text-xs text-gray-500">{holdingsList.length} scrips in portfolio</span>
              </div>

              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-800/60">
                <span className="text-[10px] font-bold uppercase text-purple-600 block">Open Positions</span>
                <span className="text-xl font-extrabold text-gray-900 dark:text-white mt-1 block">
                  {positionsList.length} Contracts
                </span>
                <span className="text-xs text-gray-500">{formatINR(totalPositionsPnL)} P&L</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// UI Skeleton Helper
const TableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm animate-pulse space-y-4">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4" />
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/60 rounded w-full" />
      ))}
    </div>
  </div>
);

// Error Banner Helper
const ErrorBanner = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div className="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
    <div>
      <h3 className="font-bold text-rose-700 dark:text-rose-400 text-sm">Failed to load portfolio data</h3>
      <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{message}</p>
    </div>
    <button
      onClick={onRetry}
      className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl shadow transition-colors"
    >
      Retry Fetching
    </button>
  </div>
);

// Empty State Helper
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-12 text-center shadow-sm">
    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 text-gray-400 rounded-full flex items-center justify-center mx-auto mb-4">
      <FolderOpen className="w-8 h-8 text-gray-400" />
    </div>
    <h3 className="font-bold text-gray-900 dark:text-white text-base">{title}</h3>
    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">{description}</p>
  </div>
);

export default PortfolioScreen;
