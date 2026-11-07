import React from 'react';
import {
  Bot,
  Zap,
  RefreshCw,
  Sliders,
  Layers,
  Columns,
  LayoutGrid,
  Radio,
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
  onOpenAutoPilotModal: () => void;
  onOpenUniverseModal: () => void;
  onScanMarket: () => void;
  onPauseAutoPilot: () => void;
  marketStatus?: MarketStatusInfo | null;
  layoutMode?: 'STUDIO' | 'TABS';
  onToggleLayoutMode?: (mode: 'STUDIO' | 'TABS') => void;
  activeStrategyName?: string;
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
  onOpenAutoPilotModal,
  onOpenUniverseModal,
  onScanMarket,
  onPauseAutoPilot,
  marketStatus,
  layoutMode = 'STUDIO',
  onToggleLayoutMode,
  activeStrategyName,
}) => {
  const isMarketOpen = marketStatus ? marketStatus.isOpen : false;

  return (
    <div className="space-y-3">
      {/* Top Market Status & Live Heartbeat Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-gray-900/90 dark:bg-gray-950/80 border border-gray-800 text-[11px] backdrop-blur-md">
        <div className="flex items-center space-x-2.5 flex-wrap gap-y-1">
          {/* Market Open / Closed Pill */}
          <div
            className={`flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full font-bold ${
              isMarketOpen
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                isMarketOpen ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="uppercase tracking-wider">
              {isMarketOpen ? 'NSE/BSE LIVE' : 'MARKET CLOSED'}
            </span>
          </div>

          {/* Session Timing / Next Session info */}
          <span className="text-gray-400 font-medium">
            {isMarketOpen
              ? `Session Closes: 03:30 PM IST (${marketStatus?.tradingHours || '09:15 – 15:30'})`
              : `Next Session: ${marketStatus?.nextSession || 'Mon 09:15 AM IST'}`}
          </span>

          {/* Real-time IST Clock */}
          <span className="text-gray-500 font-mono hidden sm:inline">
            • {marketStatus?.timeIST || 'IST'}
          </span>
        </div>

        {/* WebSocket Stream Live Telemetry */}
        <div className="flex items-center space-x-2 text-gray-400">
          <div
            className={`flex items-center space-x-1.5 px-2 py-0.5 rounded-lg border text-[11px] ${
              isLiveConnected
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                : 'bg-amber-950/40 text-amber-300 border-amber-500/30'
            }`}
          >
            <Radio className={`w-3 h-3 ${isLiveConnected ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
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
                className="hover:text-white transition-colors ml-1"
              >
                <RefreshCw className="w-2.5 h-2.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Terminal Command Strip */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900/95 to-blue-950/50 border border-gray-800 p-4 sm:p-5 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          {/* Terminal Title & Autonomous Badge */}
          <div className="flex items-center space-x-3.5">
            <div className="p-3 rounded-2xl bg-gradient-to-tr from-blue-600/30 to-purple-600/30 border border-blue-500/40 text-blue-400 shadow-inner">
              <Bot className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-wide flex items-center gap-2">
                  <span>AI Trading Command Deck</span>
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 font-extrabold text-[10px] uppercase border border-blue-500/30 tracking-wider">
                  v2.0 SmartAPI
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 font-bold text-[10px] border border-purple-500/30">
                  {autoPilot.strategy.replace('_', ' ')}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Autonomous Greek sniper scanner, real-time momentum traps & 1-click execution engine
              </p>
            </div>
          </div>

          {/* Quick Actions & Controls */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Paper / Live Broker Switch */}
            <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800">
              <button
                type="button"
                onClick={() => onChangeAutoPilotMode('PAPER')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  autoPilot.mode === 'PAPER'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Paper Mode
              </button>
              <button
                type="button"
                onClick={() => onChangeAutoPilotMode('LIVE')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                  autoPilot.mode === 'LIVE'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                Live Broker
              </button>
            </div>

            {/* Auto-Pilot Trigger Button */}
            <button
              type="button"
              onClick={onOpenAutoPilotModal}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                autoPilot.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-lg shadow-emerald-600/25 animate-pulse'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Auto-Pilot: {autoPilot.enabled ? 'ACTIVE' : 'IDLE'}</span>
            </button>

            {/* AI Universe Button */}
            <button
              type="button"
              onClick={onOpenUniverseModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-purple-950/50 hover:bg-purple-900/60 text-purple-200 border border-purple-500/30 text-xs font-bold transition-all"
              title="Manage Dynamic AI Scanning Universe"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
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

            {/* Studio vs Tabs Layout Toggle */}
            {onToggleLayoutMode && (
              <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-800 ml-1">
                <button
                  type="button"
                  onClick={() => onToggleLayoutMode('STUDIO')}
                  className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    layoutMode === 'STUDIO'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Studio Split View: Signals on Left, Live Chart on Right"
                >
                  <Columns className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Studio Deck</span>
                </button>
                <button
                  type="button"
                  onClick={() => onToggleLayoutMode('TABS')}
                  className={`flex items-center space-x-1 px-2.5 py-1 text-xs font-bold rounded-lg transition-all ${
                    layoutMode === 'TABS'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  title="Focus Tabs View: Full width single tab view"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tabs</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Live Auto-Pilot Engaged Glowing Strip */}
        {autoPilot.enabled && (
          <div className="mt-3.5 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
              <span>
                <strong>{activeStrategyName || autoPilot.strategy.replace('_', ' ')} Auto-Pilot Active:</strong> Target (+{autoPilot.profitTargetPct || 35}%), Stop-Loss (-{autoPilot.stopLossPct || 18}%), 45m Theta Timeout • Mode: <strong>{autoPilot.mode}</strong> ({autoPilot.executedToday || 0}/{autoPilot.maxDailyTrades || 5} trades filled).
              </span>
            </div>
            <button
              type="button"
              onClick={onPauseAutoPilot}
              className="text-xs text-rose-400 hover:text-rose-300 font-bold underline shrink-0 transition-colors"
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