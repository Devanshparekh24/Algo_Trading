import React from 'react';
import {
  Layers,
  X,
  ShieldAlert,
  Briefcase,
  Flame,
  Plus,
  Search,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import type { UniverseScrip } from '../../services/aiTradingService';

interface AiUniverseModalProps {
  isOpen: boolean;
  onClose: () => void;
  universe: UniverseScrip[];
  isLoadingUniverse: boolean;
  universeSearchQuery: string;
  onSearchQueryChange: (query: string) => void;
  universeSearchResults: any[];
  isSearchingUniverse: boolean;
  universeFilter: 'ALL' | 'CUSTOM' | 'HOLDING' | 'MARKET_MOVER' | 'CORE';
  setUniverseFilter: (filter: 'ALL' | 'CUSTOM' | 'HOLDING' | 'MARKET_MOVER' | 'CORE') => void;
  onAddScrip: (item: any) => void;
  onRemoveScrip: (token: string, symbol: string) => void;
  onResetUniverse: () => void;
  onReScanUniverse: () => void;
}

export const AiUniverseModal: React.FC<AiUniverseModalProps> = ({
  isOpen,
  onClose,
  universe,
  isLoadingUniverse,
  universeSearchQuery,
  onSearchQueryChange,
  universeSearchResults,
  isSearchingUniverse,
  universeFilter,
  setUniverseFilter,
  onAddScrip,
  onRemoveScrip,
  onResetUniverse,
  onReScanUniverse,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-800 pb-4">
          <div className="flex items-center space-x-3">
            <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-400/30">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Dynamic AI Scanner Universe
                <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30 font-mono">
                  {universe.length} Scrips
                </span>
              </h3>
              <p className="text-xs text-gray-400">
                AI continuously analyzes these assets. Add custom stocks, Demat holdings, or market movers.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Source Breakdown Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
              Core Index
            </span>
            <span className="font-bold text-white font-mono">
              {universe.filter((u) => u.source === 'CORE' || !u.source).length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
              Holdings
            </span>
            <span className="font-bold text-emerald-400 font-mono">
              {universe.filter((u) => u.source === 'HOLDING').length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              Movers
            </span>
            <span className="font-bold text-amber-400 font-mono">
              {universe.filter((u) => u.source === 'MARKET_MOVER').length}
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
            <span className="text-gray-400 flex items-center gap-1.5">
              <Plus className="w-3.5 h-3.5 text-purple-400" />
              Custom
            </span>
            <span className="font-bold text-purple-400 font-mono">
              {universe.filter((u) => u.source === 'CUSTOM').length}
            </span>
          </div>
        </div>

        {/* Search and Add to Universe */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
            <Search className="w-3.5 h-3.5 text-purple-400" />
            Search & Add Stock or F&O Strike to Scanner
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. ZOMATO, TATAMOTORS, NIFTY 25000 PE, INFY..."
              value={universeSearchQuery}
              onChange={(e) => onSearchQueryChange(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-gray-950 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
            />
            {isSearchingUniverse && (
              <RefreshCw className="w-4 h-4 text-purple-400 animate-spin absolute right-3 top-2.5" />
            )}
          </div>

          {/* Search Results Dropdown */}
          {universeSearchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto rounded-xl bg-gray-950 border border-gray-800 p-2 space-y-1.5 divide-y divide-gray-800/60 shadow-xl">
              {universeSearchResults.map((item) => (
                <div
                  key={item.token}
                  className="pt-1.5 first:pt-0 flex items-center justify-between hover:bg-gray-900/60 p-2 rounded-lg transition-all"
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{item.symbol}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                        {item.exch_seg || 'NSE'}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-400 truncate max-w-xs">
                      {item.name || item.symbol} &bull; Token: {item.token}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onAddScrip(item)}
                    className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add</span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter Tabs */}
        <div className="flex items-center space-x-2 border-b border-gray-800 pb-2 text-xs overflow-x-auto no-scrollbar">
          {(['ALL', 'CUSTOM', 'HOLDING', 'MARKET_MOVER', 'CORE'] as const).map((tab) => {
            const count =
              tab === 'ALL'
                ? universe.length
                : tab === 'CORE'
                ? universe.filter((u) => u.source === 'CORE' || !u.source).length
                : universe.filter((u) => u.source === tab).length;

            return (
              <button
                key={tab}
                type="button"
                onClick={() => setUniverseFilter(tab)}
                className={`px-3 py-1 rounded-lg font-medium transition-all whitespace-nowrap ${
                  universeFilter === tab
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                }`}
              >
                {tab.replace('_', ' ')} ({count})
              </button>
            );
          })}
        </div>

        {/* Active Universe List */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-72">
          {isLoadingUniverse ? (
            <div className="flex items-center justify-center py-8 text-gray-400 space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
              <span className="text-xs">Loading active dynamic universe...</span>
            </div>
          ) : universe.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-xs">
              No scrips in universe. Click Reset or add a custom scrip above.
            </div>
          ) : (
            universe
              .filter((item) => {
                if (universeFilter === 'ALL') return true;
                if (universeFilter === 'CORE') return item.source === 'CORE' || !item.source;
                return item.source === universeFilter;
              })
              .map((item) => {
                const isCustom = item.source === 'CUSTOM';
                const isHolding = item.source === 'HOLDING';
                const isMover = item.source === 'MARKET_MOVER';

                return (
                  <div
                    key={`${item.exchange}_${item.token}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950/80 border border-gray-800/80 hover:border-gray-700 transition-all text-xs"
                  >
                    <div className="flex items-center space-x-3">
                      <span
                        className={`p-1.5 rounded-lg ${
                          isCustom
                            ? 'bg-purple-500/20 text-purple-300'
                            : isHolding
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : isMover
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-blue-500/20 text-blue-300'
                        }`}
                      >
                        {isCustom ? (
                          <Plus className="w-3.5 h-3.5" />
                        ) : isHolding ? (
                          <Briefcase className="w-3.5 h-3.5" />
                        ) : isMover ? (
                          <Flame className="w-3.5 h-3.5" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                      </span>
                      <div>
                        <div className="font-bold text-white flex items-center gap-1.5">
                          <span>{item.symbol}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                            {item.exchange}
                          </span>
                          {item.segment && (
                            <span className="text-[9px] px-1 py-0.2 rounded bg-gray-800 text-gray-400 font-mono">
                              {item.segment}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          {item.name || item.symbol} &bull; Token: <span className="font-mono">{item.token}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                          isCustom
                            ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                            : isHolding
                            ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                            : isMover
                            ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                            : 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                        }`}
                      >
                        {isCustom
                          ? 'Custom'
                          : isHolding
                          ? 'Demat Holding'
                          : isMover
                          ? 'Market Mover'
                          : 'Core Index'}
                      </span>

                      {isCustom && (
                        <button
                          type="button"
                          onClick={() => onRemoveScrip(item.token, item.symbol)}
                          className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                          title="Remove from universe"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
          <button
            type="button"
            onClick={onResetUniverse}
            className="text-gray-400 hover:text-rose-300 transition-all"
          >
            Reset to Dynamic Baseline
          </button>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold transition-all"
            >
              Close
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onReScanUniverse();
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/30 transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-Scan Universe Now</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

