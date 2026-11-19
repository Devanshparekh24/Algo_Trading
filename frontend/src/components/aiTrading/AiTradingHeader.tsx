import React from 'react';
import {
  Bot,
  Zap,
  RefreshCw,
  Sliders,
  Layers,
  Radio,
  AlertTriangle,
  Flame,
  Wallet,
} from 'lucide-react';
import type { AutoPilotConfig } from '../../services/aiTradingService';
import type { MarketStatusInfo } from '../../types';

export interface AiTradingHeaderProps {
  isLiveConnected: boolean;
  totalTicksReceived: number;
  lastTickAt: string | null;
  autoPilot: AutoPilotConfig;
  universeCount: number;
  isScanning: boolean;
  onRefreshLivePrices: () => void;
  onChangeAutoPilotMode: (mode: 'PAPER' | 'LIVE') => void;
  onChangeRiskTolerance?: (risk: 'AGGRESSIVE' | 'BALANCED' | 'CONSERVATIVE') => void;
  onOpenAutoPilotModal: () => void;
  onOpenUniverseModal: () => void;
  onScanMarket: () => void;
  onPauseAutoPilot: () => void;
  onResetKillSwitch?: () => void;
  marketStatus?: MarketStatusInfo | null;
  activeStrategyName?: string;
  geminiDecision?: any;
  newsHeadlines?: any[];
}

