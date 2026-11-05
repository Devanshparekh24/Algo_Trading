import React from 'react';
import { TrendingUp, TrendingDown, Wallet, IndianRupee, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface PortfolioKpiCardsProps {
  activeTab: 'equity' | 'positions' | 'allocation';
  totalPositionsPnL: number;
  totalEquityPnL: number;
  totalEquityPnlPercent: number;
  totalEquityValue: number;
  totalEquityInvested: number;
  todayEquityPnL: number;
  todayEquityPnlPercent: number;
}

export const PortfolioKpiCards: React.FC<PortfolioKpiCardsProps> = ({
  activeTab,
  totalPositionsPnL,
  totalEquityPnL,
  totalEquityPnlPercent,
  totalEquityValue,
  totalEquityInvested,
  todayEquityPnL,
  todayEquityPnlPercent,
}) => {
  const isPositionsTab = activeTab === 'positions';
  const displayPnL = isPositionsTab ? totalPositionsPnL : totalEquityPnL;
  const isPnlPositive = displayPnL >= 0;
  const isTodayPositive = todayEquityPnL >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {/* 1. Total P&L / Positions P&L */}
      <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
        <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span>{isPositionsTab ? 'Positions M2M P&L' : 'Total Equity P&L'}</span>
          <span
            className={`p-1.5 rounded-lg ${
              isPnlPositive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            {isPnlPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span
            className={`text-xl sm:text-2xl font-extrabold font-mono transition-colors ${
              isPnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isPnlPositive ? '+' : ''}
            {formatINR(displayPnL)}
          </span>
          {!isPositionsTab && (
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
                totalEquityPnlPercent >= 0
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                  : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
              }`}
            >
              {totalEquityPnlPercent >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              <span>
                {totalEquityPnlPercent >= 0 ? '+' : ''}
                {totalEquityPnlPercent.toFixed(2)}%
              </span>
            </span>
          )}
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">
          {isPositionsTab ? 'Net realized and unrealized M2M' : 'Net return against purchase price'}
        </p>
      </div>

      {/* 2. Live Portfolio Valuation */}
      <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
        <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span>Live Market Valuation</span>
          <span className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
            <Wallet className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-xl sm:text-2xl font-extrabold font-mono text-gray-900 dark:text-white">
            {formatINR(totalEquityValue)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">Current portfolio worth at live market LTP</p>
      </div>

      {/* 3. Total Invested Capital */}
      <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
        <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span>Capital Invested</span>
          <span className="p-1.5 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
            <IndianRupee className="w-4 h-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline">
          <span className="text-xl sm:text-2xl font-extrabold font-mono text-gray-900 dark:text-white">
            {formatINR(totalEquityInvested)}
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">Total purchase value of active delivery shares</p>
      </div>

      {/* 4. Today's Market Gain/Loss */}
      <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 sm:p-5 shadow-xs transition-all hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600">
        <div className="flex justify-between items-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
          <span>Today's Market Gain/Loss</span>
          <span
            className={`p-1.5 rounded-lg ${
              isTodayPositive
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400'
            }`}
          >
            {isTodayPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
          </span>
        </div>
        <div className="mt-3 flex items-baseline justify-between gap-2 flex-wrap">
          <span
            className={`text-xl sm:text-2xl font-extrabold font-mono ${
              isTodayPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}
          >
            {isTodayPositive ? '+' : ''}
            {formatINR(todayEquityPnL)}
          </span>
          <span
            className={`text-xs font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-0.5 ${
              todayEquityPnlPercent >= 0
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
            }`}
          >
            {todayEquityPnlPercent >= 0 ? '+' : ''}
            {todayEquityPnlPercent.toFixed(2)}%
          </span>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">Intraday gain/loss vs previous closing price</p>
      </div>
    </div>
  );
};

export default PortfolioKpiCards;
