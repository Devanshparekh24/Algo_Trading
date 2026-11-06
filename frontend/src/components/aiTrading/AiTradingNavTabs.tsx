import React from 'react';
import {
  Zap,
  Wallet,
  BarChart2,
  Sparkles,
  History,
} from 'lucide-react';

export type AiTradingTab = 'signals' | 'budget' | 'chart' | 'analyzer' | 'orders';

interface AiTradingNavTabsProps {
  activeTab: AiTradingTab;
  onTabChange: (tab: AiTradingTab) => void;
  signalsCount: number;
  ordersCount: number;
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
  buyCount,
  sellCount,
  holdCount,
  brokerFunds,
  onUseBrokerFunds,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3 transition-colors">
      {/* Scrollable Tabs */}
      <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar py-0.5">
        <button
          type="button"
          onClick={() => onTabChange('signals')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'signals'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Zap className="w-4 h-4" />
          <span>AI Signals ({signalsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('budget')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'budget'
              ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/20 border border-emerald-400/30'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Wallet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
          <span>AI Budget Advisor</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-500/30">
            Smart Sizing
          </span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('chart')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'chart'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <BarChart2 className="w-4 h-4" />
          <span>TradingView Chart</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('analyzer')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'analyzer'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>Deep Scrip Analyzer</span>
        </button>

        <button
          type="button"
          onClick={() => onTabChange('orders')}
          className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs md:text-sm font-semibold transition-all whitespace-nowrap ${
            activeTab === 'orders'
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800/60'
          }`}
        >
          <History className="w-4 h-4" />
          <span>Execution Book ({ordersCount})</span>
        </button>
      </div>

      {/* Right Action / Indicators */}
      <div className="flex items-center space-x-2 self-end md:self-auto">
        {activeTab === 'signals' && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-500/30 font-semibold">
              BUY: {buyCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-500/30 font-semibold">
              SELL: {sellCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-500/30 font-semibold">
              HOLD: {holdCount}
            </span>
          </div>
        )}

        {activeTab === 'budget' && brokerFunds && (
          <div className="flex items-center space-x-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300 flex items-center gap-1.5 shadow-2xs">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Broker Cash:{' '}
              <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                ₹{brokerFunds.available.toLocaleString('en-IN')}
              </strong>
            </span>
            {brokerFunds.available > 0 && (
              <button
                type="button"
                onClick={() => onUseBrokerFunds(brokerFunds.available)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                Use Funds
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AiTradingNavTabs;
