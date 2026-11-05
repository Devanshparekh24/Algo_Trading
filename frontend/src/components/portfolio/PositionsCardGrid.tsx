import React from 'react';
import { ChevronRight } from 'lucide-react';
import type { Position } from '../../types';
import { formatINR, formatNumber } from '../../utils/formatters';

export interface PriceTickFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export interface PositionsCardGridProps {
  positions: Position[];
  flashes: Record<string, PriceTickFlash>;
  onSelectPosition?: (position: Position) => void;
}

export const PositionsCardGrid: React.FC<PositionsCardGridProps> = ({
  positions,
  flashes,
  onSelectPosition,
}) => {
  const parseNum = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
      {positions.map((pos: Position, idx: number) => {
        const pnlVal = parseNum(pos.pnl || pos.m2m);
        const netQtyVal = parseNum(pos.netqty || pos.quantity);
        const isBuy = netQtyVal >= 0;
        const posLtp = parseNum(pos.lp || pos.ltp);
        const avgPrice = parseNum(pos.averageprice);

        const symbolKey = pos.tradingsymbol || pos.symbol || pos.symboltoken || '';
        const flash = flashes[symbolKey] || (pos.symboltoken ? flashes[pos.symboltoken] : undefined);
        const isRecentFlash = flash && Date.now() - flash.timestamp < 2500;
        const isPnlPositive = pnlVal >= 0;

        return (
          <div
            key={pos.symboltoken || idx}
            onClick={() => onSelectPosition?.(pos)}
            className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-4 shadow-xs transition-all hover:shadow-md hover:border-blue-400 dark:hover:border-blue-500 cursor-pointer flex flex-col justify-between gap-3 group"
          >
            {/* Header: Symbol & Direction */}
            <div>
              <div className="flex justify-between items-start gap-2">
                <div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-gray-900 dark:text-white text-base group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {pos.tradingsymbol || pos.symbol || 'N/A'}
                    </h3>
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">
                      {pos.exchange || 'NSE'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      {pos.producttype || 'DELIVERY'}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded font-extrabold text-[10px] ${
                        isBuy
                          ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                          : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                      }`}
                    >
                      {isBuy ? 'BUY' : 'SELL'}
                    </span>
                  </div>
                </div>

                {/* Live LTP */}
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
                    {formatINR(posLtp)}
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono block mt-0.5">Live LTP</span>
                </div>
              </div>
            </div>

            {/* Position Details Row */}
            <div className="grid grid-cols-2 gap-2 bg-gray-50/70 dark:bg-gray-900/50 p-2.5 rounded-xl border border-gray-100 dark:border-gray-800 text-xs font-mono">
              <div>
                <span className="text-[10px] font-medium text-gray-400 block font-sans uppercase">Net Qty</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {formatNumber(netQtyVal, 0)}
                </span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-medium text-gray-400 block font-sans uppercase">Avg Buy Price</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {formatINR(avgPrice)}
                </span>
              </div>
            </div>

            {/* Bottom Row: M2M P&L */}
            <div className="flex justify-between items-center pt-1 border-t border-gray-100 dark:border-gray-750 text-xs">
              <span className="text-[10px] text-gray-400 uppercase font-semibold">M2M P&L</span>
              <div className="flex items-center gap-1.5">
                <span
                  className={`font-mono font-extrabold text-sm ${
                    isPnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {isPnlPositive ? '+' : ''}{formatINR(pnlVal)}
                </span>
                <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all" />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PositionsCardGrid;
