import React, { useState } from 'react';
import {
  Calendar,
  Clock,
  Zap,
  Flame,
  TrendingDown,
  Sun,
  BarChart3,
  Target,
  Shield,
  X,
  Database,
  Loader2,
} from 'lucide-react';
import type {
  StrategyScheduleRecord,
  LiveStrategySuggestion,
  AutoPilotStrategy,
} from '../../services/aiTradingService';

interface AiStrategyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  liveSuggestion: LiveStrategySuggestion | null;
  schedules: StrategyScheduleRecord[];
  historyLogs: any[];
  onArmStrategy: (strategy: AutoPilotStrategy, budget?: number, targetPct?: number, slPct?: number) => void;
  isLoading?: boolean;
}

const STRATEGY_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  ORB_15M: Sun,
  VWAP_TRAP: TrendingDown,
  GAMMA_BLAST: Flame,
  GREEK_SNIPER: Zap,
  PCR_REVERSAL: BarChart3,
  STANDARD: Target,
};

export const AiStrategyScheduleModal: React.FC<AiStrategyScheduleModalProps> = ({
  isOpen,
  onClose,
  liveSuggestion,
  schedules,
  historyLogs,
  onArmStrategy,
  isLoading = false,
}) => {
  const [activeTab, setActiveTab] = useState<'TIMETABLE' | 'LOGS'>('TIMETABLE');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-5xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-800 flex items-center justify-between shrink-0 bg-gray-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-3 bg-gradient-to-tr from-amber-500/20 to-orange-500/20 border border-amber-500/30 rounded-2xl text-amber-400">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black text-white tracking-wide">
                  F&O Strategy Timetable & AI Schedule
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 tracking-wider">
                  IST Market Clock
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Targeted timing windows, expiry index rotation & backend database execution logs
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-xl hover:bg-gray-800/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Recommendation Ribbon */}
        {liveSuggestion && (
          <div className="px-6 py-4 bg-gradient-to-r from-blue-950/40 via-purple-950/30 to-gray-900/60 border-b border-gray-800 shrink-0">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    {liveSuggestion.badge}
                  </span>
                  <span className="text-xs font-semibold text-gray-300">
                    {liveSuggestion.timeWindowLabel}
                  </span>
                  <span className="text-xs text-blue-400 font-medium">
                    • {liveSuggestion.expiryIndexToday}
                  </span>
                </div>
                <div className="flex items-baseline space-x-2">
                  <h3 className="text-base font-bold text-white flex items-center gap-1.5">
                    <span>{liveSuggestion.strategyName}</span>
                  </h3>
                  <span className="text-xs text-gray-400">
                    ({liveSuggestion.reason})
                  </span>
                </div>
                <div className="flex items-center space-x-4 text-xs text-gray-300 pt-0.5 flex-wrap gap-y-1">
                  <span>
                    Sizing Mode: <strong className="text-emerald-400 font-mono">Dynamic (No Fixed Price Limit)</strong>
                  </span>
                  <span>
                    Target: <strong className="text-emerald-400 font-mono">+{liveSuggestion.targetProfitPct}%</strong>
                  </span>
                  <span>
                    Stop-Loss: <strong className="text-rose-400 font-mono">-{liveSuggestion.stopLossPct}%</strong>
                  </span>
                  <span className="text-[11px] text-gray-500 font-mono">
                    IST: {liveSuggestion.dateTime}
                  </span>
                </div>
              </div>

              <div className="shrink-0 flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    onArmStrategy(
                      liveSuggestion.recommendedStrategy,
                      0,
                      liveSuggestion.targetProfitPct,
                      liveSuggestion.stopLossPct
                    );
                    onClose();
                  }}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-950 font-bold text-xs shadow-lg shadow-amber-500/20 flex items-center space-x-1.5 transition-all transform active:scale-95"
                >
                  <Zap className="w-4 h-4 fill-current" />
                  <span>Arm Live Strategy (Dynamic Lots)</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab Switcher */}
        <div className="px-6 pt-4 pb-2 border-b border-gray-800 bg-gray-950/40 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setActiveTab('TIMETABLE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'TIMETABLE'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white bg-gray-800/40'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Strategy Timetable ({schedules.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('LOGS')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                activeTab === 'LOGS'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-gray-400 hover:text-white bg-gray-800/40'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database Timestamp Logs ({historyLogs.length})</span>
            </button>
          </div>
          <div className="flex items-center space-x-2">
            {isLoading && (
              <span className="flex items-center space-x-1 text-[11px] text-amber-400">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>Syncing IST...</span>
              </span>
            )}
            <span className="text-[11px] text-gray-500">
              Stored in PostgreSQL table: <code className="text-gray-400 font-mono">AiStrategySchedule</code>
            </span>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {activeTab === 'TIMETABLE' ? (
            <div className="space-y-4">
              <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/50">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-900/90 text-gray-400 font-semibold border-b border-gray-800 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="py-3 px-4">Strategy & Focus</th>
                      <th className="py-3 px-4">IST Time Window</th>
                      <th className="py-3 px-4">Active Days</th>
                      <th className="py-3 px-4">Market Condition</th>
                      <th className="py-3 px-4">Target / SL</th>
                      <th className="py-3 px-4">Trade Sizing</th>
                      <th className="py-3 px-4 text-center">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/60 font-medium text-gray-300">
                    {schedules.map((item) => {
                      const Icon = STRATEGY_ICON_MAP[item.strategy] || Target;
                      const isActive = item.isActiveNow;
                      return (
                        <tr
                          key={item.strategy}
                          className={`hover:bg-gray-800/30 transition-colors ${
                            isActive ? 'bg-blue-950/20' : ''
                          }`}
                        >
                          <td className="py-3.5 px-4">
                            <div className="flex items-center space-x-2.5">
                              <div
                                className={`p-2 rounded-xl shrink-0 ${
                                  isActive
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-gray-800 text-gray-400'
                                }`}
                              >
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-bold text-white flex items-center space-x-1.5">
                                  <span>{item.name}</span>
                                </div>
                                <span className="text-[10px] text-gray-400">
                                  {item.badge}
                                </span>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono text-gray-200">
                            <div className="flex items-center space-x-1.5">
                              <Clock className="w-3.5 h-3.5 text-gray-500 shrink-0" />
                              <span>{item.timeLabel}</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-gray-300">
                            <div>{item.daysActive}</div>
                            <span className="text-[10px] text-amber-400/90 font-medium">
                              {item.bestDays}
                            </span>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs text-gray-400 text-[11px] leading-relaxed">
                            {item.marketCondition}
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="text-emerald-400 font-bold">+{item.targetProfitPct}%</span>
                            <span className="text-gray-500 mx-1">/</span>
                            <span className="text-rose-400 font-bold">-{item.stopLossPct}%</span>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <span className="text-emerald-400 font-bold block text-xs">Dynamic (By Lots)</span>
                            <span className="text-[10px] text-gray-400 font-sans">Market Price (No Cap)</span>
                          </td>

                          <td className="py-3.5 px-4 text-center">
                            {isActive ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse">
                                🟢 ACTIVE NOW
                              </span>
                            ) : item.status === 'UPCOMING' ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                ⏳ UPCOMING
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-800 text-gray-400">
                                ⚪ PAST WINDOW
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                onArmStrategy(
                                  item.strategy,
                                  0,
                                  item.targetProfitPct,
                                  item.stopLossPct
                                );
                                onClose();
                              }}
                              className={`px-3 py-1.5 rounded-xl font-bold text-xs transition-all flex items-center space-x-1 ml-auto ${
                                isActive
                                  ? 'bg-amber-500 hover:bg-amber-400 text-gray-950 shadow-md shadow-amber-500/20'
                                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border border-gray-700'
                              }`}
                            >
                              <Zap className="w-3.5 h-3.5" />
                              <span>Arm</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Strategy Rules Reference Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 pt-2">
                <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800/80 space-y-1.5">
                  <div className="flex items-center space-x-2 text-amber-400 font-bold text-xs">
                    <Sun className="w-4 h-4" />
                    <span>09:30 AM – 11:00 AM • 15-Min ORB</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    First 15-min candle forms initial high & low. High-volume breakout signals clean institutional trend continuation with tight 18% SL.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800/80 space-y-1.5">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold text-xs">
                    <TrendingDown className="w-4 h-4" />
                    <span>11:00 AM – 01:15 PM • VWAP Trap</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Catches midday false breakouts when retail traders get trapped outside Bollinger Bands. Quick counter-trend mean reversion scalps.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-gray-950 border border-gray-800/80 space-y-1.5">
                  <div className="flex items-center space-x-2 text-purple-400 font-bold text-xs">
                    <Flame className="w-4 h-4" />
                    <span>01:15 PM – 02:45 PM • Gamma Blast</span>
                  </div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Expiry day option squeeze window. Buys low premium (₹15–₹45) near-the-money options when writers cover, yielding 50%+ rapid expansions.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            /* Database Timestamp Logs View */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                    <Database className="w-4 h-4 text-emerald-400" />
                    <span>PostgreSQL Table: AiStrategySchedule</span>
                  </h4>
                  <p className="text-xs text-gray-400">
                    Real-time execution events, recommendations, and strategy arming events with ISO date and time stamps.
                  </p>
                </div>
              </div>

              {historyLogs.length === 0 ? (
                <div className="p-12 text-center border border-dashed border-gray-800 rounded-2xl bg-gray-950/40 text-gray-400 space-y-2">
                  <Database className="w-8 h-8 text-gray-600 mx-auto" />
                  <p className="text-xs font-semibold">No strategy schedule events recorded yet</p>
                  <p className="text-[11px] text-gray-500">
                    Events will be logged automatically to the database whenever a strategy window triggers or an auto-pilot strategy is armed.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-950/50">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-gray-900/90 text-gray-400 font-semibold border-b border-gray-800 uppercase tracking-wider text-[11px]">
                      <tr>
                        <th className="py-3 px-4">Date & Time</th>
                        <th className="py-3 px-4">Strategy</th>
                        <th className="py-3 px-4">Time Window</th>
                        <th className="py-3 px-4">Days Active</th>
                        <th className="py-3 px-4">Sizing Policy</th>
                        <th className="py-3 px-4">Market Condition</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800/60 font-mono text-gray-300">
                      {historyLogs.map((log) => (
                        <tr key={log.id} className="hover:bg-gray-800/30 transition-colors">
                          <td className="py-3 px-4 text-amber-300 font-semibold text-[11px]">
                            {log.dateTime ? new Date(log.dateTime).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-'}
                          </td>
                          <td className="py-3 px-4 font-sans font-bold text-white">
                            {log.name || log.strategy}
                          </td>
                          <td className="py-3 px-4 text-gray-400">
                            {log.startTime} – {log.endTime}
                          </td>
                          <td className="py-3 px-4 font-sans text-gray-300">
                            {log.daysActive || 'Mon – Fri'}
                          </td>
                          <td className="py-3 px-4 text-emerald-400 font-bold">
                            {Number(log.suggestedBudget) > 0 ? `Cap: ₹${Number(log.suggestedBudget).toLocaleString('en-IN')}` : 'Dynamic (By Lots)'}
                          </td>
                          <td className="py-3 px-4 font-sans text-gray-400 text-[11px] max-w-xs truncate">
                            {log.marketCondition || log.description || 'Active Window Execution'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-gray-800 bg-gray-950 flex items-center justify-between text-xs text-gray-400 shrink-0">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <span>Dynamic Market Sizing: Option strikes are selected strictly by Greek momentum & OI, not restricted by a fixed price ceiling.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
