import React from 'react';
import {
  Zap,
  Wallet,
} from 'lucide-react';

export type AiTradingTab = 'signals' | 'budget' | 'option-chain' | 'orders';

export interface AiTradingNavTabsProps {
  activeTab: AiTradingTab;
  onTabChange: (tab: AiTradingTab) => void;
  signalsCount: number;
  ordersCount: number;
  activeSniperCount?: number;
  buyCount: number;
  sellCount: number;
  holdCount: number;
  brokerFunds: { net: number; available: number } | null;
  onUseBrokerFunds: (amount: number) => void;
}

export const AiTradingNavTabs: React.FC<AiTradingNavTabsProps> = ({
  activeTab,
  onTabChange,
  signalsCount,
  ordersCount,
  activeSniperCount = 0,
  buyCount,
  sellCount,
  holdCount,
  brokerFunds,
  onUseBrokerFunds,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
      {/* Scrollable Tabs */}
      <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto no-scrollbar py-0.5 w-full md:w-auto">
        <button
          type="button"
          onClick={() => onTabChange('signals')}
          className={`flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-xs ${
            activeTab === 'signals'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-400/40'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-amber-500 dark:text-amber-300" />
          <span>AI Signals Matrix</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-extrabold border border-blue-200 dark:border-blue-500/30">
            {signalsCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('budget')}
          className={`flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-xs ${
            activeTab === 'budget'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/25 ring-1 ring-emerald-400/40'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>AI Budget Advisor</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 font-extrabold border border-emerald-200 dark:border-emerald-500/30">
            Smart Sizing
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('option-chain')}
          className={`flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-xs ${
            activeTab === 'option-chain'
              ? 'bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-md shadow-purple-600/25 ring-1 ring-purple-400/40'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          <span>Option Chain Scanner</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-extrabold border border-purple-200 dark:border-purple-500/30">
            CE/PE Signals
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('orders')}
          className={`flex items-center space-x-2 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap shadow-xs ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 ring-1 ring-blue-400/40'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          <span>
            Active Sniper &amp; Orders (
            {activeSniperCount > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-300 font-extrabold">{activeSniperCount} Active • </span>
            ) : null}
            {ordersCount})
          </span>
        </button>
      </div>

      {/* Right Action / Indicators / Layout Toggle */}
      <div className="flex items-center space-x-2.5 self-end md:self-auto flex-wrap">
        {activeTab === 'signals' && (
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold">
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30">
              BUY: {buyCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30">
              SELL: {sellCount}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-500/30">
              HOLD: {holdCount}
            </span>
          </div>
        )}

        {brokerFunds && (
          <div className="flex items-center space-x-1.5 text-xs">
            <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 shadow-xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              <span className="text-gray-500 dark:text-gray-400">Cash:</span>
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{brokerFunds.available.toLocaleString('en-IN')}
              </strong>
            </span>
            {brokerFunds.available > 0 && activeTab === 'budget' && (
              <button
                type="button"
                onClick={() => onUseBrokerFunds(brokerFunds.available)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-bold transition-colors"
              >
                Use Full Margin
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiTradingNavTabs;
