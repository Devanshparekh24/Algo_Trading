import React from 'react';
import type { FnoMoverItem } from '../../types';
import Modal from '../common/Modal';
import InstrumentBadge from '../common/InstrumentBadge';
import ChangePill from '../common/ChangePill';
import DayRangeBar from '../common/DayRangeBar';
import { formatINR, formatCompactQty } from '../../utils/formatters';

export interface ContractDetailModalProps {
  contract: FnoMoverItem | null;
  onClose: () => void;
}

export const ContractDetailModal: React.FC<ContractDetailModalProps> = ({ contract, onClose }) => {
  if (!contract) return null;

  return (
    <Modal
      isOpen={!!contract}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-2">
          <h3 className="text-base font-extrabold text-gray-900 dark:text-white">
            {contract.tradingSymbol}
          </h3>
          <InstrumentBadge type={contract.instrumentType} />
        </div>
      }
      subtitle={`Token: ${contract.symbolToken} · Expiry: ${contract.expiry}`}
    >
      {/* Price Hero Section */}
      <div className="flex items-baseline justify-between p-4 bg-gray-50 dark:bg-gray-700/40 rounded-2xl border border-gray-100 dark:border-gray-700/60">
        <div>
          <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
            Last Traded Price
          </span>
          <div className="text-3xl font-extrabold font-mono text-gray-900 dark:text-white">
            {formatINR(contract.ltp)}
          </div>
        </div>
        <div className="text-right">
          <ChangePill value={contract.percentChange} absoluteValue={contract.netChange} size="md" />
        </div>
      </div>

      {/* Day Range Progress */}
      {contract.high && contract.low && contract.high > contract.low && (
        <div className="bg-gray-50 dark:bg-gray-700/30 p-3.5 rounded-2xl border border-gray-100 dark:border-gray-700/60 space-y-1.5">
          <div className="flex justify-between items-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Intraday Range</span>
            <span className="font-mono text-gray-500 dark:text-gray-400">
              Spread: {formatINR(contract.high - contract.low)}
            </span>
          </div>
          <DayRangeBar
            current={contract.ltp}
            low={contract.low}
            high={contract.high}
            formatFn={(val) => formatINR(val)}
          />
        </div>
      )}

      {/* OHLC & Trading Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Open</span>
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {formatINR(contract.open)}
          </span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Close</span>
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {formatINR(contract.close)}
          </span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Strike</span>
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {contract.strike ? formatINR(contract.strike, 0) : '—'}
          </span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block">High</span>
          <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
            {formatINR(contract.high)}
          </span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block">Low</span>
          <span className="font-mono font-bold text-rose-600 dark:text-rose-400">
            {formatINR(contract.low)}
          </span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50">
          <span className="text-[10px] uppercase font-bold text-gray-400 block">Trade Volume</span>
          <span className="font-mono font-bold text-gray-900 dark:text-white">
            {formatCompactQty(contract.tradeVolume)}
          </span>
        </div>
        <div className="p-3 bg-gray-50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-700/50 sm:col-span-3">
          <div className="flex justify-between items-center">
            <span className="text-[10px] uppercase font-bold text-gray-400">Open Interest (OI)</span>
            <span className="font-mono font-bold text-gray-900 dark:text-white">
              {formatCompactQty(contract.opnInterest)}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Close Button */}
      <div className="pt-2 flex justify-end">
        <button
          onClick={onClose}
          type="button"
          className="px-5 py-2 bg-gray-900 hover:bg-gray-800 dark:bg-white dark:hover:bg-gray-100 text-white dark:text-gray-900 font-semibold text-xs rounded-xl shadow transition-colors"
        >
          Close
        </button>
      </div>
    </Modal>
  );
};

export default ContractDetailModal;
