import React from 'react';
import { BarChart2, Play } from 'lucide-react';
import TradingViewChart from '../tradingview/TradingViewChart';
import type { TradeSignal } from '../../services/aiTradingService';
import type { RealtimeTickData } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';

interface AiTradingChartTabProps {
  selectedChartSymbol: string;
  onSelectChartSymbol: (symbol: string) => void;
  chartInterval: '1' | '5' | '15' | '60' | 'D';
  onChangeChartInterval: (interval: '1' | '5' | '15' | '60' | 'D') => void;
  signals: TradeSignal[];
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
  selectedChartSymbol,
  onSelectChartSymbol,
  chartInterval,
  onChangeChartInterval,
  signals,
  priceFlashes,
  getLiveQuote,
  onExecuteSignal,
}) => {
  const chartClean = selectedChartSymbol
    .replace(/^NSE:/, '')
    .replace(/^BSE:/, '')
    .replace(/^NFO:/, '')
    .toUpperCase();

  const currentQuote = getLiveQuote(selectedChartSymbol) || getLiveQuote(chartClean);

  const matchingSignal = signals.find((s) => {
    const symClean = s.symbol.replace(/-EQ$/, '').toUpperCase();
    return (
      s.symbol.toUpperCase() === selectedChartSymbol.toUpperCase() ||
      symClean === chartClean ||
      (s.underlying && chartClean.startsWith(s.underlying.toUpperCase()))
    );
  });

  const isOption =
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

  const underlyingQuote =
    (underlyingToken ? getLiveQuote(underlyingToken) : undefined) ||
    getLiveQuote(underlyingName);

  const displayLtp = currentQuote?.ltp ?? matchingSignal?.currentPrice;
  const displayChange = currentQuote?.change ?? matchingSignal?.netChange;
  const displayPercent = currentQuote?.percentChange ?? matchingSignal?.percentChange;

  return (
    <div className="space-y-4">
      {/* Quick Stock Switcher & Timeframe Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 p-3 rounded-2xl border border-gray-800 shadow-sm">
        {/* Quick Watchlist Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-semibold text-gray-400 uppercase mr-1">
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
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                } ${
                  flash === 'up'
                    ? 'ring-1 ring-emerald-400 bg-emerald-950/40 text-emerald-200'
                    : flash === 'down'
                    ? 'ring-1 ring-rose-400 bg-rose-950/40 text-rose-200'
                    : ''
                }`}
              >
                <span>{item.label}</span>
                {quote && typeof quote.ltp === 'number' && quote.ltp > 0 && (
                  <span className="font-mono text-[11px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">
                    {formatINR(quote.ltp)}
                    {typeof quote.percentChange === 'number' && (
                      <span
                        className={`ml-1 text-[10px] ${
                          quote.percentChange >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
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

        {/* Timeframe Selector */}
        <div className="flex items-center space-x-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
          {(['1', '5', '15', '60', 'D'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => onChangeChartInterval(tf)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                chartInterval === tf
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tf === 'D' ? '1D' : tf === '60' ? '1H' : `${tf}m`}
            </button>
          ))}
        </div>
      </div>

      {/* Real-Time Live Quote Strip */}
      <div className="p-3.5 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-blue-950/40 border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Left: Main Chart Instrument Info */}
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
            <BarChart2 className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2 flex-wrap">
              <span className="font-bold text-white text-sm">
                {selectedChartSymbol}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 text-[10px] font-mono">
                {isOption ? 'DERIVATIVE CONTRACT' : 'CASH SHARE'}
              </span>
              <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Feed</span>
              </span>
            </div>

            <div className="flex items-center space-x-3 mt-1 text-gray-300">
              {typeof displayLtp === 'number' && displayLtp > 0 && (
                <div className="flex items-baseline space-x-1.5">
                  <span className="text-[11px] text-gray-400">
                    {isOption ? 'Option LTP:' : 'Live Share Price:'}
                  </span>
                  <span className="text-base font-extrabold text-white font-mono">
                    {formatINR(displayLtp)}
                  </span>
                  {typeof displayPercent === 'number' && (
                    <span
                      className={`font-semibold text-xs ${
                        displayPercent >= 0 ? 'text-emerald-400' : 'text-rose-400'
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
        <div className="flex items-center space-x-3 flex-wrap">
          {isOption && underlyingQuote && typeof underlyingQuote.ltp === 'number' && (
            <div className="px-3 py-1.5 rounded-xl bg-blue-950/60 border border-blue-500/40 text-xs">
              <div className="text-[10px] text-blue-300 uppercase font-semibold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Underlying {underlyingName} Share Price:
              </div>
              <div className="font-bold text-white font-mono text-sm mt-0.5">
                {formatINR(underlyingQuote.ltp)}
                {typeof underlyingQuote.percentChange === 'number' && (
                  <span
                    className={`text-xs ml-1.5 font-semibold ${
                      underlyingQuote.percentChange >= 0
                        ? 'text-emerald-400'
                        : 'text-rose-400'
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
            <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono text-gray-400 bg-gray-950/80 px-3 py-1.5 rounded-xl border border-gray-800">
              <div>
                O: <span className="text-white">{currentQuote.open ? formatINR(currentQuote.open) : '--'}</span>
              </div>
              <div>
                H: <span className="text-emerald-400">{currentQuote.high ? formatINR(currentQuote.high) : '--'}</span>
              </div>
              <div>
                L: <span className="text-rose-400">{currentQuote.low ? formatINR(currentQuote.low) : '--'}</span>
              </div>
              <div>
                C: <span className="text-gray-300">{currentQuote.close ? formatINR(currentQuote.close) : '--'}</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive TradingView Chart Component */}
      <TradingViewChart
        symbol={selectedChartSymbol}
        interval={chartInterval}
        height={620}
        theme="dark"
        enableStudies={true}
        allowSymbolChange={true}
        showToolbar={true}
        livePrice={currentQuote?.ltp ?? matchingSignal?.currentPrice}
        liveNetChange={currentQuote?.change ?? matchingSignal?.netChange}
        livePercentChange={currentQuote?.percentChange ?? matchingSignal?.percentChange}
        underlyingPrice={underlyingQuote?.ltp}
        underlyingPercentChange={underlyingQuote?.percentChange}
        onSymbolChange={onSelectChartSymbol}
      />

      {/* Connected AI Signal & Execution Overlay for this Symbol */}
      {matchingSignal && (() => {
        const isBuy = matchingSignal.action === 'BUY';
        const isSell = matchingSignal.action === 'SELL';
        const isFno = matchingSignal.segment === 'FNO' || !!matchingSignal.underlying;

        return (
          <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center space-x-3 flex-wrap gap-y-2">
              <span
                className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                  isBuy
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : isSell
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}
              >
                AI Signal: {matchingSignal.action} ({matchingSignal.confidence}%)
              </span>

              <div className="text-xs text-gray-300 flex items-center gap-2 flex-wrap">
                <span className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {isFno ? 'Option LTP:' : 'Live Share LTP:'}
                </span>
                <strong className="text-white font-mono">
                  {formatINR(matchingSignal.currentPrice)}
                </strong>

                {/* If FNO Option, also show the live price of that underlying share */}
                {isFno && underlyingQuote && typeof underlyingQuote.ltp === 'number' && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-500/40 text-blue-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                    <span>Underlying {underlyingName}:</span>
                    <strong className="text-white font-mono">
                      {formatINR(underlyingQuote.ltp)}
                    </strong>
                    {typeof underlyingQuote.percentChange === 'number' && (
                      <span
                        className={`text-[10px] ${
                          underlyingQuote.percentChange >= 0
                            ? 'text-emerald-400'
                            : 'text-rose-400'
                        }`}
                      >
                        ({underlyingQuote.percentChange >= 0 ? '+' : ''}
                        {underlyingQuote.percentChange}%)
                      </span>
                    )}
                  </span>
                )}

                <span className="text-gray-600">|</span>
                <span>SL:</span>{' '}
                <strong className="text-rose-400 font-mono">
                  {formatINR(matchingSignal.stopLoss)}
                </strong>
                <span className="text-gray-600">|</span>
                <span>TP1:</span>{' '}
                <strong className="text-emerald-400 font-mono">
                  {formatINR(matchingSignal.target1)}
                </strong>
              </div>
            </div>

            <div className="flex items-center space-x-3 shrink-0">
              <button
                type="button"
                onClick={() => onExecuteSignal(matchingSignal)}
                className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
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
