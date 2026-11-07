import React from 'react';
import {
  Zap,
  Wallet,
  BarChart2,
  Sparkles,
  History,
  Columns,
  LayoutGrid,
} from 'lucide-react';

export type AiTradingTab = 'signals' | 'budget' | 'chart' | 'analyzer' | 'orders' | 'option-chain';

export interface AiTradingNavTabsProps {
  activeTab: AiTradingTab;
  onTabChange: (tab: AiTradingTab) => void;
  signalsCount: number;
  ordersCount: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  brokerFunds: { net: number; available: number } | null;
  onUseBrokerFunds: (amount: number) => void;
  layoutMode?: 'STUDIO' | 'TABS';
  onToggleLayoutMode?: (mode: 'STUDIO' | 'TABS') => void;
}

export const AiTradingNavTabs: React.FC<AiTradingNavTabsProps> = ({
  activeTab,
  onTabChange,
  signalsCount,
  ordersCount,
  buyCount,
  sellCount,
  holdCount,
  brokerFunds,
  onUseBrokerFunds,
  layoutMode = 'STUDIO',
  onToggleLayoutMode,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-800 pb-3 transition-colors">
      {/* Scrollable Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onTabChange('signals')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'signals'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-300" />
          <span>AI Signals Matrix</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 font-extrabold border border-blue-500/30">
            {signalsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('budget')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'budget'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-600/25 ring-1 ring-emerald-400/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-400" />
          <span>AI Budget Advisor</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/30">
            Smart Sizing
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('option-chain')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'option-chain'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-lg shadow-purple-600/25 ring-1 ring-purple-400/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-purple-400" />
          <span>Option Chain Scanner</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-extrabold border border-purple-500/30">
            CE/PE Signals
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('chart')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'chart'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <BarChart2 className="w-4 h-4 text-blue-400" />
          <span>TradingView Chart Studio</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('analyzer')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'analyzer'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span>Deep Instrument Analyzer</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('orders')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-1 ring-blue-400/40'
              : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
          }`}
        >
          <History className="w-4 h-4 text-gray-400" />
          <span>Execution Book ({ordersCount})</span>
        </button>
      </div>

      {/* Right Action / Indicators / Layout Toggle */}
      <div className="flex items-center space-x-2.5 self-end md:self-auto flex-wrap">
        {activeTab === 'signals' && (
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold">
            <span className="px-2 py-0.5 rounded-md bg-emerald-950/60 text-emerald-400 border border-emerald-500/30">
              BUY: {buyCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-950/60 text-rose-400 border border-rose-500/30">
              SELL: {sellCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-400 border border-amber-500/30">
              HOLD: {holdCount}
            </span>
          </div>
        )}

        {brokerFunds && (
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="px-2.5 py-1 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400">Cash:</span>
              <strong className="text-emerald-400 font-mono">
                ₹{brokerFunds.available.toLocaleString('en-IN')}
              </strong>
            </span>
            {brokerFunds.available > 0 && activeTab === 'budget' && (
              <button
                type="button"
                onClick={() => onUseBrokerFunds(brokerFunds.available)}
                className="text-xs text-blue-400 hover:text-blue-300 font-bold underline transition-colors"
              >
                Use Full Margin
              </button>
            )}
          </div>
        )}

        {/* Layout Switcher (Desktop) */}
        {onToggleLayoutMode && (
          <div className="hidden lg:flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800">
            <button
              type="button"
              onClick={() => onToggleLayoutMode('STUDIO')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                layoutMode === 'STUDIO'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Studio Split Deck: Signals on left, Chart on right"
            >
              <Columns className="w-3.5 h-3.5" />
              <span>Studio Deck</span>
            </button>
            <button
              type="button"
              onClick={() => onToggleLayoutMode('TABS')}
              className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                layoutMode === 'TABS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white'
              }`}
              title="Focus View: Full width single tab"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Tabs</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiTradingNavTabs;
