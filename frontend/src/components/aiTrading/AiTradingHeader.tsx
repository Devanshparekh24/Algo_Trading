import React from 'react';
import {
  Bot,
  Zap,
  RefreshCw,
  Sliders,
  Layers,
} from 'lucide-react';
import type { AutoPilotConfig } from '../../services/aiTradingService';

interface AiTradingHeaderProps {
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
}) => {
  return (
    <div className="space-y-3">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-indigo-950/40 border border-blue-500/30 p-5 md:p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Title & Description */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-2.5">
              <span className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30 shadow-inner">
                <Bot className="w-5 h-5 md:w-6 md:h-6 animate-pulse" />
              </span>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                  AI Trading Terminal
                </h1>
                <span className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30 uppercase tracking-wider">
                  v2.0 SmartAPI
                </span>
              </div>
            </div>
            <p className="text-xs md:text-sm text-gray-300 max-w-2xl leading-relaxed">
              Autonomous multi-factor technical analysis, high-probability trade signals, and 1-click Angel One order execution.
            </p>
          </div>

          {/* Quick Actions & Live Feed Badge */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Live Socket Feed Pill */}
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                isLiveConnected
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300 shadow-sm'
                  : 'bg-amber-950/60 border-amber-500/40 text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span className="truncate max-w-[200px] sm:max-w-none">
                {isLiveConnected
                  ? `Live WebSocket Active (${totalTicksReceived} ticks${lastTickAt ? ` • ${lastTickAt}` : ''})`
                  : 'Connecting WebSocket...'}
              </span>
              {isLiveConnected && (
                <button
                  type="button"
                  onClick={onRefreshLivePrices}
                  title="Force refresh live quotes over WebSocket"
                  className="p-1 rounded-md text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all ml-0.5"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Trading Mode Switcher: Paper vs Live */}
            <div className="flex items-center bg-gray-950/80 p-1 rounded-xl border border-gray-800">
              <button
                type="button"
                onClick={() => onChangeAutoPilotMode('PAPER')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  autoPilot.mode === 'PAPER'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Paper Mode
              </button>
              <button
                type="button"
                onClick={() => onChangeAutoPilotMode('LIVE')}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  autoPilot.mode === 'LIVE'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Live Broker
              </button>
            </div>

            {/* Auto-Pilot Trigger Button */}
            <button
              type="button"
              onClick={onOpenAutoPilotModal}
              className={`flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                autoPilot.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow-emerald-500/20 animate-pulse'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-700'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Auto-Pilot: {autoPilot.enabled ? 'ACTIVE' : 'OFF'}</span>
            </button>

            {/* Dynamic Scanning Universe Button */}
            <button
              type="button"
              onClick={onOpenUniverseModal}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shadow-sm"
              title="Manage Dynamic AI Scanning Universe"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>AI Universe ({universeCount > 0 ? universeCount : 'Dynamic'})</span>
            </button>

            {/* Market Scan Button */}
            <button
              type="button"
              onClick={onScanMarket}
              disabled={isScanning}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md shadow-blue-600/20 disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Market'}</span>
            </button>
          </div>
        </div>

        {/* Live Auto-Pilot Glowing Indicator Banner if Enabled */}
        {autoPilot.enabled && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-inner">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400 animate-bounce shrink-0" />
              <span>
                <strong>Auto-Pilot Engaged:</strong> Auto-executing signals with confidence &ge; {autoPilot.minConfidence}% in <strong>{autoPilot.mode}</strong> mode ({autoPilot.executedToday}/{autoPilot.maxDailyTrades} trades filled today).
              </span>
            </div>
            <button
              type="button"
              onClick={onPauseAutoPilot}
              className="text-xs text-rose-300 hover:underline font-medium shrink-0"
            >
              Pause Auto-Pilot
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