export const AiTradingHeader: React.FC<AiTradingHeaderProps> = ({
  isLiveConnected,
  totalTicksReceived,
  lastTickAt,
  autoPilot,
  universeCount,
  isScanning,
  onRefreshLivePrices,
  onChangeAutoPilotMode,
  onChangeRiskTolerance,
  onOpenAutoPilotModal,
  onOpenUniverseModal,
  onScanMarket,
  onPauseAutoPilot,
  onResetKillSwitch,
  marketStatus,
  activeStrategyName,
  geminiDecision,
  newsHeadlines,
}) => {
  const isMarketOpen = marketStatus ? marketStatus.isOpen : false;

  return (
    <div className="space-y-2.5 sm:space-y-3">
      {/* 1. Gemini Autonomous Brain & Real-Time Macro News Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-2 rounded-xl bg-purple-50/90 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-500/30 text-xs shadow-xs transition-colors">
        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
          <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-extrabold border border-purple-300 dark:border-purple-500/40 text-[10px] uppercase tracking-wider shrink-0 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-purple-500 dark:bg-purple-400 animate-pulse" />
            Gemini 3.5 Autonomous Brain Active
          </span>
          {geminiDecision ? (
            <div className="flex items-center gap-1.5 text-gray-700 dark:text-gray-300 text-[11px] truncate max-w-full sm:max-w-xl">
              <span
                className={`px-1.5 py-0.5 rounded font-extrabold text-[10px] uppercase border shrink-0 ${
                  geminiDecision.approved
                    ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-300 dark:border-emerald-500/40'
                    : 'bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40'
                }`}
              >
                {geminiDecision.decision} ({geminiDecision.confidenceScore}%)
              </span>
              <span className="font-bold text-gray-900 dark:text-white shrink-0">{geminiDecision.symbol}:</span>
              <span className="text-gray-600 dark:text-gray-400 truncate">
                {geminiDecision.newsCatalyst || geminiDecision.thesis}
              </span>
            </div>
          ) : (
            <span className="text-gray-500 dark:text-gray-400 text-[11px]">
              AI independently reconciling live Indian financial headlines, past trade wins/losses & Greeks before order execution.
            </span>
          )}
        </div>

        {newsHeadlines && newsHeadlines.length > 0 && (
          <div className="text-[11px] text-gray-600 dark:text-gray-400 flex items-center gap-1.5 truncate max-w-full sm:max-w-xs md:max-w-md shrink-0">
            <span className="text-blue-600 dark:text-blue-400 font-bold shrink-0">📰 Live News:</span>
            <span className="truncate text-gray-800 dark:text-gray-200" title={newsHeadlines[0].title}>
              {newsHeadlines[0].title}
            </span>
          </div>
        )}
      </div>

      {/* 2. Top Market Status & Live Heartbeat Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-white/90 dark:bg-gray-950/80 border border-gray-200 dark:border-gray-800 text-[11px] shadow-xs backdrop-blur-md transition-colors">
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
          {/* Market Open / Closed Pill */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full font-bold shadow-2xs ${
              isMarketOpen
                ? 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30'
                : 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isMarketOpen ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-rose-500 dark:bg-rose-400'
              }`}
            />
            <span className="uppercase tracking-wider">
              {isMarketOpen ? 'NSE/BSE LIVE' : 'MARKET CLOSED'}
            </span>
          </div>

          {/* Session Timing / Next Session info */}
          <span className="text-gray-600 dark:text-gray-400 font-medium">
            {isMarketOpen
              ? `Session Closes: 03:30 PM IST (${marketStatus?.tradingHours || '09:15 – 15:30'})`
              : `Next Session: ${marketStatus?.nextSession || 'Mon 09:15 AM IST'}`}
          </span>

          {/* Real-time IST Clock */}
          <span className="text-gray-500 font-mono hidden md:inline">
            • {marketStatus?.timeIST || 'IST'}
          </span>
        </div>

        {/* WebSocket Stream Live Telemetry */}
        <div className="flex items-center space-x-2 text-gray-500 dark:text-gray-400">
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border text-[11px] ${
              isLiveConnected
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30'
                : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30'
            }`}
          >
            <Radio className={`w-3 h-3 ${isLiveConnected ? 'animate-pulse text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}`} />
            <span>
              {isLiveConnected
                ? `Live Feed (${totalTicksReceived} ticks${lastTickAt ? ` • ${lastTickAt}` : ''})`
                : 'Connecting SmartAPI WebSocket...'}
            </span>
            {isLiveConnected && (
              <button
                type="button"
                onClick={onRefreshLivePrices}
                title="Refresh live quotes over WebSocket"
                className="hover:text-gray-900 dark:hover:text-white transition-colors ml-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 3. Main Terminal Command Strip */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-50 via-white to-blue-50/50 dark:from-gray-900 dark:via-gray-900/95 dark:to-blue-950/50 border border-gray-200 dark:border-gray-800 p-4 sm:p-5 shadow-sm dark:shadow-2xl backdrop-blur-xl transition-colors">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Terminal Title & Autonomous Badge */}
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-500/10 to-purple-500/10 dark:from-blue-600/30 dark:to-purple-600/30 border border-blue-200 dark:border-blue-500/40 text-blue-600 dark:text-blue-400 shadow-inner shrink-0">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <h1 className="text-lg sm:text-xl font-black text-gray-900 dark:text-white tracking-wide flex items-center gap-2">
                  <span>AI Trading Command Deck</span>
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 font-extrabold text-[10px] uppercase border border-blue-200 dark:border-blue-500/30 tracking-wider">
                  v2.0 SmartAPI
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 dark:bg-purple-500/20 text-purple-700 dark:text-purple-300 font-bold text-[10px] border border-purple-200 dark:border-purple-500/30">
                  {autoPilot.strategy.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                Autonomous Greek sniper scanner, real-time momentum traps & 1-click execution engine
              </p>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
            {/* Paper / Live Mode Switch (Strictly 2 Options) */}
            <div className="flex items-center bg-gray-100 dark:bg-gray-950 p-1 rounded-xl border border-gray-200 dark:border-gray-800 shadow-inner">
              <button
                type="button"
                onClick={() => onChangeAutoPilotMode('PAPER')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  autoPilot.mode === 'PAPER'
                    ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400/60 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Paper Trading simulation (Virtual Risk-Free Capital)"
              >
                Paper
              </button>
              <button
                type="button"
                onClick={() => onChangeAutoPilotMode('LIVE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  autoPilot.mode === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-400/60 shadow-xs'
                    : 'text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                }`}
                title="Live Broker orders on Angel One SmartAPI"
              >
                Live
              </button>
            </div>

            {/* Risk Appetite 1-Click Toggle */}
            <button
              type="button"
              onClick={() => {
                const current = autoPilot.riskTolerance || 'AGGRESSIVE';
                const next = current === 'AGGRESSIVE' ? 'BALANCED' : current === 'BALANCED' ? 'CONSERVATIVE' : 'AGGRESSIVE';
                if (onChangeRiskTolerance) {
                  onChangeRiskTolerance(next);
                }
              }}
              title="Click to cycle Risk Appetite (Aggressive ⇄ Balanced ⇄ Conservative)"
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                (autoPilot.riskTolerance || 'AGGRESSIVE') === 'AGGRESSIVE'
                  ? 'bg-orange-500/15 hover:bg-orange-500/25 text-orange-700 dark:text-orange-300 border-orange-400/50'
                  : (autoPilot.riskTolerance === 'BALANCED'
                    ? 'bg-blue-500/15 hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 border-blue-400/50'
                    : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-400/50')
              }`}
            >
              <Flame className={`w-3.5 h-3.5 ${
                (autoPilot.riskTolerance || 'AGGRESSIVE') === 'AGGRESSIVE' ? 'text-orange-500 animate-pulse' : 'text-gray-400'
              }`} />
              <span>
                {(autoPilot.riskTolerance || 'AGGRESSIVE') === 'AGGRESSIVE'
                  ? '🔥 Aggressive Risk'
                  : (autoPilot.riskTolerance === 'BALANCED'
                    ? '⚖️ Balanced'
                    : '🛡️ Conservative')}
              </span>
            </button>

            {/* Active Scanning Investment Slab Badge & Quick Click */}
            <button
              type="button"
              onClick={onOpenAutoPilotModal}
              title="Click to customize the active scanning investment slab amount"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border shadow-xs bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
            >
              <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>
                {autoPilot.maxBudgetPerTrade && autoPilot.maxBudgetPerTrade > 0
                  ? `Slab: ₹${autoPilot.maxBudgetPerTrade.toLocaleString('en-IN')}`
                  : 'Slab: Dynamic (No Cap)'}
              </span>
            </button>

            {/* Kill-Switch Warning & 1-Click Reset Pill if Tripped */}
            {autoPilot.killSwitchTripped && onResetKillSwitch && (
              <button
                type="button"
                onClick={onResetKillSwitch}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-500/20 hover:bg-rose-500/30 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-500/60 shadow-lg animate-pulse transition-all"
                title="Kill switch was activated due to daily loss limit. Click to reset session and re-arm Auto-Pilot."
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                <span>Kill-Switch Tripped • Click to Reset</span>
              </button>
            )}

            {/* Auto-Pilot Trigger Button */}
            <button
              type="button"
              onClick={onOpenAutoPilotModal}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border shadow-xs ${
                autoPilot.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 shadow-lg shadow-emerald-600/25 animate-pulse'
                  : 'bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Auto-Pilot: {autoPilot.enabled ? 'ACTIVE' : 'IDLE'}</span>
            </button>

            {/* AI Universe Button */}
            <button
              type="button"
              onClick={onOpenUniverseModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/50 dark:hover:bg-purple-900/60 text-purple-700 dark:text-purple-200 border border-purple-200 dark:border-purple-500/30 text-xs font-bold transition-all shadow-xs"
              title="Manage Dynamic AI Scanning Universe"
            >
              <Layers className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span>Universe ({universeCount > 0 ? universeCount : 'Dynamic'})</span>
            </button>

            {/* Scan Market Button */}
            <button
              type="button"
              onClick={onScanMarket}
              disabled={isScanning}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-blue-600/25 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Market'}</span>
            </button>
          </div>
        </div>

        {/* Live Auto-Pilot Engaged Glowing Strip */}
        {autoPilot.enabled && (
          <div className="mt-3.5 p-3 rounded-xl bg-emerald-50/90 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-500/40 text-emerald-900 dark:text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner transition-colors">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-600 dark:text-emerald-400 animate-bounce shrink-0" />
              <span>
                <strong>{activeStrategyName || autoPilot.strategy.replace('_', ' ')} Auto-Pilot Active:</strong> Target (+{autoPilot.profitTargetPct || 25}%), Stop-Loss (-{autoPilot.stopLossPct || 12}%), 25m Theta Timeout • Mode: <strong>{autoPilot.mode}</strong> • Slab: <strong className="text-emerald-600 dark:text-emerald-400 font-mono">{autoPilot.maxBudgetPerTrade && autoPilot.maxBudgetPerTrade > 0 ? `₹${autoPilot.maxBudgetPerTrade.toLocaleString('en-IN')}` : 'Dynamic'}</strong> • Risk: <strong className="text-orange-600 dark:text-orange-400">🔥 {autoPilot.riskTolerance || 'AGGRESSIVE'}</strong> ({autoPilot.executedToday || 0}/{autoPilot.maxDailyTrades || 5} trades filled).
              </span>
            </div>
            <button
              type="button"
              onClick={onPauseAutoPilot}
              className="text-xs text-rose-600 dark:text-rose-400 hover:underline font-bold shrink-0 transition-colors"
            >
              Pause Auto-Pilot
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AiTradingHeader;
