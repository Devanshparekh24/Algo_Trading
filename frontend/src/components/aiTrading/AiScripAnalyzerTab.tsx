import React from 'react';
import {
  Sparkles,
  Search,
  Play,
} from 'lucide-react';
import type { TradeSignal } from '../../services/aiTradingService';
import type { RealtimeTickData } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';

export const POPULAR_SCRIPS = [
  { symbol: 'RELIANCE-EQ', token: '2885', exchange: 'NSE', name: 'Reliance' },
  { symbol: 'TATASTEEL-EQ', token: '3499', exchange: 'NSE', name: 'Tata Steel' },
  { symbol: 'SBIN-EQ', token: '3045', exchange: 'NSE', name: 'SBI' },
  { symbol: 'HDFCBANK-EQ', token: '1333', exchange: 'NSE', name: 'HDFC Bank' },
  { symbol: 'INFY-EQ', token: '1594', exchange: 'NSE', name: 'Infosys' },
  { symbol: 'ICICIBANK-EQ', token: '4963', exchange: 'NSE', name: 'ICICI Bank' },
  { symbol: 'TCS-EQ', token: '11536', exchange: 'NSE', name: 'TCS' },
  { symbol: 'ITC-EQ', token: '1660', exchange: 'NSE', name: 'ITC' },
];

interface AiScripAnalyzerTabProps {
  selectedScrip: { symbol: string; token: string; exchange: string; name: string };
  onSelectScrip: (scrip: { symbol: string; token: string; exchange: string; name: string }) => void;
  customSymbol: string;
  setCustomSymbol: (val: string) => void;
  customToken: string;
  setCustomToken: (val: string) => void;
  analyzedSignal: TradeSignal | null;
  isAnalyzing: boolean;
  onAnalyzeScrip: (symbol: string, token: string, exchange: string) => void;
  priceFlashes: Record<string, 'up' | 'down'>;
  getLiveQuote: (tokenOrSymbol?: string) => RealtimeTickData | undefined;
  onOpenExecuteModal: (signal: TradeSignal) => void;
}

