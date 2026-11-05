import React from 'react';
import { X, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import type { Holding, Position } from '../../types';
import { formatINR } from '../../utils/formatters';

export interface HoldingDetailModalProps {
  item: Holding | Position | null;
  type: 'holding' | 'position';
  onClose: () => void;
}

export const HoldingDetailModal: React.FC<HoldingDetailModalProps> = ({ item, type, onClose }) => {
  if (!item) return null;

  const parseNum = (val: string | number | undefined | null): number => {
    if (val === undefined || val === null || val === '') return 0;
    const num = typeof val === 'string' ? parseFloat(val) : val;
    return isNaN(num) ? 0 : num;
  };

  const isHolding = type === 'holding';
  const holding = item as Holding;
  const position = item as Position;

  const symbol = holding.tradingsymbol || position.symbol || 'N/A';
  const exchange = holding.exchange || position.exchange || 'NSE';
  const qty = isHolding ? parseNum(holding.quantity) : parseNum(position.netqty || position.quantity);
  const avgPrice = parseNum(item.averageprice);
  const ltp = isHolding ? parseNum(holding.ltp) : parseNum(position.lp || position.ltp);
  const close = parseNum(holding.close) || ltp;

  const investedVal = avgPrice * qty;
  const currentVal = ltp * qty;
  const pnlVal = isHolding
    ? parseNum(holding.profitandloss ?? (ltp - avgPrice) * qty)
    : parseNum(position.pnl || position.m2m);
  const pnlPct = investedVal > 0 ? (pnlVal / investedVal) * 100 : 0;

  const dayChange = (ltp - close) * qty;
  const dayChangePct = close > 0 ? ((ltp - close) / close) * 100 : 0;

  const isPnlPositive = pnlVal >= 0;
  const isDayPositive = dayChange >= 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex justify-between items-start">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-xl font-extrabold text-gray-900 dark:text-white">{symbol}</h2>
              <span className="px-2 py-0.5 text-xs font-bold bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800">
                {isHolding ? 'EQUITY DELIVERY' : position.producttype || 'DERIVATIVE'}
              </span>
              <span className="px-2 py-0.5 text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-lg">
                {exchange}
              </span>
            </div>
            <p className="text-xs text-gray-400 font-mono mt-1">
              {holding.isin ? `ISIN: ${holding.isin}` : ''} {item.symboltoken ? `• Token: ${item.symboltoken}` : ''}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          {/* Top Live Quote Highlight */}
          <div className="bg-gradient-to-br from-blue-50/50 via-gray-50 to-indigo-50/30 dark:from-gray-800/60 dark:via-gray-800/40 dark:to-blue-950/20 p-4 rounded-2xl border border-blue-100/60 dark:border-gray-700/60 flex justify-between items-center">
            <div>
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Live Market LTP</span>
              <span className="text-2xl font-extrabold font-mono text-gray-900 dark:text-white">
                {formatINR(ltp)}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[10px] uppercase font-bold text-gray-400 block tracking-wider">Today's Move</span>
              <span
                className={`text-sm font-extrabold font-mono inline-flex items-center gap-0.5 ${
                  isDayPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isDayPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {dayChangePct >= 0 ? '+' : ''}{dayChangePct.toFixed(2)}% ({formatINR(dayChange)})
              </span>
            </div>
          </div>

          {/* Key Financial Metrics Grid */}
          <div className="grid grid-cols-2 gap-3 text-xs font-mono">
            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-750">
              <span className="text-[10px] font-sans text-gray-400 block uppercase">Quantity Held</span>
              <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{qty} shares</span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-750">
              <span className="text-[10px] font-sans text-gray-400 block uppercase">Average Buy Price</span>
              <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{formatINR(avgPrice)}</span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-750">
              <span className="text-[10px] font-sans text-gray-400 block uppercase">Capital Invested</span>
              <span className="font-bold text-sm text-gray-800 dark:text-gray-200">{formatINR(investedVal)}</span>
            </div>

            <div className="p-3 bg-gray-50 dark:bg-gray-800/60 rounded-xl border border-gray-100 dark:border-gray-750">
              <span className="text-[10px] font-sans text-gray-400 block uppercase">Current Value</span>
              <span className="font-bold text-sm text-gray-900 dark:text-white">{formatINR(currentVal)}</span>
            </div>
          </div>

          {/* Total Return Row */}
          <div className="p-4 bg-gray-50 dark:bg-gray-800/80 rounded-2xl border border-gray-200 dark:border-gray-700 flex justify-between items-center text-xs">
            <div>
              <span className="text-gray-500 dark:text-gray-400 block font-sans">Total Profit / Loss</span>
              <span className="text-[11px] text-gray-400 font-sans">Realized + Unrealized gain</span>
            </div>
            <div className="text-right">
              <span
                className={`text-lg font-extrabold font-mono block ${
                  isPnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {isPnlPositive ? '+' : ''}{formatINR(pnlVal)}
              </span>
              <span
                className={`text-xs font-bold font-mono ${
                  isPnlPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          {/* Delivery & Demat Clearance Details (for holdings) */}
          {isHolding && (
            <div className="space-y-2 pt-1 border-t border-gray-100 dark:border-gray-800 text-xs">
              <h4 className="font-bold text-xs uppercase tracking-wider text-gray-400">Demat Clearance Status</h4>
              <div className="grid grid-cols-3 gap-2 text-center text-xs font-mono">
                <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-sans block">Realised Qty</span>
                  <strong className="text-gray-800 dark:text-gray-200">{holding.realisedquantity ?? qty}</strong>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-sans block">T1 Unsettled</span>
                  <strong className="text-gray-800 dark:text-gray-200">{holding.t1quantity ?? 0}</strong>
                </div>
                <div className="p-2 bg-gray-50 dark:bg-gray-800/40 rounded-lg border border-gray-100 dark:border-gray-800">
                  <span className="text-[10px] text-gray-400 font-sans block">Haircut</span>
                  <strong className="text-gray-800 dark:text-gray-200">{holding.haircut ?? 0}%</strong>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-5 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl text-xs font-semibold transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default HoldingDetailModal;
