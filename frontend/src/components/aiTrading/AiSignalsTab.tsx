import React from 'react';
import {
  Layers,
  Flame,
  Target,
  Sparkles,
  Clock,
  Bot,
  ArrowUpRight,
  ArrowDownRight,
  Radio,
  BarChart2,
  Play,
  Wallet,
} from 'lucide-react';
import type { TradeSignal, MarketSegment } from '../../services/aiTradingService';
import type { RealtimeTickData } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';

interface AiSignalsTabProps {
  signals: TradeSignal[];
  filteredSignals: TradeSignal[];
  selectedSegment: MarketSegment;
  onSelectSegment: (segment: MarketSegment) => void;
  filterAction: 'ALL' | 'BUY' | 'SELL';
  onFilterChange: (action: 'ALL' | 'BUY' | 'SELL') => void;
  buyCount: number;
  sellCount: number;
  lastScanTime: string | null;
  isScanning: boolean;
  scanError: string | null;
  onRetryScan: () => void;
  fnoUnderlying: string;
  setFnoUnderlying: (val: string) => void;
  fnoStrike: number;
  setFnoStrike: (val: number) => void;
  fnoOptionType: 'CE' | 'PE';
  setFnoOptionType: (val: 'CE' | 'PE') => void;
  isLookingUpOption: boolean;
  onLookupOption: (underlying: string, strike: number, type: 'CE' | 'PE') => void;
  priceFlashes: Record<string, 'up' | 'down'>;
  getLiveQuote: (tokenOrSymbol?: string) => RealtimeTickData | undefined;
  autoPilotMode: 'PAPER' | 'LIVE';
  onOpenChart: (symbol: string) => void;
  onExecuteSignal: (signal: TradeSignal) => void;
  onOpenBudgetAdvisor: () => void;
}

const QUICK_STRIKES = [
  { label: 'NIFTY 25000 PE', under: 'NIFTY', strike: 25000, type: 'PE' as const },
  { label: 'NIFTY 25000 CE', under: 'NIFTY', strike: 25000, type: 'CE' as const },
  { label: 'NIFTY 24500 PE', under: 'NIFTY', strike: 24500, type: 'PE' as const },
  { label: 'NIFTY 24500 CE', under: 'NIFTY', strike: 24500, type: 'CE' as const },
  { label: 'NIFTY 25200 PE', under: 'NIFTY', strike: 25200, type: 'PE' as const },
  { label: 'NIFTY 25200 CE', under: 'NIFTY', strike: 25200, type: 'CE' as const },
  { label: 'BANKNIFTY 53400 PE', under: 'BANKNIFTY', strike: 53400, type: 'PE' as const },
  { label: 'BANKNIFTY 53100 CE', under: 'BANKNIFTY', strike: 53100, type: 'CE' as const },
];

