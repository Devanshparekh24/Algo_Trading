import React from 'react';
import type { Holding } from '../../types';
import { formatINR } from '../../utils/formatters';

export interface PriceTickFlash {
  ltp: number;
  direction: 'up' | 'down';
  timestamp: number;
}

export interface HoldingsTableViewProps {
  holdings: Holding[];
  flashes: Record<string, PriceTickFlash>;
  totalEquityValue: number;
  onSelectHolding?: (holding: Holding) => void;
}

export const HoldingsTableView: React.FC<HoldingsTableViewProps> = ({
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
    <div className="bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 rounded-2xl shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-gray-50/80 dark:bg-gray-900/60 text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wider border-b border-gray-200 dark:border-gray-700/80">
            <tr>
              <th className="py-3.5 px-4 font-bold">Instrument</th>
              <th className="py-3.5 px-4 text-right">Quantity</th>
              <th className="py-3.5 px-4 text-right">Avg Price</th>
              <th className="py-3.5 px-4 text-right">Live LTP</th>
              <th className="py-3.5 px-4 text-right">Today's P&L</th>
              <th className="py-3.5 px-4 text-right">Invested Value</th>
              <th className="py-3.5 px-4 text-right">Current Value</th>
              <th className="py-3.5 px-4 text-right">Total P&L</th>
              <th className="py-3.5 px-4 text-right">Portfolio Weight</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-700/60 text-gray-800 dark:text-gray-200 font-medium">
            {holdings.map((h: Holding, idx: number) => {
              const symbolKey = h.tradingsymbol || '';
              const flash = flashes[symbolKey] || (h.symboltoken ? flashes[h.symboltoken] : undefined);
              const isRecentFlash = flash && Date.now() - flash.timestamp < 2500;

              const qty = parseNum(h.quantity);
              const avgPrice = parseNum(h.averageprice);
              // Use real-time WebSocket tick price if available, otherwise fall back to cached quote
              const ltp = flash && flash.ltp > 0 ? flash.ltp : parseNum(h.ltp);
              const close = parseNum(h.close) || ltp;
              const investedVal = avgPrice * qty;
              const curVal = ltp * qty;
              const pnlVal = flash ? (ltp - avgPrice) * qty : parseNum(h.profitandloss ?? (ltp - avgPrice) * qty);
              const pnlPct =
                investedVal > 0
                  ? ((pnlVal / investedVal) * 100)
                  : h.pnlpercentage !== undefined
                  ? parseNum(h.pnlpercentage)
                  : 0;

              const dayChange = (ltp - close) * qty;
              const dayChangePct = close > 0 ? ((ltp - close) / close) * 100 : 0;
              const weightPct = totalEquityValue > 0 ? (curVal / totalEquityValue) * 100 : 0;

              return (
                <tr
                  key={h.symboltoken || h.isin || idx}
                  onClick={() => onSelectHolding?.(h)}
                  className="hover:bg-blue-50/40 dark:hover:bg-gray-700/40 transition-colors cursor-pointer group"
                >
                  {/* Symbol & Metadata */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-gray-900 dark:text-white text-sm group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {h.tradingsymbol || 'N/A'}
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800">
                        EQUITY
                      </span>
                      <span className="px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded">
                        {h.exchange || 'NSE'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-gray-400 font-mono mt-0.5">
                      {h.isin && <span>ISIN: {h.isin}</span>}
                      {h.symboltoken && <span>• Token: {h.symboltoken}</span>}
                    </div>
                  </td>

                  {/* Quantity */}
                  <td className="py-3.5 px-4 text-right font-mono font-semibold">{qty}</td>

                  {/* Avg Price */}
                  <td className="py-3.5 px-4 text-right font-mono">{formatINR(avgPrice)}</td>

                  {/* Live LTP (Flash Animation) */}
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
                      {formatINR(ltp)}
                    </span>
                  </td>

                  {/* Today's Change */}
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span
                      className={`font-semibold block ${
                        dayChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {dayChange >= 0 ? '+' : ''}
                      {formatINR(dayChange)}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {dayChangePct >= 0 ? '+' : ''}
                      {dayChangePct.toFixed(2)}%
                    </span>
                  </td>

                  {/* Invested Value */}
                  <td className="py-3.5 px-4 text-right font-mono text-gray-600 dark:text-gray-300">
                    {formatINR(investedVal)}
                  </td>

                  {/* Current Value */}
                  <td className="py-3.5 px-4 text-right font-mono font-semibold text-gray-900 dark:text-white">
                    {formatINR(curVal)}
                  </td>

                  {/* Total PnL */}
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span
                      className={`font-bold text-sm block ${
                        pnlVal >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pnlVal >= 0 ? '+' : ''}
                      {formatINR(pnlVal)}
                    </span>
                    <span
                      className={`text-xs font-semibold ${
                        pnlPct >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {pnlPct >= 0 ? '+' : ''}
                      {pnlPct.toFixed(2)}%
                    </span>
                  </td>

                  {/* Portfolio Weight */}
                  <td className="py-3.5 px-4 text-right font-mono">
                    <span className="font-semibold">{weightPct.toFixed(1)}%</span>
                    <div className="w-16 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full mt-1 ml-auto overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full" style={{ width: `${weightPct}%` }} />
                    </div>
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

export default HoldingsTableView;

