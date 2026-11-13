import React from 'react';
import type { Position } from '../../types';
import { formatINR, formatNumber } from '../../utils/formatters';

export interface PriceTickFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export interface PositionsTableViewProps {
  positions: Position[];
  flashes: Record<string, PriceTickFlash>;
  onSelectPosition?: (position: Position) => void;
}

export const PositionsTableView: React.FC<PositionsTableViewProps> = ({
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
    <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-gray-50/80 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/80">
            <tr>
              <th className="py-3.5 px-4 font-bold">Instrument / Symbol</th>
              <th className="py-3.5 px-4">Product / Side</th>
              <th className="py-3.5 px-4 text-right">Net Quantity</th>
              <th className="py-3.5 px-4 text-right">Avg Price</th>
              <th className="py-3.5 px-4 text-right">Live LTP</th>
              <th className="py-3.5 px-4 text-right">M2M P&L (INR)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-800 dark:text-gray-200 font-medium">
            {positions.map((pos: Position, idx: number) => {
              const symbolKey = pos.tradingsymbol || pos.symbol || pos.symboltoken || '';
              const flash = flashes[symbolKey] || (pos.symboltoken ? flashes[pos.symboltoken] : undefined);
              const isRecentFlash = flash && Date.now() - flash.timestamp < 2500;

              // Use live real-time WebSocket tick if available
              const posLtp = flash && flash.ltp > 0 ? flash.ltp : parseNum(pos.lp || pos.ltp);
              const netQtyVal = parseNum(pos.netqty || pos.quantity);
              const avgPriceVal = parseNum(pos.averageprice || (pos as any).buyavgprice);
              const isBuy = netQtyVal >= 0;

              // Recompute live PnL with fresh tick
              const pnlVal = flash && netQtyVal !== 0 && avgPriceVal > 0
                ? parseNum(pos.realised || (pos as any).realisedpnl || 0) + (posLtp - avgPriceVal) * netQtyVal
                : parseNum(pos.pnl || pos.m2m);

              return (
                <tr
                  key={pos.symboltoken || idx}
                  onClick={() => onSelectPosition?.(pos)}
                  className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors cursor-pointer group"
                >
                  {/* Symbol */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {pos.tradingsymbol || pos.symbol || 'N/A'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded border border-gray-200 dark:border-gray-600">
                        {pos.exchange || 'NSE'}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">Token: {pos.symboltoken || '-'}</span>
                  </td>

                  {/* Product & Direction */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-1.5">
                      <span className="px-2 py-0.5 rounded font-semibold text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        {pos.producttype || 'DELIVERY'}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                          isBuy
                            ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        {isBuy ? 'LONG' : 'SHORT'}
                      </span>
                    </div>
                  </td>

                  {/* Net Qty */}
                  <td className="py-3.5 px-4 text-right font-mono font-semibold">
                    {formatNumber(netQtyVal, 0)}
                  </td>

                  {/* Avg Price */}
                  <td className="py-3.5 px-4 text-right font-mono">{formatINR(pos.averageprice)}</td>

                  {/* Live LTP with Real-time Flash */}
                  <td className="py-3.5 px-4 text-right font-mono font-semibold">
                    <span
                      className={`px-2 py-0.5 rounded transition-all duration-300 inline-block ${
                        isRecentFlash
                          ? flash.direction === 'up'
                            ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 font-extrabold ring-1 ring-emerald-500 scale-105'
                            : 'bg-rose-100 dark:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-extrabold ring-1 ring-rose-500 scale-105'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {formatINR(posLtp)}
                    </span>
                  </td>

                  {/* Total PnL */}
                  <td
                    className={`py-3.5 px-4 text-right font-mono font-bold text-sm ${
                      pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {pnlVal >= 0 ? '+' : ''}
                    {formatINR(pnlVal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PositionsTableView;

