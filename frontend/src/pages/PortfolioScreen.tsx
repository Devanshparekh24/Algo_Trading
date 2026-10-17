import React, { useState, useMemo } from 'react';
import { RefreshCw, TrendingUp, BarChart3, ExternalLink, FolderOpen } from 'lucide-react';
import { usePositions, useHoldings } from '../hooks/usePortfolio';
import type { Position, Holding } from '../types';
import SearchInput from '../components/common/SearchInput';
import { formatINR, formatNumber } from '../utils/formatters';

export const PortfolioScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'positions' | 'holdings'>('positions');
  const [useRootEndpoint, setUseRootEndpoint] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState('');

  const positionsQuery = usePositions(useRootEndpoint);
  const holdingsQuery = useHoldings(useRootEndpoint);

  const parseNum = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  // Filtered lists based on search input
  const filteredPositions = useMemo(() => {
    if (!positionsQuery.data) return [];
    return positionsQuery.data.filter((pos: Position) => {
      const sym = (pos.tradingsymbol || pos.symbol || '').toLowerCase();
      const ex = (pos.exchange || '').toLowerCase();
      const prd = (pos.producttype || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return sym.includes(query) || ex.includes(query) || prd.includes(query);
    });
  }, [positionsQuery.data, searchQuery]);

  const filteredHoldings = useMemo(() => {
    if (!holdingsQuery.data) return [];
    return holdingsQuery.data.filter((h: Holding) => {
      const sym = (h.tradingsymbol || '').toLowerCase();
      const ex = (h.exchange || '').toLowerCase();
      const query = searchQuery.toLowerCase();
      return sym.includes(query) || ex.includes(query);
    });
  }, [holdingsQuery.data, searchQuery]);

  // Aggregate stats calculations
  const totalPositionsPnL = useMemo(() => {
    if (!positionsQuery.data) return 0;
    return positionsQuery.data.reduce((sum, pos) => sum + parseNum(pos.pnl || pos.m2m), 0);
  }, [positionsQuery.data]);

  const totalHoldingsPnL = useMemo(() => {
    if (!holdingsQuery.data) return 0;
    return holdingsQuery.data.reduce((sum, h) => sum + parseNum(h.profitandloss), 0);
  }, [holdingsQuery.data]);

  const currentPnL = activeTab === 'positions' ? totalPositionsPnL : totalHoldingsPnL;

  const currentEndpointUrl = useRootEndpoint
    ? activeTab === 'positions'
      ? 'http://localhost:5000/positions'
      : 'http://localhost:5000/holdings'
    : activeTab === 'positions'
      ? 'http://localhost:5000/api/v1/portfolio/positions'
      : 'http://localhost:5000/api/v1/portfolio/holdings';

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 font-sans">
      {/* Top Header & Endpoint Selector */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>Portfolio Dashboard</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold border border-emerald-200 dark:border-emerald-800">
              Live React Query
            </span>
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Real-time open positions & equity holdings powered by SmartAPI
          </p>
        </div>

        {/* Endpoint Selector Controls */}
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
              /api/v1/portfolio/positions
            </button>

            <button
              onClick={() => setUseRootEndpoint(true)}
              className={`px-3 py-1.5 font-bold rounded-lg transition-all ${
                useRootEndpoint
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              /positions (Root)
            </button>
          </div>

          <button
            onClick={() => {
              if (activeTab === 'positions') positionsQuery.refetch();
              else holdingsQuery.refetch();
            }}
            disabled={positionsQuery.isFetching || holdingsQuery.isFetching}
            className="flex items-center space-x-2 px-3.5 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 text-xs font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${positionsQuery.isFetching || holdingsQuery.isFetching ? 'animate-spin text-blue-600' : ''}`}
            />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total PnL Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Total Realized & M2M P&L</span>
            <span className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className={`text-2xl sm:text-3xl font-extrabold ${currentPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {currentPnL >= 0 ? '+' : ''}{formatINR(currentPnL)}
            </span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {activeTab === 'positions' ? 'Calculated across all open positions' : 'Calculated across equity holdings'}
          </p>
        </div>

        {/* Count Card */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Active {activeTab === 'positions' ? 'Positions' : 'Holdings'}</span>
            <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
              <BarChart3 className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline">
            <span className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white">
              {activeTab === 'positions' ? positionsQuery.data?.length || 0 : holdingsQuery.data?.length || 0}
            </span>
            <span className="ml-2 text-xs font-medium text-gray-500">items</span>
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Active contracts in account</p>
        </div>

        {/* Active Endpoint Tracker */}
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-sm">
          <div className="flex justify-between items-center text-xs font-semibold text-gray-400 uppercase tracking-wider">
            <span>Active Target URL</span>
            <span className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400">
              <ExternalLink className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-3 font-mono text-xs font-bold text-blue-600 dark:text-blue-400 truncate" title={currentEndpointUrl}>
            {currentEndpointUrl}
          </div>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">Target Endpoint</p>
        </div>
      </div>

      {/* Tabs & Search Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        {/* Tab Buttons */}
        <div className="flex bg-gray-200/80 dark:bg-gray-800 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab('positions')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'positions'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Positions ({positionsQuery.data?.length || 0})
          </button>
          <button
            onClick={() => setActiveTab('holdings')}
            className={`px-5 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'holdings'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            Holdings ({holdingsQuery.data?.length || 0})
          </button>
        </div>

        {/* Search Input */}
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by symbol, exchange, product..."
          className="max-w-md w-full"
        />
      </div>

      {/* Main Table Content */}
      {activeTab === 'positions' ? (
        positionsQuery.isLoading ? (
          <TableSkeleton />
        ) : positionsQuery.isError ? (
          <ErrorBanner message={positionsQuery.error.message} onRetry={() => positionsQuery.refetch()} />
        ) : filteredPositions.length === 0 ? (
          <EmptyState title="No Positions Found" description={searchQuery ? 'No positions match your search criteria.' : `You currently have no open trading positions at ${currentEndpointUrl}.`} />
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
                      <tr key={pos.symboltoken || idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                        {/* Symbol & Exchange */}
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

                        {/* Product & Side */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-1.5">
                            <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                              {pos.producttype || 'DELIVERY'}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${isBuy ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'}`}>
                              {isBuy ? 'BUY' : 'SELL'}
                            </span>
                          </div>
                        </td>

                        {/* Net Qty */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">
                          {formatNumber(netQtyVal, 0)}
                        </td>

                        {/* Avg Price */}
                        <td className="py-3.5 px-4 text-right font-mono">
                          {formatINR(pos.averageprice)}
                        </td>

                        {/* LTP */}
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">
                          {formatINR(pos.lp || pos.ltp)}
                        </td>

                        {/* PnL */}
                        <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {pnlVal >= 0 ? '+' : ''}{formatINR(pnlVal)}
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
        /* Holdings Tab Content */
        holdingsQuery.isLoading ? (
          <TableSkeleton />
        ) : holdingsQuery.isError ? (
          <ErrorBanner message={holdingsQuery.error.message} onRetry={() => holdingsQuery.refetch()} />
        ) : filteredHoldings.length === 0 ? (
          <EmptyState title="No Holdings Found" description={searchQuery ? 'No holdings match your search query.' : `You currently have no equity holdings at ${currentEndpointUrl}.`} />
        ) : (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700">
                  <tr>
                    <th className="py-3.5 px-4">Holding Symbol</th>
                    <th className="py-3.5 px-4 text-right">Quantity</th>
                    <th className="py-3.5 px-4 text-right">Avg Price</th>
                    <th className="py-3.5 px-4 text-right">LTP</th>
                    <th className="py-3.5 px-4 text-right">P&L (INR)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 font-medium text-gray-800 dark:text-gray-200">
                  {filteredHoldings.map((h, idx) => {
                    const pnlVal = parseNum(h.profitandloss);
                    return (
                      <tr key={h.symboltoken || idx} className="hover:bg-gray-50/80 dark:hover:bg-gray-700/40 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-gray-900 dark:text-white text-sm">{h.tradingsymbol || 'N/A'}</span>
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                              {h.exchange || 'NSE'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">{h.quantity || 0}</td>
                        <td className="py-3.5 px-4 text-right font-mono">{formatINR(h.averageprice)}</td>
                        <td className="py-3.5 px-4 text-right font-mono font-semibold">{formatINR(h.ltp)}</td>
                        <td className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {pnlVal >= 0 ? '+' : ''}{formatINR(pnlVal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
};

// UI Skeleton Helper
const TableSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm animate-pulse space-y-4">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700/60 rounded w-full"></div>
      ))}
    </div>
  </div>
);

// Error Helper
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
