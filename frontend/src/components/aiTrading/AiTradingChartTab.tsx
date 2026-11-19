import React, { useState } from 'react';
import {
  BarChart2,
  Play,
  Zap,
  TrendingUp,
  TrendingDown,
  Clock,
  Square,
  Radio,
  ArrowLeft,
  List,
} from 'lucide-react';
import TradingViewChart, { type ChartInterval } from '../tradingview/TradingViewChart';
import type { TradeSignal, ActiveAiPosition } from '../../services/aiTradingService';
import type { RealtimeTickData } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';
import { useAppStore } from '../../store';

interface AiTradingChartTabProps {
  theme?: 'light' | 'dark';
  selectedChartSymbol: string;
  onSelectChartSymbol: (symbol: string) => void;
  chartInterval: ChartInterval;
  onChangeChartInterval: (interval: ChartInterval) => void;
  signals: TradeSignal[];
  activePositions?: ActiveAiPosition[];
  onClosePosition?: (posId: string) => void;
  onNavigateToOrders?: () => void;
  priceFlashes: Record<string, 'up' | 'down'>;
  getLiveQuote: (tokenOrSymbol?: string) => RealtimeTickData | undefined;
  onExecuteSignal: (signal: TradeSignal) => void;
}

const POPULAR_WATCHLIST = [
  { label: 'Nifty 50', sym: 'NSE:NIFTYBEES', lookup: '99926000' },
  { label: 'Bank Nifty', sym: 'NSE:BANKBEES', lookup: '99926009' },
  { label: 'Reliance', sym: 'NSE:RELIANCE', lookup: '2885' },
  { label: 'Tata Steel', sym: 'NSE:TATASTEEL', lookup: '3499' },
  { label: 'SBI', sym: 'NSE:SBIN', lookup: '3045' },
  { label: 'HDFC Bank', sym: 'NSE:HDFCBANK', lookup: '1333' },
  { label: 'Infosys', sym: 'NSE:INFY', lookup: '1594' },
  { label: 'ICICI Bank', sym: 'NSE:ICICIBANK', lookup: '4963' },
  { label: 'TCS', sym: 'NSE:TCS', lookup: '11536' },
  { label: 'ITC', sym: 'NSE:ITC', lookup: '1660' },
];