export const AiScripAnalyzerTab: React.FC<AiScripAnalyzerTabProps> = ({
  selectedScrip,
  onSelectScrip,
  customSymbol,
  setCustomSymbol,
  customToken,
  setCustomToken,
  analyzedSignal,
  isAnalyzing,
  onAnalyzeScrip,
  priceFlashes,
  getLiveQuote,
  onOpenExecuteModal,
}) => {
  return (
    <div className="space-y-6">
      {/* Analyzer Controls Card */}
      <div className="p-5 md:p-6 rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur-xl shadow-xl space-y-5">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-blue-400" />
            Deep Multi-Factor Technical Analyzer
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Select any equity or enter custom symbol token to compute live multi-timeframe indicators, momentum confluence, and high-probability order levels.
          </p>
        </div>

        {/* Quick Pick Watchlist */}
        <div className="space-y-2">
          <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
            Select from Core Universe:
          </span>
          <div className="flex flex-wrap gap-2">
            {POPULAR_SCRIPS.map((scrip) => (
              <button
                key={scrip.token}
                type="button"
                onClick={() => {
                  onSelectScrip(scrip);
                  onAnalyzeScrip(scrip.symbol, scrip.token, scrip.exchange);
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                  selectedScrip.token === scrip.token
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                    : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700'
                }`}
              >
                {scrip.name}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input */}
        <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-gray-800">
          <input
            type="text"
            placeholder="Or custom Symbol (e.g. PARAGMILK-EQ)"
            value={customSymbol}
            onChange={(e) => setCustomSymbol(e.target.value)}
            className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <input
            type="text"
            placeholder="Token (e.g. 17130)"
            value={customToken}
            onChange={(e) => setCustomToken(e.target.value)}
            className="w-full sm:w-1/3 px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500 font-mono"
          />
          <button
            type="button"
            onClick={() => {
              if (customSymbol && customToken) {
                onAnalyzeScrip(customSymbol.toUpperCase(), customToken, 'NSE');
              }
            }}
            disabled={isAnalyzing || !customSymbol || !customToken}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
          >
            <Search className="w-4 h-4" />
            <span>{isAnalyzing ? 'Analyzing...' : 'Deep Analyze'}</span>
          </button>
        </div>
      </div>

      {/* Deep Analysis Result Card */}
      {analyzedSignal && (
        <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950/30 border border-blue-500/40 backdrop-blur-xl shadow-2xl space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
            <div>
              <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                <h3 className="text-2xl font-bold text-white">{analyzedSignal.symbol}</h3>
                <span className="text-xs px-2.5 py-1 rounded-md bg-gray-800 text-gray-300 font-mono">
                  {analyzedSignal.exchange} • {analyzedSignal.token}
                </span>
                <span
                  className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                    analyzedSignal.action === 'BUY'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : analyzedSignal.action === 'SELL'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  }`}
                >
                  AI Verdict: {analyzedSignal.action}
                </span>
              </div>

              {(() => {
                const flash =
                  priceFlashes[analyzedSignal.token] ||
                  priceFlashes[analyzedSignal.symbol] ||
                  priceFlashes[analyzedSignal.symbol.replace(/-EQ$/, '')];

                return (
                  <div className="mt-1 text-sm text-gray-400 flex items-center gap-1.5 flex-wrap">
                    <span
                      className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                      title="Streaming Live via WebSocket"
                    />
                    <span>Live LTP:</span>
                    <strong
                      className={`font-mono transition-colors ${
                        flash === 'up'
                          ? 'text-emerald-300'
                          : flash === 'down'
                          ? 'text-rose-300'
                          : 'text-white'
                      }`}
                    >
                      {formatINR(analyzedSignal.currentPrice)}
                      {flash === 'up' && <span className="text-xs ml-1 text-emerald-400">▲</span>}
                      {flash === 'down' && <span className="text-xs ml-1 text-rose-400">▼</span>}
                    </strong>
                    <span
                      className={`font-semibold ${
                        analyzedSignal.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      ({analyzedSignal.netChange >= 0 ? '+' : ''}
                      {analyzedSignal.percentChange}%)
                    </span>
                  </div>
                );
              })()}

              {/* For F&O Option Contracts: Display Live Price of THAT SHARE */}
              {(() => {
                if (analyzedSignal.segment !== 'FNO' && !analyzedSignal.underlying) return null;
                const underName =
                  analyzedSignal.underlying ||
                  (analyzedSignal.symbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');
                const underToken =
                  underName === 'BANKNIFTY'
                    ? '99926009'
                    : underName === 'NIFTY'
                    ? '99926000'
                    : undefined;
                const underQuote =
                  (underToken ? getLiveQuote(underToken) : undefined) ||
                  getLiveQuote(underName);
                if (!underQuote || typeof underQuote.ltp !== 'number') return null;

                return (
                  <div className="mt-2.5 p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs">
                    <span className="text-blue-300 font-medium flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      Underlying {underName} Live Price:
                    </span>
                    <span className="font-bold text-white font-mono">
                      {formatINR(underQuote.ltp)}
                      {typeof underQuote.percentChange === 'number' && (
                        <span
                          className={`ml-1.5 text-[11px] font-semibold ${
                            underQuote.percentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ({underQuote.percentChange >= 0 ? '+' : ''}
                          {underQuote.percentChange}%)
                        </span>
                      )}
                    </span>
                  </div>
                );
              })()}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => onOpenExecuteModal(analyzedSignal)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2 transition-all"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Execute Order</span>
              </button>
            </div>
          </div>

          {/* Technical Indicator Gauges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
              <div className="text-xs text-gray-400">RSI (14)</div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {analyzedSignal.indicators.rsi}
              </div>
              <div className="text-xs text-blue-400 mt-0.5">
                {analyzedSignal.indicators.rsiSignal}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
              <div className="text-xs text-gray-400">EMA Trend</div>
              <div className="text-xl font-bold text-white mt-1">
                {analyzedSignal.indicators.emaTrend}
              </div>
              <div className="text-xs text-gray-400 mt-0.5 font-mono">
                EMA9: ₹{analyzedSignal.indicators.ema9} | EMA21: ₹{analyzedSignal.indicators.ema21}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
              <div className="text-xs text-gray-400">MACD Histogram</div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {analyzedSignal.indicators.macd.histogram}
              </div>
              <div className="text-xs text-gray-400 mt-0.5">
                {analyzedSignal.indicators.macd.trend}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
              <div className="text-xs text-gray-400">Order Depth</div>
              <div className="text-xl font-bold text-white mt-1 font-mono">
                {analyzedSignal.indicators.orderBookImbalance}% Buyers
              </div>
              <div className="text-xs text-emerald-400 mt-0.5">
                {analyzedSignal.indicators.orderBookImbalance > 50 ? 'Net Bullish' : 'Net Bearish'}
              </div>
            </div>
          </div>

          {/* Pivot Points & Order Levels */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
              <div className="text-xs text-gray-400">Entry Level</div>
              <div className="text-base font-bold text-white mt-1 font-mono">
                {formatINR(analyzedSignal.entryPrice)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-950/80 border border-rose-500/20 bg-rose-950/10">
              <div className="text-xs text-rose-300">Stop Loss</div>
              <div className="text-base font-bold text-rose-400 mt-1 font-mono">
                {formatINR(analyzedSignal.stopLoss)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-950/80 border border-emerald-500/20 bg-emerald-950/10">
              <div className="text-xs text-emerald-300">Target 1</div>
              <div className="text-base font-bold text-emerald-400 mt-1 font-mono">
                {formatINR(analyzedSignal.target1)}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-gray-950/80 border border-purple-500/20 bg-purple-950/10">
              <div className="text-xs text-purple-300">Target 2</div>
              <div className="text-base font-bold text-purple-400 mt-1 font-mono">
                {formatINR(analyzedSignal.target2)}
              </div>
            </div>
          </div>

          {/* AI Trade Thesis */}
          <div className="p-4 rounded-xl bg-blue-950/20 border border-blue-500/20 space-y-2">
            <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
              AI Trade Thesis & Confluence Rationale
            </h4>
            <p className="text-sm text-gray-200 leading-relaxed font-medium">
              {analyzedSignal.aiThesis.summary}
            </p>
            {analyzedSignal.aiThesis.rationale && analyzedSignal.aiThesis.rationale.length > 0 && (
              <ul className="space-y-1.5 pt-2 pl-4 list-disc text-xs text-gray-400">
                {analyzedSignal.aiThesis.rationale.map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

