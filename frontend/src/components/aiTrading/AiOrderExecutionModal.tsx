import React from 'react';
import { Play, X, ShieldAlert, Zap } from 'lucide-react';
import type { TradeSignal } from '../../services/aiTradingService';
import { formatINR } from '../../utils/formatters';

interface AiOrderExecutionModalProps {
  executingSignal: TradeSignal | null;
  onClose: () => void;
  execMode: 'PAPER' | 'LIVE';
  setExecMode: (mode: 'PAPER' | 'LIVE') => void;
  execQuantity: number;
  setExecQuantity: (qty: number) => void;
  execLots: number;
  setExecLots: (lots: number) => void;
  execProductType: 'INTRADAY' | 'DELIVERY' | 'CARRYFORWARD';
  setExecProductType: (type: 'INTRADAY' | 'DELIVERY' | 'CARRYFORWARD') => void;
  execOrderType: 'MARKET' | 'LIMIT';
  setExecOrderType: (type: 'MARKET' | 'LIMIT') => void;
  execLimitPrice: number;
  setExecLimitPrice: (price: number) => void;
  isExecuting: boolean;
  onConfirmOrder: () => void;
}

export const AiOrderExecutionModal: React.FC<AiOrderExecutionModalProps> = ({
  executingSignal,
  onClose,
  execMode,
  setExecMode,
  execQuantity,
  setExecQuantity,
  execLots,
  setExecLots,
  execProductType,
  setExecProductType,
  execOrderType,
  setExecOrderType,
  execLimitPrice,
  setExecLimitPrice,
  isExecuting,
  onConfirmOrder,
}) => {
  if (!executingSignal) return null;

  const isFno =
    executingSignal.exchange === 'NFO' ||
    executingSignal.segment === 'FNO' ||
    executingSignal.symbol.endsWith('CE') ||
    executingSignal.symbol.endsWith('PE');

  const lotSize = executingSignal.lotSize || 65;
  const totalUnits = isFno ? execLots * lotSize : execQuantity;
  const totalCost = totalUnits * executingSignal.currentPrice;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6 space-y-5">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <Play className="w-5 h-5 text-blue-400 fill-current" />
            <h3 className="text-lg font-bold text-white">
              Confirm AI Trade Execution
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Signal Snapshot */}
        <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-bold text-base text-white">
                {executingSignal.symbol}
              </span>
              <span className="text-xs text-gray-500 ml-2 font-mono">
                {executingSignal.exchange} • {executingSignal.token}
              </span>
            </div>
            <span
              className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                executingSignal.action === 'BUY'
                  ? 'bg-emerald-500 text-gray-950'
                  : 'bg-rose-500 text-white'
              }`}
            >
              {executingSignal.action}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-gray-800/60 font-mono">
            <div>
              <div className="text-gray-500 text-[10px] font-sans">LTP</div>
              <div className="font-bold text-white">
                {formatINR(executingSignal.currentPrice)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px] font-sans">Target 1</div>
              <div className="font-bold text-emerald-400">
                {formatINR(executingSignal.target1)}
              </div>
            </div>
            <div>
              <div className="text-gray-500 text-[10px] font-sans">Stop Loss</div>
              <div className="font-bold text-rose-400">
                {formatINR(executingSignal.stopLoss)}
              </div>
            </div>
          </div>
        </div>

        {/* Execution Form Controls */}
        <div className="space-y-4 text-xs">
          {/* Mode Selection */}
          <div>
            <label className="text-gray-300 font-semibold block mb-1.5">
              Execution Destination:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setExecMode('PAPER')}
                className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  execMode === 'PAPER'
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Paper Simulation</span>
              </button>
              <button
                type="button"
                onClick={() => setExecMode('LIVE')}
                className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  execMode === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-sm'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
              >
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Live SmartAPI Broker</span>
              </button>
            </div>
          </div>

          {/* Quantity / Lots */}
          {isFno ? (
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-gray-300 font-semibold">Lots to Trade:</label>
                <span className="text-purple-400 font-mono text-[11px]">
                  {execLots} {execLots === 1 ? 'Lot' : 'Lots'} = {execLots * lotSize} shares
                </span>
              </div>
              <div className="flex items-center space-x-2">
                {[1, 2, 3, 5, 10].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setExecLots(num)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                      execLots === num
                        ? 'bg-purple-600 text-white border-purple-400 shadow-sm'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {num}x
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={execLots}
                  onChange={(e) => setExecLots(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 px-2 py-1.5 rounded-lg bg-gray-950 border border-gray-700 text-white text-center font-mono focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>
          ) : (
            <div>
              <label className="text-gray-300 font-semibold block mb-1">
                Quantity (Shares):
              </label>
              <input
                type="number"
                min="1"
                max="10000"
                value={execQuantity}
                onChange={(e) => setExecQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          )}

          {/* Product Type & Order Type */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 font-semibold block mb-1">Product Type:</label>
              <select
                value={execProductType}
                onChange={(e) => setExecProductType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              >
                {isFno ? (
                  <>
                    <option value="CARRYFORWARD">CARRYFORWARD (NRML)</option>
                    <option value="INTRADAY">INTRADAY (MIS)</option>
                  </>
                ) : (
                  <>
                    <option value="INTRADAY">INTRADAY (MIS)</option>
                    <option value="DELIVERY">DELIVERY (CNC)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="text-gray-300 font-semibold block mb-1">Order Type:</label>
              <select
                value={execOrderType}
                onChange={(e) => setExecOrderType(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
              >
                <option value="MARKET">MARKET</option>
                <option value="LIMIT">LIMIT</option>
              </select>
            </div>
          </div>

          {/* Limit Price if LIMIT */}
          {execOrderType === 'LIMIT' && (
            <div>
              <label className="text-gray-300 font-semibold block mb-1">Limit Price (₹):</label>
              <input
                type="number"
                step="0.05"
                value={execLimitPrice}
                onChange={(e) => setExecLimitPrice(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          )}
        </div>

        {/* Total Estimated Cost */}
        <div className="p-3 rounded-xl bg-gray-950 text-xs flex items-center justify-between border border-gray-800">
          <span className="text-gray-400">
            {isFno ? 'Total Premium Required:' : 'Total Order Value:'}
          </span>
          <span className="text-base font-bold text-white font-mono">
            {formatINR(totalCost)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmOrder}
            disabled={isExecuting}
            className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
              executingSignal.action === 'BUY'
                ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
            } disabled:opacity-50`}
          >
            <Play className="w-4 h-4 fill-current" />
            <span>{isExecuting ? 'Transmitting Order...' : `Confirm ${executingSignal.action} Order`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