export const AiTradingChartTab: React.FC<AiTradingChartTabProps> = ({
  theme: propTheme,
  selectedChartSymbol,
  onSelectChartSymbol,
  chartInterval,
  onChangeChartInterval,
  signals,
  activePositions = [],
  onClosePosition,
  onNavigateToOrders,
  priceFlashes,
  getLiveQuote,
  onExecuteSignal,
}) => {
  const storeTheme = useAppStore((state) => state.theme);
  const activeTheme = propTheme || storeTheme || 'dark';

  const [secondSectionTab, setSecondSectionTab] = useState<'TELEMETRY' | 'UNDERLYING_CHART' | 'WATCHLIST'>('TELEMETRY');
  const [chartLayoutMode, setChartLayoutMode] = useState<'SPLIT' | 'FULL_CHART'>('SPLIT');

  const chartClean = selectedChartSymbol
    .replace(/^NSE:/, '')
    .replace(/^BSE:/, '')
    .replace(/^NFO:/, '')
    .toUpperCase();

  // Find if current charted symbol matches an active sniper position (taken lot)
  const matchingActivePosition = activePositions.find((p) => {
    const pSym = p.symbol.toUpperCase().replace(/\s+/g, '');
    const cSym = selectedChartSymbol.toUpperCase().replace(/\s+/g, '');
    const cClean = chartClean.replace(/\s+/g, '');
    return (
      p.symbol.toUpperCase() === selectedChartSymbol.toUpperCase() ||
      p.symbol.toUpperCase() === chartClean ||
      pSym === cSym ||
      pSym === cClean ||
      (p.token && p.token === selectedChartSymbol)
    );
  });

  const matchingSignal = signals.find((s) => {
    const symClean = s.symbol.replace(/-EQ$/, '').toUpperCase();
    return (
      s.symbol.toUpperCase() === selectedChartSymbol.toUpperCase() ||
      symClean === chartClean ||
      (s.underlying && chartClean.startsWith(s.underlying.toUpperCase()))
    );
  });

  const isOption =
    Boolean(matchingActivePosition) ||
    matchingSignal?.segment === 'FNO' ||
    matchingSignal?.underlying ||
    selectedChartSymbol.endsWith('CE') ||
    selectedChartSymbol.endsWith('PE');

  const underlyingName =
    matchingSignal?.underlying ||
    (selectedChartSymbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');

  const underlyingToken =
    underlyingName === 'BANKNIFTY'
      ? '99926009'
      : underlyingName === 'NIFTY'
      ? '99926000'
      : undefined;

  const underlyingTvSymbol =
    underlyingName === 'BANKNIFTY' ? 'NSE:BANKBEES' : 'NSE:NIFTYBEES';

  const underlyingQuote =
    (underlyingToken ? getLiveQuote(underlyingToken) : undefined) ||
    getLiveQuote(underlyingName);

  // Accurate token resolution prioritising active sniper position's token
  const selectedToken =
    matchingActivePosition?.token ||
    POPULAR_WATCHLIST.find(
      (w) =>
        w.sym.toUpperCase() === selectedChartSymbol.toUpperCase() ||
        w.label.toUpperCase() === selectedChartSymbol.toUpperCase() ||
        selectedChartSymbol.toUpperCase().includes(w.sym.replace(/^NSE:/, '').toUpperCase())
    )?.lookup ||
    matchingSignal?.token;

  const currentQuote =
    (selectedToken ? getLiveQuote(selectedToken) : undefined) ||
    getLiveQuote(selectedChartSymbol) ||
    getLiveQuote(chartClean);

  const displayLtp =
    currentQuote?.ltp ??
    matchingActivePosition?.currentPrice ??
    matchingActivePosition?.entryPrice ??
    matchingSignal?.currentPrice;

  const displayChange =
    currentQuote?.change ??
    (matchingActivePosition && displayLtp && matchingActivePosition.entryPrice
      ? displayLtp - matchingActivePosition.entryPrice
      : undefined) ??
    matchingSignal?.netChange;

  const displayPercent =
    currentQuote?.percentChange ??
    (matchingActivePosition && displayLtp && matchingActivePosition.entryPrice
      ? Number((((displayLtp - matchingActivePosition.entryPrice) / matchingActivePosition.entryPrice) * 100).toFixed(2))
      : undefined) ??
    matchingSignal?.percentChange;

  // Real-time Active Sniper P&L calculation
  let posNetPnl = 0;
  let posPnlPct = '0.00';
  let posIsProfit = true;
  let holdingMins = 0;
  let timeoutMins = 25;
  let targetDistancePct: string | null = null;
  let slDistancePct: string | null = null;

  if (matchingActivePosition) {
    const ltp = displayLtp ?? matchingActivePosition.entryPrice;
    const entry = matchingActivePosition.entryPrice;
    const qty = matchingActivePosition.quantity;
    const isBuy = matchingActivePosition.action === 'BUY';
    const rawPnl = isBuy ? (ltp - entry) * qty : (entry - ltp) * qty;
    posNetPnl = rawPnl - (matchingActivePosition.charges || 0);
    posPnlPct = entry > 0 ? ((rawPnl / (entry * qty)) * 100).toFixed(2) : '0.00';
    posIsProfit = posNetPnl >= 0;

    const enteredAt = matchingActivePosition.enteredAt || Date.now();
    holdingMins = Math.round((Date.now() - enteredAt) / 60000);
    timeoutMins = matchingActivePosition.timeoutMinutes || 25;

    if (matchingActivePosition.targetPrice > 0 && ltp > 0) {
      targetDistancePct = (((matchingActivePosition.targetPrice - ltp) / ltp) * 100).toFixed(1);
    }
    if (matchingActivePosition.stopLossPrice > 0 && ltp > 0) {
      slDistancePct = (((ltp - matchingActivePosition.stopLossPrice) / ltp) * 100).toFixed(1);
    }
  }

  const thetaPct = Math.min(100, Math.max(0, Math.round((holdingMins / timeoutMins) * 100)));

  return (
    <div className="space-y-4">
      {/* 1. 🎯 Active Sniper Positions (Taken Lots) Quick Switcher Strip */}
      {activePositions && activePositions.length > 0 && (
        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-emerald-50/80 via-white to-gray-50 dark:from-emerald-950/70 dark:via-gray-900 dark:to-gray-900 border border-emerald-300 dark:border-emerald-500/40 shadow-xs dark:shadow-xl space-y-2.5 transition-colors">
          <div className="flex items-center justify-between text-xs flex-wrap gap-2">
            <span className="font-extrabold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider flex items-center gap-1.5 text-xs">
              <Zap className="w-4 h-4 fill-current animate-pulse text-emerald-600 dark:text-emerald-400" />
              <span>Active Sniper Taken Trades ({activePositions.length} Running)</span>
            </span>
            <div className="flex items-center gap-2">
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white text-[11px] font-semibold border border-gray-300 dark:border-gray-700 shadow-2xs transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Orders Book</span>
                </button>
              )}
              <span className="text-[11px] text-gray-500 dark:text-gray-400 font-mono hidden sm:inline">
                ⚡ Click any active lot below to chart its candles and track target/SL
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {activePositions.map((pos) => {
              const isSelected =
                selectedChartSymbol.toUpperCase() === pos.symbol.toUpperCase() ||
                chartClean.toUpperCase() === pos.symbol.toUpperCase() ||
                (pos.token && pos.token === selectedToken);

              const quote = (pos.token ? getLiveQuote(pos.token) : undefined) || getLiveQuote(pos.symbol);
              const ltp = quote?.ltp ?? pos.currentPrice ?? pos.entryPrice;
              const isBuy = pos.action === 'BUY';
              const rawPnl = isBuy ? (ltp - pos.entryPrice) * pos.quantity : (pos.entryPrice - ltp) * pos.quantity;
              const netPnl = rawPnl - (pos.charges || 0);
              const pnlPct = pos.entryPrice > 0 ? ((rawPnl / (pos.entryPrice * pos.quantity)) * 100).toFixed(1) : '0.0';
              const isProfit = netPnl >= 0;

              return (
                <button
                  key={pos.id}
                  type="button"
                  onClick={() => onSelectChartSymbol(pos.symbol)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-xl text-xs font-bold transition-all border shrink-0 ${
                    isSelected
                      ? 'bg-emerald-100 dark:bg-emerald-600/30 text-emerald-900 dark:text-emerald-100 border-emerald-400 ring-2 ring-emerald-500/40 shadow-sm dark:shadow-lg dark:shadow-emerald-500/20'
                      : 'bg-white dark:bg-gray-950/80 hover:bg-gray-50 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700/80 hover:border-gray-400 dark:hover:border-gray-600 shadow-2xs'
                  }`}
                  title={`Chart ${pos.symbol} taken lot`}
                >
                  <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-500 animate-ping' : 'bg-emerald-500'}`} />
                  <span className="font-mono text-gray-900 dark:text-white">{pos.symbol}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-black/50 text-gray-700 dark:text-gray-300 font-mono border border-gray-200 dark:border-transparent">
                    {pos.lots || 1} Lot ({pos.quantity} Qty)
                  </span>
                  <span className={`font-mono text-xs font-bold ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {isProfit ? '+' : ''}₹{Math.round(netPnl).toLocaleString('en-IN')} ({isProfit ? '+' : ''}{pnlPct}%)
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. 🎯 Active Sniper Taken Lot Live Telemetry Banner (When Viewing Active Position) */}
      {matchingActivePosition && (
        <div className="p-4 rounded-2xl bg-gradient-to-r from-emerald-50/90 via-white to-gray-50 dark:from-emerald-950/80 dark:via-gray-900 dark:to-gray-900 border border-emerald-300 dark:border-emerald-500/40 shadow-sm dark:shadow-xl space-y-3.5 transition-colors">
          {/* Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              {onNavigateToOrders && (
                <button
                  type="button"
                  onClick={onNavigateToOrders}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white text-xs font-semibold border border-gray-300 dark:border-gray-700 transition-colors shadow-2xs"
                  title="Return to Active Sniper & Orders tab"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back to Orders</span>
                </button>
              )}

              <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                <Zap className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-extrabold text-gray-900 dark:text-white text-base font-mono">
                    {matchingActivePosition.symbol}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40">
                    {matchingActivePosition.lots || 1} LOT{matchingActivePosition.lots > 1 ? 'S' : ''} TAKEN ({matchingActivePosition.quantity} UNITS)
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-extrabold ${
                      matchingActivePosition.mode === 'LIVE'
                        ? 'bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                        : 'bg-sky-100 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300 border border-sky-300 dark:border-sky-500/40'
                    }`}
                  >
                    {matchingActivePosition.mode === 'LIVE' ? '🔴 LIVE BROKER' : '📝 PAPER SIM'}
                  </span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-transparent">
                    Strategy: {matchingActivePosition.strategy}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                  Order ID: {matchingActivePosition.orderId} • Taken Entry @ ₹{matchingActivePosition.entryPrice}
                </div>
              </div>
            </div>

            {/* Live P&L badge & Exit Position button */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div
                  className={`text-xl font-black font-mono flex items-center justify-end gap-1 ${
                    posIsProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {posIsProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                  <span>
                    {posIsProfit ? '+' : ''}₹{Math.abs(Math.round(posNetPnl)).toLocaleString('en-IN')}
                  </span>
                </div>
                <div className={`text-xs font-bold font-mono ${posIsProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {posIsProfit ? '+' : ''}{posPnlPct}% P&L
                </div>
              </div>

              {onClosePosition && (
                <button
                  type="button"
                  onClick={() => onClosePosition(matchingActivePosition.id)}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md dark:shadow-lg shadow-rose-600/30"
                  title="Close and exit this active sniper trade immediately"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>Exit Trade</span>
                </button>
              )}
            </div>
          </div>

          {/* 5 Real-Time Telemetry Blocks */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-800 shadow-2xs">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Taken Entry</span>
              <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">₹{matchingActivePosition.entryPrice}</span>
            </div>
            <div className="p-2.5 rounded-xl bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-800 shadow-2xs">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block flex items-center gap-1">
                <Radio className="w-2.5 h-2.5 text-emerald-500 dark:text-emerald-400 animate-pulse" />
                Live LTP
              </span>
              <span className="text-sm font-bold text-gray-900 dark:text-white font-mono">
                {typeof displayLtp === 'number' ? `₹${displayLtp.toFixed(2)}` : '--'}
              </span>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-500/30 shadow-2xs">
              <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block">🎯 Target (+25%)</span>
              <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 font-mono">₹{matchingActivePosition.targetPrice}</span>
              {targetDistancePct !== null && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">
                  {targetDistancePct}% away
                </span>
              )}
            </div>
            <div className="p-2.5 rounded-xl bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-500/30 shadow-2xs">
              <span className="text-[10px] text-rose-700 dark:text-rose-400 block">🛡️ Stop Loss (-12%)</span>
              <span className="text-sm font-bold text-rose-800 dark:text-rose-300 font-mono">₹{matchingActivePosition.stopLossPrice}</span>
              {slDistancePct !== null && (
                <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5 font-mono">
                  {slDistancePct}% cushion
                </span>
              )}
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-500/30 col-span-2 sm:col-span-1 shadow-2xs">
              <span className="text-[10px] text-amber-700 dark:text-amber-400 block flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                Theta Protection
              </span>
              <span className="text-sm font-bold text-amber-800 dark:text-amber-300 font-mono">
                {holdingMins}m / {timeoutMins}m
              </span>
              <span className="text-[10px] text-gray-500 dark:text-gray-400 block mt-0.5 font-mono">
                {Math.max(0, timeoutMins - holdingMins)}m remaining
              </span>
            </div>
          </div>

          {/* Greek Metrics & Risk Strip (if available) */}
          {matchingActivePosition.greeks && (
            <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 p-2.5 rounded-xl bg-white dark:bg-black/40 border border-gray-200 dark:border-emerald-500/20 text-center text-[11px] shadow-2xs">
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[9px]">Delta Δ</span>
                <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{matchingActivePosition.greeks.delta.toFixed(2)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[9px]">Gamma Γ</span>
                <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{matchingActivePosition.greeks.gamma.toFixed(4)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[9px]">Theta Θ/day</span>
                <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">-₹{Math.abs(matchingActivePosition.greeks.theta).toFixed(1)}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[9px]">IV %</span>
                <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{matchingActivePosition.greeks.iv.toFixed(1)}%</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[9px]">Peak Price</span>
                <span className="font-bold text-emerald-700 dark:text-emerald-300 font-mono">₹{matchingActivePosition.highestPrice}</span>
              </div>
              <div>
                <span className="text-gray-500 dark:text-gray-400 block text-[9px]">Taxes / Costs</span>
                <span className="font-bold text-gray-700 dark:text-gray-300 font-mono">₹{matchingActivePosition.charges || 0}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. Quick Watchlist & Timeframe Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-900/80 p-3 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-sm transition-colors">
        {/* Quick Watchlist Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mr-1">
            Indices & Equities:
          </span>
          {POPULAR_WATCHLIST.map((item) => {
            const quote =
              getLiveQuote(item.lookup) ||
              getLiveQuote(item.sym) ||
              getLiveQuote(item.label);
            const flash =
              priceFlashes[item.lookup] || priceFlashes[item.sym];
            const isSelected =
              selectedChartSymbol.toUpperCase() === item.sym.toUpperCase();

            return (
              <button
                key={item.sym}
                type="button"
                onClick={() => onSelectChartSymbol(item.sym)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  isSelected
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                } ${
                  flash === 'up'
                    ? 'ring-1 ring-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-200'
                    : flash === 'down'
                    ? 'ring-1 ring-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-200'
                    : ''
                }`}
              >
                <span>{item.label}</span>
                {quote && typeof quote.ltp === 'number' && quote.ltp > 0 && (
                  <span className="font-mono text-[11px] font-bold text-gray-900 dark:text-white bg-gray-200/80 dark:bg-black/40 px-1.5 py-0.5 rounded">
                    {formatINR(quote.ltp)}
                    {typeof quote.percentChange === 'number' && (
                      <span
                        className={`ml-1 text-[10px] ${
                          quote.percentChange >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {quote.percentChange >= 0 ? '+' : ''}
                        {quote.percentChange}%
                      </span>
                    )}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Time Duration Selector: Seconds, Minutes, Hours/Days */}
        <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
          {/* Seconds Section */}
          <div className="flex items-center space-x-0.5 bg-gray-100 dark:bg-gray-950 p-0.5 rounded-xl border border-emerald-400/50 dark:border-emerald-500/40">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 px-1 font-mono uppercase">Sec:</span>
            {(['5s', '10s', '15s', '30s'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onChangeChartInterval(tf)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  chartInterval === tf
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-emerald-600 dark:hover:text-emerald-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
                title={`${tf} second candles`}
              >
                {tf}
              </button>
            ))}
          </div>

          {/* Minutes Section */}
          <div className="flex items-center space-x-0.5 bg-gray-100 dark:bg-gray-950 p-0.5 rounded-xl border border-gray-300 dark:border-gray-800">
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 px-1 font-mono uppercase">Min:</span>
            {(['1', '3', '5', '15', '30'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onChangeChartInterval(tf)}
                className={`px-2 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  chartInterval === tf
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
                title={`${tf} minute candles`}
              >
                {tf}m
              </button>
            ))}
          </div>

          {/* Hours/Days */}
          <div className="flex items-center space-x-0.5 bg-gray-100 dark:bg-gray-950 p-0.5 rounded-xl border border-gray-300 dark:border-gray-800">
            {(['60', 'D'] as const).map((tf) => (
              <button
                key={tf}
                type="button"
                onClick={() => onChangeChartInterval(tf)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                  chartInterval === tf
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-gray-800'
                }`}
                title={tf === 'D' ? '1 Day candles' : '1 Hour candles'}
              >
                {tf === 'D' ? '1D' : '1H'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Real-Time Live Quote Strip */}
      <div className="p-3.5 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs transition-colors">
        {/* Left: Main Chart Instrument Info */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-400/30">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              <span className="font-bold text-gray-900 dark:text-white text-sm">
                {selectedChartSymbol}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-mono border border-gray-200 dark:border-transparent">
                {matchingActivePosition
                  ? 'ACTIVE SNIPER TAKEN CONTRACT'
                  : isOption
                  ? 'DERIVATIVE CONTRACT'
                  : 'CASH SHARE'}
              </span>
              <span className="flex items-center space-x-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                <span>Live Feed</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 mt-1 text-gray-700 dark:text-gray-300">
              {typeof displayLtp === 'number' && displayLtp > 0 && (
                <div className="flex items-baseline space-x-1.5 flex-wrap">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400">
                    {isOption ? 'Option LTP:' : 'Live Share Price:'}
                  </span>
                  <span className="text-base font-extrabold text-gray-900 dark:text-white font-mono">
                    {formatINR(displayLtp)}
                  </span>
                  {typeof displayPercent === 'number' && (
                    <span
                      className={`font-semibold text-xs ${
                        displayPercent >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      ({displayPercent >= 0 ? '+' : ''}
                      {displayPercent}%{' '}
                      {displayChange !== undefined
                        ? `• ${displayChange >= 0 ? '+' : ''}${formatINR(displayChange)}`
                        : ''}
                      )
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: If Option, Show Underlying Share Live Price & OHLC */}
        <div className="flex items-center space-x-3 flex-wrap gap-y-2">
          {isOption && underlyingQuote && typeof underlyingQuote.ltp === 'number' && (
            <div className="px-3 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-500/40 text-xs">
              <div className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                Underlying {underlyingName} Share Price:
              </div>
              <div className="font-bold text-gray-900 dark:text-white font-mono text-sm mt-0.5">
                {formatINR(underlyingQuote.ltp)}
                {typeof underlyingQuote.percentChange === 'number' && (
                  <span
                    className={`text-xs ml-1.5 font-semibold ${
                      underlyingQuote.percentChange >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {underlyingQuote.percentChange >= 0 ? '+' : ''}
                    {underlyingQuote.percentChange}%
                  </span>
                )}
              </div>
            </div>
          )}

          {/* OHLC Badges if available */}
          {currentQuote && (
            <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-gray-950/80 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-800">
              <div>
                O: <span className="text-gray-900 dark:text-white">{currentQuote.open ? formatINR(currentQuote.open) : '--'}</span>
              </div>
              <div>
                H: <span className="text-emerald-600 dark:text-emerald-400">{currentQuote.high ? formatINR(currentQuote.high) : '--'}</span>
              </div>
              <div>
                L: <span className="text-rose-600 dark:text-rose-400">{currentQuote.low ? formatINR(currentQuote.low) : '--'}</span>
              </div>
              <div>
                C: <span className="text-gray-700 dark:text-gray-300">{currentQuote.close ? formatINR(currentQuote.close) : '--'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Interactive Chart Deck - 2 Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* SECTION 1: Primary Interactive Chart */}
        <div
          className={`space-y-2 transition-all ${
            chartLayoutMode === 'SPLIT'
              ? 'lg:col-span-8 xl:col-span-8'
              : 'col-span-12'
          }`}
        >
          {/* Section 1 Header: Title, LTP pill & Layout Toggle */}
          <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-white dark:bg-gray-900/80 border border-gray-200 dark:border-gray-800 text-xs flex-wrap gap-2 transition-colors">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="font-extrabold text-gray-900 dark:text-white font-mono">
                Section 1: {selectedChartSymbol}
              </span>
              {typeof displayLtp === 'number' && displayLtp > 0 && (
                <span className="text-[11px] px-2 py-0.5 rounded bg-blue-50 dark:bg-blue-950/80 text-blue-700 dark:text-blue-300 font-mono font-bold border border-blue-200 dark:border-transparent">
                  LTP: {formatINR(displayLtp)}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-y-1">
              {/* Quick Seconds Duration Pills */}
              <div className="flex items-center space-x-0.5 bg-gray-100 dark:bg-gray-950 p-0.5 rounded-lg border border-emerald-400/50 dark:border-emerald-500/30 text-[10px] font-mono">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold px-1">Sec:</span>
                {(['5s', '10s', '15s', '30s'] as const).map((tf) => (
                  <button
                    key={tf}
                    type="button"
                    onClick={() => onChangeChartInterval(tf)}
                    className={`px-1.5 py-0.5 rounded font-bold transition-all ${
                      chartInterval === tf
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {tf}
                  </button>
                ))}
              </div>

              {/* Layout Mode Toggle */}
              <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-950 p-1 rounded-lg border border-gray-300 dark:border-gray-800 text-[11px] font-mono">
                <button
                  type="button"
                  onClick={() => setChartLayoutMode('SPLIT')}
                  className={`px-2 py-0.5 rounded transition-all font-semibold ${
                    chartLayoutMode === 'SPLIT'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="Show Section 1 (Chart) + Section 2 (Telemetry/Spot)"
                >
                  2 Sections
                </button>
                <button
                  type="button"
                  onClick={() => setChartLayoutMode('FULL_CHART')}
                  className={`px-2 py-0.5 rounded transition-all font-semibold ${
                    chartLayoutMode === 'FULL_CHART'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                  title="Expand Chart to 100% Full Width"
                >
                  Full Chart
                </button>
              </div>
            </div>
          </div>

          {/* Section 1 Chart */}
          <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950">
            <TradingViewChart
              symbol={selectedChartSymbol}
              symbolToken={selectedToken}
              interval={chartInterval}
              height={chartLayoutMode === 'SPLIT' ? 620 : 680}
              theme={activeTheme}
              enableStudies={true}
              allowSymbolChange={true}
              showToolbar={true}
              livePrice={displayLtp}
              liveNetChange={displayChange}
              livePercentChange={displayPercent}
              underlyingPrice={underlyingQuote?.ltp}
              underlyingPercentChange={underlyingQuote?.percentChange}
              onSymbolChange={onSelectChartSymbol}
              onIntervalChange={(newInt) => onChangeChartInterval(newInt as any)}
            />
          </div>
        </div>

        {/* SECTION 2: Secondary Intelligence, Telemetry & Spot Chart */}
        {chartLayoutMode === 'SPLIT' && (
          <div className="lg:col-span-4 xl:col-span-4 space-y-3">
            {/* Section 2 Tab Switcher */}
            <div className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 flex-wrap gap-2 transition-colors">
              <div className="flex items-center space-x-1 p-0.5 bg-gray-100 dark:bg-gray-950 rounded-lg border border-gray-200 dark:border-gray-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSecondSectionTab('TELEMETRY')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-all ${
                    secondSectionTab === 'TELEMETRY'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Telemetry</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSecondSectionTab('UNDERLYING_CHART')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-all ${
                    secondSectionTab === 'UNDERLYING_CHART'
                      ? 'bg-blue-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>Spot Chart</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSecondSectionTab('WATCHLIST')}
                  className={`flex items-center space-x-1 px-2.5 py-1 rounded transition-all ${
                    secondSectionTab === 'WATCHLIST'
                      ? 'bg-purple-600 text-white shadow-2xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                  <span>Watchlist</span>
                </button>
              </div>

              <span className="text-[10px] font-mono font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/30 px-2 py-0.5 rounded">
                Section 2
              </span>
            </div>

            {/* Section 2 Tab 1: Telemetry & Trade Management */}
            {secondSectionTab === 'TELEMETRY' && (
              <div className="space-y-3 animate-in fade-in">
                {/* A. If Matching Active Position: Show Live P&L, Target, SL, Theta, Greeks & Exit button */}
                {matchingActivePosition ? (
                  <div className="p-4 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-xl space-y-3.5 transition-colors">
                    {/* Live P&L Card */}
                    <div className={`p-3.5 rounded-xl border ${
                      posIsProfit
                        ? 'bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/40'
                        : 'bg-rose-50/80 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/40'
                    }`}>
                      <div className="flex items-center justify-between text-xs font-semibold mb-1">
                        <span className="text-gray-700 dark:text-gray-300">Live Taken Lot P&amp;L</span>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-gray-100 dark:bg-black/40 text-gray-700 dark:text-gray-300 font-mono border border-gray-200 dark:border-transparent">
                          {matchingActivePosition.lots || 1} Lot ({matchingActivePosition.quantity} units)
                        </span>
                      </div>
                      <div className="flex items-baseline justify-between">
                        <div className={`text-2xl font-black font-mono flex items-center gap-1.5 ${
                          posIsProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {posIsProfit ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                          <span>{posIsProfit ? '+' : ''}₹{Math.abs(Math.round(posNetPnl)).toLocaleString('en-IN')}</span>
                        </div>
                        <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                          posIsProfit ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300' : 'bg-rose-100 dark:bg-rose-500/20 text-rose-800 dark:text-rose-300'
                        }`}>
                          {posIsProfit ? '+' : ''}{posPnlPct}%
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2.5 pt-2.5 border-t border-gray-200 dark:border-gray-800 text-[11px] font-mono">
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Entry Price</span>
                          <strong className="text-gray-900 dark:text-white">₹{matchingActivePosition.entryPrice}</strong>
                        </div>
                        <div>
                          <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Live LTP</span>
                          <strong className="text-gray-900 dark:text-white">
                            {typeof displayLtp === 'number' ? `₹${displayLtp.toFixed(2)}` : '--'}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Target & SL Progress Boxes */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30">
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 block font-semibold">🎯 Target (+25%)</span>
                        <span className="text-sm font-bold text-emerald-800 dark:text-emerald-300 font-mono">₹{matchingActivePosition.targetPrice}</span>
                        {targetDistancePct !== null && (
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 block mt-0.5 font-mono">{targetDistancePct}% away</span>
                        )}
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30">
                        <span className="text-[10px] text-rose-700 dark:text-rose-400 block font-semibold">🛡️ Stop Loss (-12%)</span>
                        <span className="text-sm font-bold text-rose-800 dark:text-rose-300 font-mono">₹{matchingActivePosition.stopLossPrice}</span>
                        {slDistancePct !== null && (
                          <span className="text-[10px] text-rose-600 dark:text-rose-400 block mt-0.5 font-mono">{slDistancePct}% cushion</span>
                        )}
                      </div>
                    </div>

                    {/* Theta Protection Timer */}
                    <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span className="text-amber-700 dark:text-amber-400 flex items-center gap-1 text-[11px]">
                          <Clock className="w-3 h-3" />
                          <span>Theta Protection</span>
                        </span>
                        <span className="text-[11px] font-mono text-gray-700 dark:text-gray-300">
                          {holdingMins}m / {timeoutMins}m
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 ${
                            thetaPct > 80 ? 'bg-rose-500' : thetaPct > 50 ? 'bg-amber-500' : 'bg-emerald-500'
                          }`}
                          style={{ width: `${thetaPct}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono flex justify-between">
                        <span>Remaining: {Math.max(0, timeoutMins - holdingMins)}m</span>
                        <span>Auto-Exit: {timeoutMins}m</span>
                      </div>
                    </div>

                    {/* Option Greeks Grid */}
                    {matchingActivePosition.greeks && (
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                        <span className="text-[10px] font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider block">
                          Greeks &amp; Risk Metrics
                        </span>
                        <div className="grid grid-cols-3 gap-1.5 text-center font-mono text-[11px]">
                          <div className="p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Delta Δ</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400">{matchingActivePosition.greeks.delta.toFixed(2)}</span>
                          </div>
                          <div className="p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Gamma Γ</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400">{matchingActivePosition.greeks.gamma.toFixed(4)}</span>
                          </div>
                          <div className="p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Theta Θ</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400">-₹{Math.abs(matchingActivePosition.greeks.theta).toFixed(1)}</span>
                          </div>
                          <div className="p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">IV %</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400">{matchingActivePosition.greeks.iv.toFixed(1)}%</span>
                          </div>
                          <div className="p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Peak</span>
                            <span className="font-bold text-emerald-700 dark:text-emerald-300">₹{matchingActivePosition.highestPrice}</span>
                          </div>
                          <div className="p-1.5 rounded bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
                            <span className="text-[9px] text-gray-500 dark:text-gray-400 block">Costs</span>
                            <span className="font-bold text-gray-700 dark:text-gray-300">₹{matchingActivePosition.charges || 0}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Exit Button */}
                    {onClosePosition && (
                      <button
                        type="button"
                        onClick={() => onClosePosition(matchingActivePosition.id)}
                        className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md dark:shadow-lg shadow-rose-600/30 transition-all"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                        <span>Exit Position Immediately</span>
                      </button>
                    )}
                  </div>
                ) : matchingSignal ? (
                  /* B. If Matching AI Signal: Show Signal Execution Card */
                  <div className="p-4 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-xl space-y-3 transition-colors">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                        <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                        <span>AI Signal Detected</span>
                      </span>
                      <span
                        className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                          matchingSignal.action === 'BUY'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                            : 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
                        }`}
                      >
                        {matchingSignal.action}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 flex justify-between">
                        <span className="text-gray-500 dark:text-gray-400">Trigger Price:</span>
                        <strong className="text-gray-900 dark:text-white">{formatINR(matchingSignal.currentPrice)}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-500/30 flex justify-between">
                        <span className="text-emerald-700 dark:text-emerald-400">Take Profit (TP1):</span>
                        <strong className="text-emerald-800 dark:text-emerald-300">{formatINR(matchingSignal.target1)}</strong>
                      </div>
                      <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-500/30 flex justify-between">
                        <span className="text-rose-700 dark:text-rose-400">Stop Loss:</span>
                        <strong className="text-rose-800 dark:text-rose-300">{formatINR(matchingSignal.stopLoss)}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => onExecuteSignal(matchingSignal)}
                      className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md dark:shadow-lg shadow-emerald-600/30 transition-all"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" />
                      <span>Execute {matchingSignal.action} Now</span>
                    </button>
                  </div>
                ) : (
                  /* C. General Symbol Statistics & OHLC */
                  <div className="p-4 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-xl space-y-3 transition-colors">
                    <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider block">
                      Instrument Telemetry &amp; Depth
                    </span>
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Open</span>
                        <span className="font-bold text-gray-900 dark:text-white">
                          {currentQuote?.open ? formatINR(currentQuote.open) : '--'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block">High</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {currentQuote?.high ? formatINR(currentQuote.high) : '--'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Low</span>
                        <span className="font-bold text-rose-600 dark:text-rose-400">
                          {currentQuote?.low ? formatINR(currentQuote.low) : '--'}
                        </span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Close</span>
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                          {currentQuote?.close ? formatINR(currentQuote.close) : '--'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Section 2 Tab 2: Underlying Spot Candlestick Chart */}
            {secondSectionTab === 'UNDERLYING_CHART' && (
              <div className="p-3 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-xl space-y-2 animate-in fade-in transition-colors">
                <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-500/30 flex items-center justify-between text-xs">
                  <div>
                    <div className="text-[10px] text-blue-700 dark:text-blue-300 uppercase font-bold flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-blue-500 dark:bg-blue-400 animate-pulse" />
                      <span>Underlying: {underlyingName} Spot</span>
                    </div>
                    <div className="text-[11px] font-mono text-gray-600 dark:text-gray-300 mt-0.5">
                      Dual Charting: Spot Price Confirmation
                    </div>
                  </div>
                  {underlyingQuote && typeof underlyingQuote.ltp === 'number' && (
                    <div className="text-right font-mono">
                      <div className="text-sm font-black text-gray-900 dark:text-white">{formatINR(underlyingQuote.ltp)}</div>
                      {typeof underlyingQuote.percentChange === 'number' && (
                        <div className={`text-[10px] font-bold ${
                          underlyingQuote.percentChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {underlyingQuote.percentChange >= 0 ? '+' : ''}{underlyingQuote.percentChange}%
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 h-[380px] bg-white dark:bg-gray-950">
                  <TradingViewChart
                    symbol={underlyingTvSymbol}
                    symbolToken={underlyingToken}
                    interval={chartInterval}
                    height={380}
                    theme={activeTheme}
                    enableStudies={false}
                    showToolbar={false}
                    livePrice={underlyingQuote?.ltp}
                  />
                </div>
              </div>
            )}

            {/* Section 2 Tab 3: Quick Watchlist */}
            {secondSectionTab === 'WATCHLIST' && (
              <div className="p-3 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-xs dark:shadow-xl space-y-2 animate-in fade-in transition-colors">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider block">
                  Quick Switch Instruments
                </span>
                <div className="space-y-1.5 max-h-[460px] overflow-y-auto no-scrollbar">
                  {POPULAR_WATCHLIST.map((item) => {
                    const quote =
                      getLiveQuote(item.lookup) ||
                      getLiveQuote(item.sym) ||
                      getLiveQuote(item.label);
                    const isSelected = selectedChartSymbol.toUpperCase() === item.sym.toUpperCase();

                    return (
                      <button
                        key={item.sym}
                        type="button"
                        onClick={() => onSelectChartSymbol(item.sym)}
                        className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs font-semibold transition-all border ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-600/30 text-blue-900 dark:text-white border-blue-400 ring-1 ring-blue-500/40'
                            : 'bg-gray-50 dark:bg-gray-950/70 hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-800 dark:text-gray-300 border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        <span className="font-mono">{item.label}</span>
                        {quote && typeof quote.ltp === 'number' && (
                          <div className="text-right font-mono text-[11px]">
                            <span className="text-gray-900 dark:text-white font-bold">{formatINR(quote.ltp)}</span>
                            {typeof quote.percentChange === 'number' && (
                              <span className={`ml-1.5 ${
                                quote.percentChange >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                              }`}>
                                {quote.percentChange >= 0 ? '+' : ''}{quote.percentChange}%
                              </span>
                            )}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 6. Connected AI Signal & Execution Overlay for this Symbol (if active signal exists and in full chart mode) */}
      {chartLayoutMode === 'FULL_CHART' && matchingSignal && !matchingActivePosition && (() => {
        const isBuy = matchingSignal.action === 'BUY';
        const isSell = matchingSignal.action === 'SELL';
        const isFno = matchingSignal.segment === 'FNO' || !!matchingSignal.underlying;

        return (
          <div className="p-4 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 shadow-md dark:shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4 transition-colors">
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                  isBuy
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-500/40'
                    : isSell
                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-300 border border-rose-300 dark:border-rose-500/40'
                    : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300 border border-amber-300 dark:border-amber-500/40'
                }`}
              >
                AI Signal: {matchingSignal.action}
              </span>

              <div className="text-xs text-gray-700 dark:text-gray-300 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {isFno ? 'Option LTP:' : 'Live Share LTP:'}
                </span>
                <strong className="text-gray-900 dark:text-white font-mono">
                  {formatINR(matchingSignal.currentPrice)}
                </strong>

                {/* If FNO Option, also show the live price of that underlying share */}
                {isFno && underlyingQuote && typeof underlyingQuote.ltp === 'number' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-500/40 text-blue-800 dark:text-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                    <span>Underlying {underlyingName}:</span>
                    <strong className="text-gray-900 dark:text-white font-mono">
                      {formatINR(underlyingQuote.ltp)}
                    </strong>
                    {typeof underlyingQuote.percentChange === 'number' && (
                      <span
                        className={`text-[10px] ${
                          underlyingQuote.percentChange >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        ({underlyingQuote.percentChange >= 0 ? '+' : ''}
                        {underlyingQuote.percentChange}%)
                      </span>
                    )}
                  </span>
                )}

                <span className="text-gray-400 dark:text-gray-600">|</span>
                <span>SL:</span>{' '}
                <strong className="text-rose-600 dark:text-rose-400 font-mono">
                  {formatINR(matchingSignal.stopLoss)}
                </strong>
                <span className="text-gray-400 dark:text-gray-600">|</span>
                <span>TP1:</span>{' '}
                <strong className="text-emerald-600 dark:text-emerald-400 font-mono">
                  {formatINR(matchingSignal.target1)}
                </strong>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => onExecuteSignal(matchingSignal)}
                className={`w-full sm:w-auto flex items-center justify-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                  isBuy
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                    : isSell
                    ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                    : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                }`}
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Execute {matchingSignal.action} Now</span>
              </button>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
