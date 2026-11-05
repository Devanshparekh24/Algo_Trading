import React from 'react';
import { RefreshCw, CheckCircle2, LayoutGrid, Table } from 'lucide-react';

export interface PortfolioHeaderProps {
  isConnected: boolean;
  lastTickTime: string | null;
  isFetching: boolean;
  viewMode: 'table' | 'cards';
  onViewModeChange: (mode: 'table' | 'cards') => void;
  onRefresh: () => void;
}

export const PortfolioHeader: React.FC<PortfolioHeaderProps> = ({
  isConnected,
  lastTickTime,
  isFetching,
  viewMode,
  onViewModeChange,
  onRefresh,
}) => {
  return (
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-gray-200 dark:border-gray-800">
      <div>
        <div className="flex items-center gap-2.5 flex-wrap">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Portfolio Console
          </h1>

          {/* Connection Status Pill */}
          <span
            className={`text-xs px-2.5 py-1 rounded-full font-semibold border inline-flex items-center gap-1.5 transition-colors ${
              isConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span className="hidden xs:inline">
              {isConnected ? 'SmartAPI Live Connected' : 'Connecting to Live Feed...'}
            </span>
            <span className="xs:hidden">{isConnected ? 'Live' : 'Connecting'}</span>
          </span>

          {lastTickTime && (
            <span className="text-[11px] font-mono text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800/80 px-2 py-0.5 rounded-md border border-gray-200 dark:border-gray-700 inline-flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
              <span>{lastTickTime}</span>
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Real-time equity holdings and derivative positions streamed live via Angel One SmartAPI
        </p>
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
        {/* View Switcher: Table vs Cards */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 p-0.5 rounded-xl border border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={() => onViewModeChange('table')}
            className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'table'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Table View (Full details)"
          >
            <Table className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Table</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange('cards')}
            className={`p-1.5 px-2.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'cards'
                ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
            title="Card Grid View (Touch & Mobile Friendly)"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Cards</span>
          </button>
        </div>

        {/* Refresh Live Data Button */}
        <button
          type="button"
          onClick={onRefresh}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-all disabled:opacity-50"
          title="Fetch latest portfolio and refresh prices"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>
    </div>
  );
};

export default PortfolioHeader;
