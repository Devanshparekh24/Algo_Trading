import React from 'react';
import { PieChart, Layers, ShieldCheck } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface EquityAllocationItem {
  symbol: string;
  value: number;
  weight: number;
  color: string;
}

export interface PortfolioAllocationChartProps {
  allocations: EquityAllocationItem[];
  totalEquityValue: number;
  totalPositionsPnL: number;
  holdingsCount: number;
  positionsCount: number;
}

export const PortfolioAllocationChart: React.FC<PortfolioAllocationChartProps> = ({
  allocations,
  totalEquityValue,
  totalPositionsPnL,
  holdingsCount,
  positionsCount,
}) => {
  const topHolding = allocations.length > 0 ? allocations.reduce((prev, curr) => (curr.weight > prev.weight ? curr : prev), allocations[0]) : null;

  return (
    <div className="space-y-6">
      {/* Top Allocation Distribution Bar */}
      {allocations.length > 0 && (
        <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
            <div>
              <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
                <PieChart className="w-4 h-4 text-blue-600" />
                <span>Equity Stock Allocation</span>
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Distribution of capital across active Demat delivery holdings
              </p>
            </div>
            <span className="text-gray-500 dark:text-gray-400 font-mono text-xs bg-gray-100 dark:bg-gray-700/70 px-2.5 py-1 rounded-lg">
              {holdingsCount} Holding(s) • Total {formatINR(totalEquityValue)}
            </span>
          </div>

          {/* Progress Segment Bar */}
          <div className="h-3.5 w-full bg-gray-100 dark:bg-gray-700/70 rounded-full overflow-hidden flex shadow-inner">
            {allocations.map((item) => (
              <div
                key={item.symbol}
                style={{ width: `${item.weight}%`, backgroundColor: item.color }}
                className="h-full transition-all hover:opacity-85 cursor-pointer"
                title={`${item.symbol}: ${item.weight.toFixed(1)}% (${formatINR(item.value)})`}
              />
            ))}
          </div>

          {/* Quick Scrip Pills */}
          <div className="flex flex-wrap gap-2 text-xs pt-1">
            {allocations.map((item) => (
              <div
                key={item.symbol}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/80 transition-all hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                <span className="font-bold text-gray-800 dark:text-gray-200">{item.symbol.replace('-EQ', '')}</span>
                <span className="text-gray-400 font-mono text-[11px]">{item.weight.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Asset Breakdown & Portfolio Health Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
        {/* Scrip Breakdown List */}
        <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700/60">
            <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
              <PieChart className="w-4 h-4 text-blue-500" />
              <span>Weight By Scrip</span>
            </h4>
            <span className="text-[11px] text-gray-400">Concentration breakdown</span>
          </div>

          {allocations.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No active stock holdings to display.</p>
          ) : (
            <div className="space-y-3.5">
              {allocations.map((item) => (
                <div key={item.symbol} className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-bold text-gray-800 dark:text-gray-200">{item.symbol}</span>
                    </div>
                    <span className="font-mono text-gray-600 dark:text-gray-300 font-semibold">
                      {formatINR(item.value)} <span className="text-gray-400 text-[11px]">({item.weight.toFixed(1)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-500" style={{ width: `${item.weight}%`, backgroundColor: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Asset Class & Exposure Split */}
        <div className="space-y-4">
          {/* Asset Split Cards */}
          <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-gray-100 dark:border-gray-700/60">
              <h4 className="font-bold text-sm text-gray-900 dark:text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-500" />
                <span>Asset Class Exposure</span>
              </h4>
              <span className="text-[11px] text-gray-400">Cash vs Derivatives</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Cash Delivery Card */}
              <div className="p-4 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-100 dark:border-blue-900/40">
                <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 block tracking-wider">
                  Equity Delivery (Cash)
                </span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white mt-1 block font-mono">
                  {formatINR(totalEquityValue)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                  {holdingsCount} Delivery Scrip(s)
                </span>
              </div>

              {/* Derivatives Card */}
              <div className="p-4 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/40">
                <span className="text-[10px] font-bold uppercase text-purple-600 dark:text-purple-400 block tracking-wider">
                  Open Positions (F&O)
                </span>
                <span className="text-lg font-extrabold text-gray-900 dark:text-white mt-1 block font-mono">
                  {formatINR(totalPositionsPnL)}
                </span>
                <span className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 block">
                  {positionsCount} Active Contract(s)
                </span>
              </div>
            </div>
          </div>

          {/* Portfolio Concentration Insight */}
          {topHolding && (
            <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 sm:p-5 shadow-xs flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div className="text-xs">
                <h5 className="font-bold text-gray-900 dark:text-white text-sm">
                  Concentration Risk Insight
                </h5>
                <p className="text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">
                  Top asset <strong className="text-gray-800 dark:text-gray-200">{topHolding.symbol}</strong> accounts for{' '}
                  <strong className="text-blue-600 dark:text-blue-400 font-mono">{topHolding.weight.toFixed(1)}%</strong> of your total equity allocation.
                  {topHolding.weight > 40
                    ? ' High single-stock concentration; consider rebalancing.'
                    : ' Healthy diversification across stock holdings.'}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PortfolioAllocationChart;