export const AiSignalsTab: React.FC<AiSignalsTabProps> = ({
  signals,
  filteredSignals,
  selectedSegment,
  onSelectSegment,
  filterAction,
  onFilterChange,
  buyCount,
  sellCount,
  lastScanTime,
  isScanning,
  scanError,
  onRetryScan,
  fnoUnderlying,
  setFnoUnderlying,
  fnoStrike,
  setFnoStrike,
  fnoOptionType,
  setFnoOptionType,
  isLookingUpOption,
  onLookupOption,
  priceFlashes,
  getLiveQuote,
  autoPilotMode,
  onOpenChart,
  onExecuteSignal,
  onOpenBudgetAdvisor,
}) => {
  return (
    <div className="space-y-4">
      {/* Quick Budget Advisor Callout Banner */}
      <div className="bg-gradient-to-r from-emerald-50 via-blue-50 to-purple-50 dark:from-emerald-950/40 dark:via-blue-950/30 dark:to-purple-950/40 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-sm dark:shadow-lg transition-colors">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span>AI Budget Trade Advisor</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40 font-semibold">
                Custom Capital Sizing
              </span>
            </h4>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Have a specific capital (e.g. ₹5,000, ₹10,000, ₹50,000)? Let AI calculate affordable share quantities and option lots with strict stop-loss allocation.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenBudgetAdvisor}
          className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 flex items-center space-x-1.5 whitespace-nowrap transition-all shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Open Budget Advisor</span>
        </button>
      </div>

      {/* Segment Selector: EQUITY vs F&O */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs transition-colors">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mr-1">Trading Segment:</span>
          <button
            type="button"
            onClick={() => onSelectSegment('EQUITY')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedSegment === 'EQUITY'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm shadow-blue-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Equity Cash Stocks</span>
          </button>
          <button
            type="button"
            onClick={() => onSelectSegment('FNO')}
            className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
              selectedSegment === 'FNO'
                ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white border-rose-500 shadow-sm shadow-rose-500/20'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
            <span>Futures & Options (F&O)</span>
          </button>
        </div>

        {selectedSegment === 'FNO' && (
          <span className="text-[11px] text-purple-700 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/60 border border-purple-200 dark:border-purple-500/30 px-3 py-1 rounded-xl">
            Real-time NFO Options & Futures with dynamic lot sizes & OI tracking
          </span>
        )}
      </div>

      {/* F&O Option Strike Quick Selector & Custom Builder (When F&O is active) */}
      {selectedSegment === 'FNO' && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-50 via-white to-indigo-50 dark:from-purple-950/40 dark:via-gray-900 dark:to-indigo-950/30 border border-purple-200 dark:border-purple-500/30 space-y-3 shadow-sm dark:shadow-xl transition-colors">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <Target className="w-4 h-4 text-rose-500 dark:text-rose-400" />
              Quick Option Strikes:
            </span>
            <span className="text-[11px] text-gray-500 dark:text-gray-400">
              Click any strike to generate instant live AI Option Signal
            </span>
          </div>

          {/* Quick Option Strike Chips */}
          <div className="flex flex-wrap gap-2">
            {QUICK_STRIKES.map((item) => (
              <button
                key={`${item.under}_${item.strike}_${item.type}`}
                type="button"
                onClick={() => {
                  setFnoUnderlying(item.under);
                  setFnoStrike(item.strike);
                  setFnoOptionType(item.type);
                  onLookupOption(item.under, item.strike, item.type);
                }}
                disabled={isLookingUpOption}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                  item.type === 'PE'
                    ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:hover:bg-rose-900/60 dark:text-rose-300 dark:border-rose-500/40'
                    : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/60 dark:text-emerald-300 dark:border-emerald-500/40'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Custom Strike Option Builder */}
          <div className="pt-3 border-t border-purple-200 dark:border-purple-500/20 flex flex-col sm:flex-row items-center gap-2">
            <select
              value={fnoUnderlying}
              onChange={(e) => setFnoUnderlying(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 rounded-xl bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
            >
              <option value="NIFTY">NIFTY</option>
              <option value="BANKNIFTY">BANKNIFTY</option>
              <option value="FINNIFTY">FINNIFTY</option>
              <option value="RELIANCE">RELIANCE</option>
            </select>

            <input
              type="number"
              placeholder="Strike Price (e.g. 25000)"
              value={fnoStrike}
              onChange={(e) => setFnoStrike(parseInt(e.target.value) || 0)}
              className="w-full sm:w-44 px-3 py-2 rounded-xl bg-white dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-mono focus:outline-none focus:border-purple-500"
            />

            <div className="flex items-center bg-gray-100 dark:bg-gray-950 p-1 rounded-xl border border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setFnoOptionType('CE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  fnoOptionType === 'CE'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                CALL (CE)
              </button>
              <button
                type="button"
                onClick={() => setFnoOptionType('PE')}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  fnoOptionType === 'PE'
                    ? 'bg-rose-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                PUT (PE)
              </button>
            </div>

            <button
              type="button"
              onClick={() => onLookupOption(fnoUnderlying, fnoStrike, fnoOptionType)}
              disabled={isLookingUpOption || !fnoStrike}
              className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{isLookingUpOption ? 'Scanning Strike...' : 'Get AI Option Signal'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Filter Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900/60 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 shadow-2xs transition-colors">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onFilterChange('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterAction === 'ALL'
                ? 'bg-gray-800 text-white dark:bg-gray-700 dark:text-white shadow-xs'
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            All Signals ({signals.length})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('BUY')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterAction === 'BUY'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-emerald-600 dark:text-gray-400 dark:hover:text-emerald-300'
            }`}
          >
            BUY ({buyCount})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange('SELL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              filterAction === 'SELL'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'text-gray-600 hover:text-rose-600 dark:text-gray-400 dark:hover:text-rose-300'
            }`}
          >
            SELL ({sellCount})
          </button>
        </div>

        {lastScanTime && (
          <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Scanned: {new Date(lastScanTime).toLocaleTimeString('en-IN')}
          </span>
        )}
      </div>

      {/* Error Banner */}
      {scanError && (
        <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-sm flex items-center justify-between">
          <span>{scanError}</span>
          <button
            type="button"
            onClick={onRetryScan}
            className="underline text-xs font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {filteredSignals.length === 0 && !isScanning && (
        <div className="text-center py-12 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
          <Bot className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No signals match current filter</h3>
          <p className="text-sm text-gray-500 mt-1">Try switching to 'All Signals' or run a fresh market scan.</p>
        </div>
      )}

      {/* Signals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredSignals.map((sig) => {
          const isBuy = sig.action === 'BUY';
          const isSell = sig.action === 'SELL';
          const flash =
            priceFlashes[sig.token] ||
            priceFlashes[sig.symbol] ||
            priceFlashes[sig.symbol.replace(/-EQ$/, '')];

          // Underlying Quote for FNO options
          const underName =
            sig.underlying ||
            (sig.symbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');
          const underToken =
            underName === 'BANKNIFTY'
              ? '99926009'
              : underName === 'NIFTY'
              ? '99926000'
              : undefined;

          const underQuote =
            (underToken ? getLiveQuote(underToken) : undefined) ||
            getLiveQuote(underName);

          return (
            <div
              key={sig.id}
              className={`relative rounded-2xl p-5 border transition-all duration-300 backdrop-blur-md shadow-xs hover:shadow-md ${
                isBuy
                  ? 'bg-gradient-to-br from-white via-white to-emerald-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-emerald-950/20 border-emerald-200 hover:border-emerald-400 dark:border-emerald-500/30 dark:hover:border-emerald-500/60'
                  : isSell
                  ? 'bg-gradient-to-br from-white via-white to-rose-50/50 dark:from-gray-900 dark:via-gray-900 dark:to-rose-950/20 border-rose-200 hover:border-rose-400 dark:border-rose-500/30 dark:hover:border-rose-500/60'
                  : 'bg-white dark:bg-gray-900/80 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
              }`}
            >
              {/* Card Header */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-lg text-gray-900 dark:text-white tracking-wide">
                      {sig.symbol}
                    </span>
                    {sig.isSynthetic && (
                      <span
                        className="text-[11px] px-2 py-0.5 rounded-md font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1"
                        title="Historical candles missing. Generated from estimated curve. Do not use for live trading."
                      >
                        <span>⚠️ SIMULATED DATA</span>
                      </span>
                    )}
                    {sig.contractType && sig.contractType !== 'EQ' ? (
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-md font-extrabold uppercase ${
                          sig.contractType === 'PE'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/40'
                            : 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/40'
                        }`}
                      >
                        {sig.strike ? `${sig.strike} ${sig.contractType}` : sig.contractType}
                      </span>
                    ) : null}
                    <span className="text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 font-mono">
                      {sig.exchange} • {sig.token}
                    </span>
                    {sig.status === 'EXECUTED' && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 border border-blue-200 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-400/30 font-medium">
                        EXECUTED
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {sig.lotSize && (
                      <span className="text-purple-700 dark:text-purple-300 font-medium">
                        Lot: <strong>{sig.lotSize}</strong> ({formatINR(sig.currentPrice * sig.lotSize)}/lot)
                      </span>
                    )}
                    {sig.oiBuildup && (
                      <span className="px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 dark:bg-indigo-950/80 dark:border-indigo-500/30 dark:text-indigo-300 font-medium text-[11px]">
                        {sig.oiBuildup.replace('_', ' ')}
                      </span>
                    )}
                    <span>{sig.timeframe}</span>
                    <span>•</span>
                    <span>R:R {sig.riskReward}</span>
                    <span>•</span>
                    <span
                      className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/70 dark:text-blue-300 font-mono font-bold text-[10px] border border-blue-200 dark:border-blue-800"
                      title="Heuristic AI rating (0-100) based on RSI, EMA, and MACD alignment, not an empirical win probability"
                    >
                      Conviction: {sig.confidence}/100
                    </span>
                  </div>
                </div>

                {/* Action Pill */}
                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider shadow-2xs ${
                      isBuy
                        ? 'bg-emerald-500 text-white shadow-emerald-500/20'
                        : isSell
                        ? 'bg-rose-500 text-white shadow-rose-500/20'
                        : 'bg-amber-500 text-gray-950 shadow-amber-500/20'
                    }`}
                  >
                    {isBuy ? (
                      <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                    ) : isSell ? (
                      <ArrowDownRight className="w-3.5 h-3.5 stroke-[3]" />
                    ) : (
                      <Radio className="w-3.5 h-3.5" />
                    )}
                    <span>{sig.action}</span>
                  </span>
                </div>
              </div>

              {/* Price & Levels Grid */}
              <div className="grid grid-cols-4 gap-2 mt-4 p-3 rounded-xl bg-gray-50 dark:bg-gray-950/70 border border-gray-200 dark:border-gray-800/80 text-center transition-colors">
                <div
                  className={`rounded-lg p-1 transition-all duration-300 ${
                    flash === 'up'
                      ? 'bg-emerald-500/20 ring-1 ring-emerald-500 scale-105'
                      : flash === 'down'
                      ? 'bg-rose-500/20 ring-1 ring-rose-500 scale-105'
                      : ''
                  }`}
                >
                  <div className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center justify-center gap-1">
                    <span>LTP</span>
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"
                      title="Live WebSocket Price"
                    />
                  </div>
                  <div
                    className={`text-sm font-bold mt-0.5 transition-colors font-mono ${
                      flash === 'up'
                        ? 'text-emerald-600 dark:text-emerald-300'
                        : flash === 'down'
                        ? 'text-rose-600 dark:text-rose-300'
                        : 'text-gray-900 dark:text-white'
                    }`}
                  >
                    {formatINR(sig.currentPrice)}
                    {flash === 'up' && (
                      <span className="text-[10px] ml-1 text-emerald-600 dark:text-emerald-400">▲</span>
                    )}
                    {flash === 'down' && (
                      <span className="text-[10px] ml-1 text-rose-600 dark:text-rose-400">▼</span>
                    )}
                  </div>
                  <div
                    className={`text-[10px] font-medium ${
                      sig.netChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {sig.netChange >= 0 ? '+' : ''}
                    {sig.percentChange}%
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Target 1</div>
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mt-0.5 font-mono">
                    {formatINR(sig.target1)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {formatINR(Math.abs(sig.target1 - sig.currentPrice))} gain
                  </div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Target 2</div>
                  <div className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 mt-0.5 font-mono">
                    {formatINR(sig.target2)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">Extended</div>
                </div>

                <div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">Stop Loss</div>
                  <div className="text-sm font-semibold text-rose-600 dark:text-rose-400 mt-0.5 font-mono">
                    {formatINR(sig.stopLoss)}
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400">
                    {formatINR(Math.abs(sig.currentPrice - sig.stopLoss))} risk
                  </div>
                </div>
              </div>

              {/* For F&O Option Contracts: Display Live Price of Underlying Share */}
              {sig.segment === 'FNO' && underQuote && typeof underQuote.ltp === 'number' && (
                <div className="mt-2.5 p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between text-xs transition-colors">
                  <span className="text-blue-700 dark:text-blue-300 font-medium flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                    Underlying {underName} Live Price:
                  </span>
                  <span className="font-bold text-gray-900 dark:text-white font-mono">
                    {formatINR(underQuote.ltp)}
                    {typeof underQuote.percentChange === 'number' && (
                      <span
                        className={`ml-1.5 text-[11px] font-semibold ${
                          underQuote.percentChange >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        ({underQuote.percentChange >= 0 ? '+' : ''}
                        {underQuote.percentChange}%)
                      </span>
                    )}
                  </span>
                </div>
              )}

              {/* Technical Indicators Pill Tags */}
              <div className="flex flex-wrap gap-1.5 mt-3">
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/90 dark:text-gray-300 dark:border-gray-700">
                  RSI: <strong>{sig.indicators.rsi}</strong> ({sig.indicators.rsiSignal})
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/90 dark:text-gray-300 dark:border-gray-700">
                  EMA: <strong>{sig.indicators.emaTrend}</strong>
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/90 dark:text-gray-300 dark:border-gray-700">
                  MACD: <strong>{sig.indicators.macd.histogram}</strong> ({sig.indicators.macd.trend})
                </span>
                <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200 dark:bg-gray-800/90 dark:text-gray-300 dark:border-gray-700">
                  Depth: <strong>{sig.indicators.orderBookImbalance}% Buyers</strong>
                </span>
              </div>

              {/* AI Thesis Summary & Bullets */}
              <div className="mt-3.5 p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/80 dark:border-blue-500/20 text-xs space-y-1.5 transition-colors">
                <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                  {sig.aiThesis.summary}
                </p>
                {sig.aiThesis.rationale && sig.aiThesis.rationale.length > 0 && (
                  <ul className="space-y-1 text-gray-600 dark:text-gray-400 pl-4 list-disc text-[11px]">
                    {sig.aiThesis.rationale.slice(0, 2).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 1-Click Execution & Chart Footer */}
              <div className="mt-4 flex items-center justify-between pt-2 border-t border-gray-200 dark:border-gray-800/80">
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Mode:{' '}
                  <strong className={autoPilotMode === 'LIVE' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
                    {autoPilotMode === 'LIVE' ? 'Angel One Broker' : 'Paper Trade'}
                  </strong>
                </span>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => onOpenChart(sig.symbol)}
                    className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white dark:border-gray-700 transition-all"
                    title="View TradingView Chart"
                  >
                    <BarChart2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                    <span>Chart</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => onExecuteSignal(sig)}
                    disabled={sig.isSynthetic}
                    title={sig.isSynthetic ? "Cannot execute trade on simulated/synthetic data" : undefined}
                    className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md disabled:opacity-50 disabled:cursor-not-allowed ${
                      sig.isSynthetic
                        ? 'bg-gray-400 dark:bg-gray-700 text-gray-200 shadow-none'
                        : isBuy
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        : isSell
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{sig.isSynthetic ? 'Simulated Data' : `Execute ${sig.action}`}</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AiSignalsTab;
