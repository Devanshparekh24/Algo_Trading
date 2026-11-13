import React from 'react';
import { ArrowUpRight, ArrowDownRight, ChevronRight } from 'lucide-react';
import type { Holding } from '../../types';
import { formatINR } from '../../utils/formatters';

export interface PriceTickFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export interface HoldingsCardGridProps {
  holdings: Holding[];
  flashes: Record<string, PriceTickFlash>;
  totalEquityValue: number;
  onSelectHolding?: (holding: Holding) => void;
}

export const HoldingsCardGrid: React.FC<HoldingsCardGridProps> = ({
  holdings,
  flashes,
  totalEquityValue,
  onSelectHolding,
}) => {
  const parseNum = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {holdings.map((h: Holding, idx: number) => {
        const symbolKey = h.tradingsymbol || '';
        const flash = flashes[symbolKey] || (h.symboltoken ? flashes[h.symboltoken] : undefined);
        const qty = parseNum(h.quantity);
        const avgPrice = parseNum(h.averageprice);
        const ltp = flash && flash.ltp > 0 ? flash.ltp : parseNum(h.ltp);
        const close = parseNum(h.close) || ltp;
        const investedVal = avgPrice * qty;
        const curVal = ltp * qty;
        const pnlVal = (ltp - avgPrice) * qty;
        const pnlPct = investedVal > 0 ? (pnlVal / investedVal) * 100 : 0;

        const dayChange = (ltp - close) * qty;
        const dayChangePct = close > 0 ? ((ltp - close) / close) * 100 : 0;
        const weightPct = totalEquityValue > 0 ? (curVal / totalEquityValue) * 100 : 0;

        // eslint-disable-next-line react-hooks/purity
        const isRecentFlash = flash && Date.now() - flash.timestamp < 2500;

        const isPnlPositive = pnlVal >= 0;
        const isDayPositive = dayChange >= 0;

        return (
          <div
            key={h.symboltoken || h.isin || idx}
            onClick={() => onSelectHolding?.(h)}
            className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-xs transition-all hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer flex flex-col justify-between gap-3 group"
          >
            {/* Card Header: Symbol & LTP */}
            <div>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {h.tradingsymbol || 'N/A'}
                    </h3>
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                      EQUITY
                    </span>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                      {h.exchange || 'NSE'}
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                    Qty: <strong className="text-gray-700 dark:text-gray-300 font-semibold">{qty}</strong> • Avg: {formatINR(avgPrice)} • Weight: {weightPct.toFixed(1)}%
                  </div>
                </div>

                {/* Live LTP with Flash */}
                <div className="text-right">
                  <span
                    className={`font-mono font-extrabold text-base block px-2 py-0.5 rounded transition-all duration-300 ${
                      isRecentFlash
                        ? flash.direction === 'up'
                          ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 scale-105'
                          : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 scale-105'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {formatINR(ltp)}
                  </span>
                  <div className="flex items-center justify-end text-[11px] font-mono mt-0.5 gap-1">
                    <span
                      className={`font-semibold flex items-center ${
                        isDayPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {isDayPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Middle Stats Grid: Valuation */}
            <div className="grid grid-cols-2 gap-2 bg-gray-50/70 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-xs">
              <div>
                <span className="text-[10px] font-medium text-gray-400 block uppercase">Invested</span>
                <span className="font-mono font-semibold text-gray-700 dark:text-gray-300">
                  {formatINR(investedVal)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-medium text-gray-400 block uppercase">Current Value</span>
                <span className="font-mono font-bold text-gray-900 dark:text-white">
                  {formatINR(curVal)}
                </span>
              </div>
            </div>

            {/* Bottom Row: Today's P&L vs Overall P&L */}
            <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-gray-750 text-xs">
              {/* Today's Gain */}
              <div>
                <span className="text-[10px] text-gray-400 block">Today's P&L</span>
                <span
                  className={`font-mono font-semibold text-xs ${
                    isDayPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isDayPositive ? '+' : ''}{formatINR(dayChange)}
                </span>
              </div>

              {/* Total Return Pill */}
              <div className="text-right flex items-center gap-1.5">
                <div>
                  <span className="text-[10px] text-gray-400 block">Total Return</span>
                  <span
                    className={`font-mono font-bold text-xs inline-flex items-center gap-0.5 ${
                      isPnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {isPnlPositive ? '+' : ''}{formatINR(pnlVal)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
                  </span>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default HoldingsCardGrid;
