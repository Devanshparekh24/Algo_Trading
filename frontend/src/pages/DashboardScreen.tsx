import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRight,
  ChevronRight,
  User,
  Zap,
  Briefcase,
  TrendingUp,
  TrendingDown,
  Flame,
  ShieldCheck,
  AlertTriangle,
  Database,
  RefreshCw,
  ExternalLink,
  Clock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Activity,
  Award,
  Trash2,
} from 'lucide-react';
import UserProfileCard from '../components/common/UserProfileCard';
import { useAppStore } from '../store';
import {
  fetchAiTradeLogs,
  fetchAiErrorLogs,
  clearAiErrorLogs,
  type AiTradeLogItem,
  type AiErrorLogItem,
} from '../services/aiTradingService';
import { getSocket } from '../services/socketService';
import { formatINR } from '../utils/formatters';

interface DashboardScreenProps {
  onNavigateToPortfolio?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToPortfolio }) => {
  const setActiveView = useAppStore((state) => state.setActiveView);

  // AI Logs State
  const [tradeLogs, setTradeLogs] = useState<AiTradeLogItem[]>([]);
  const [errorLogs, setErrorLogs] = useState<AiErrorLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [visibleTradeLimit, setVisibleTradeLimit] = useState<number>(5);

  const handleNavigatePositions = () => {
    if (onNavigateToPortfolio) {
      onNavigateToPortfolio();
    } else {
      setActiveView('positions');
    }
  };

  // Fetch Trade Logs from PostgreSQL
  const loadTradeLogs = useCallback(async () => {
    try {
      const logs = await fetchAiTradeLogs(30);
      setTradeLogs(logs || []);
    } catch (err) {
      console.warn('Dashboard: Failed to load AiTradeLogs:', err);
    }
  }, []);

  // Fetch Error Logs from PostgreSQL
  const loadErrorLogs = useCallback(async () => {
    try {
      const errs = await fetchAiErrorLogs(30);
      setErrorLogs(errs || []);
    } catch (err) {
      console.warn('Dashboard: Failed to load AiErrorLogs:', err);
    }
  }, []);

  // Refresh All Telemetry
  const handleRefreshTelemetry = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      await Promise.all([loadTradeLogs(), loadErrorLogs()]);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [loadTradeLogs, loadErrorLogs]);

  // Initial load
  useEffect(() => {
    handleRefreshTelemetry();
  }, [handleRefreshTelemetry]);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAutoTrade = () => {
      loadTradeLogs();
    };

    const onAutoExit = () => {
      loadTradeLogs();
    };

    const onTradeLogged = () => {
      loadTradeLogs();
    };

    const onErrorLogged = () => {
      loadErrorLogs();
    };

    const onErrorLogsCleared = () => {
      setErrorLogs([]);
    };

    socket.on('ai_auto_trade_executed', onAutoTrade);
    socket.on('ai_auto_exit_executed', onAutoExit);
    socket.on('ai_trade_logged', onTradeLogged);
    socket.on('ai_error_logged', onErrorLogged);
    socket.on('ai_error_logs_cleared', onErrorLogsCleared);

    return () => {
      socket.off('ai_auto_trade_executed', onAutoTrade);
      socket.off('ai_auto_exit_executed', onAutoExit);
      socket.off('ai_trade_logged', onTradeLogged);
      socket.off('ai_error_logged', onErrorLogged);
      socket.off('ai_error_logs_cleared', onErrorLogsCleared);
    };
  }, [loadTradeLogs, loadErrorLogs]);

  const handleClearErrors = async () => {
    try {
      await clearAiErrorLogs();
      setErrorLogs([]);
    } catch (err) {
      console.warn('Failed to clear error logs:', err);
    }
  };

  // Metric Computations
  const totalTrades = tradeLogs.length;
  const closedTrades = tradeLogs.filter((t) => t.status === 'EXITED');
  const openTrades = tradeLogs.filter((t) => t.status === 'OPEN');
  const realizedPnL = closedTrades.reduce((sum, t) => sum + (Number(t.pnl) || 0), 0);
  const winningTrades = closedTrades.filter((t) => (Number(t.pnl) || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const isOverallProfit = realizedPnL >= 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-white">
              Algorithmic Trading Workspace
            </span>
            <span className="px-3 py-1 bg-purple-500/30 backdrop-blur-md rounded-full text-xs font-semibold text-purple-100 flex items-center gap-1.5 border border-purple-300/30">
              <Zap className="w-3.5 h-3.5 text-amber-300" />
              <span>AI Auto-Pilot Active</span>
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-3">
            Welcome to Angel One SmartAPI Trading Console
          </h2>
          <p className="mt-2 text-sm text-blue-100 max-w-xl">
            Monitor real-time market positions, manage live strategy orders, and track your equity and F&O derivatives portfolio seamlessly.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setActiveView('ai-trading')}
            className="px-5 py-3 bg-purple-500/30 hover:bg-purple-500/40 text-white border border-purple-300/40 font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center space-x-2 flex-shrink-0"
          >
            <Zap className="w-4 h-4 text-amber-300" />
            <span>AI Sniper Suite</span>
          </button>
          <button
            onClick={handleNavigatePositions}
            className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 font-bold text-sm rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center justify-center space-x-2 flex-shrink-0"
          >
            <span>View Portfolio</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* AI OPERATIONS & TELEMETRY DECK (AiTradeLog & AiErrorLog) */}
      {/* ==================================================================== */}
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                AI Greek Sniper Operations & Telemetry
              </h3>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Live PostgreSQL database trade records (<code className="text-purple-600 dark:text-purple-400 font-mono">AiTradeLog</code>) and system exception telemetry (<code className="text-purple-600 dark:text-purple-400 font-mono">AiErrorLog</code>)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshTelemetry}
              disabled={isLoadingLogs}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/60 shadow-2xs transition-all flex items-center gap-1.5"
              title="Refresh AI logs from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-purple-500' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setActiveView('ai-trading')}
              className="px-3.5 py-2 text-xs font-semibold rounded-xl bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 hover:bg-purple-100 dark:hover:bg-purple-900/40 shadow-2xs transition-all flex items-center gap-1.5"
            >
              <span>Full Execution Book</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 4 Top Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total AI Trades */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Total Executions
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-gray-900 dark:text-white mt-2">
              {totalTrades}
            </div>
            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                ● {openTrades.length} Active
              </span>
              <span>•</span>
              <span className="font-mono">{closedTrades.length} Exited</span>
            </div>
          </div>

          {/* Card 2: Realized AI P&L */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Realized Net P&L
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isOverallProfit
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                }`}
              >
                {isOverallProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              </div>
            </div>
            <div
              className={`text-2xl font-black font-mono mt-2 ${
                isOverallProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isOverallProfit ? '+' : ''}{formatINR(realizedPnL)}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              Cumulative from {closedTrades.length} closed trades
            </div>
          </div>

          {/* Card 3: Win Rate */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                AI Win Rate
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black font-mono text-gray-900 dark:text-white mt-2">
              {winRate.toFixed(1)}%
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                {winningTrades.length} Win{winningTrades.length !== 1 ? 's' : ''}
              </span>{' '}
              / {closedTrades.length} closed ({closedTrades.length - winningTrades.length} losses)
            </div>
          </div>

          {/* Card 4: System & API Health */}
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                System & API Health
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  errorLogs.length === 0
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                }`}
              >
                {errorLogs.length === 0 ? <ShieldCheck className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              </div>
            </div>
            <div
              className={`text-2xl font-black mt-2 ${
                errorLogs.length === 0
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400 font-mono'
              }`}
            >
              {errorLogs.length === 0 ? 'Nominal' : `${errorLogs.length} Logged`}
            </div>
            <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  errorLogs.length === 0 ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span>{errorLogs.length === 0 ? 'Zero broker exceptions' : 'Check telemetry below'}</span>
            </div>
          </div>
        </div>

        {/* 2-Column Split: Recent Trade Executions & Error Telemetry */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Recent AI Trade Executions (AiTradeLog) - 7 cols */}
          <div className="lg:col-span-7 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700/70">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Recent AI Trade Executions
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    PostgreSQL <code className="font-mono text-purple-600 dark:text-purple-400">AiTradeLog</code> table
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                  {tradeLogs.length} total
                </span>
                <button
                  onClick={() => setActiveView('ai-trading')}
                  className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-semibold flex items-center gap-1"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {tradeLogs.length === 0 ? (
              <div className="text-center py-12 rounded-xl bg-gray-50 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-800">
                <Database className="w-10 h-10 text-gray-400 dark:text-gray-600 mx-auto mb-2" />
                <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">
                  No Database Trade Logs Found
                </h5>
                <p className="text-xs text-gray-500 dark:text-gray-400 max-w-sm mx-auto mt-1">
                  Trades executed by the Greek Momentum Sniper or Auto-Pilot will be permanently audited here with Greeks, entry/exit prices, and exit triggers.
                </p>
                <button
                  onClick={() => setActiveView('ai-trading')}
                  className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold rounded-xl shadow-sm transition-all inline-flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Launch AI Auto-Pilot</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {tradeLogs.slice(0, visibleTradeLimit).map((trade) => {
                  const isBuy = trade.action === 'BUY';
                  const isProfit = (Number(trade.pnl) || 0) >= 0;
                  const dateStr = new Date(trade.enteredAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={trade.id}
                      className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900/60 border border-gray-200 dark:border-gray-700/60 hover:border-purple-300 dark:hover:border-purple-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                isBuy
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {trade.action}
                            </span>
                            <span className="font-bold text-xs sm:text-sm text-gray-900 dark:text-white">
                              {trade.symbol}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-purple-100 dark:bg-purple-950 dark:text-purple-300 text-purple-800 font-mono">
                              {trade.strategy || 'GREEK_SNIPER'}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-mono">
                              {trade.mode}
                            </span>
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400 font-mono mt-0.5 flex items-center gap-2">
                            <span>ID: {trade.orderId}</span>
                            <span>•</span>
                            <span>{trade.quantity} qty ({trade.lots || 1} lot)</span>
                            <span>•</span>
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              <span>{dateStr}</span>
                            </span>
                          </div>
                        </div>

                        {/* P&L Badge */}
                        <div className="text-right shrink-0">
                          {trade.pnl !== null && trade.pnl !== undefined ? (
                            <div>
                              <div
                                className={`text-xs sm:text-sm font-bold font-mono ${
                                  isProfit
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isProfit ? '+' : ''}₹{Number(trade.pnl).toLocaleString('en-IN')}
                              </div>
                              {trade.pnlPercent !== null && trade.pnlPercent !== undefined && (
                                <div
                                  className={`text-[10px] font-semibold font-mono ${
                                    isProfit
                                      ? 'text-emerald-600 dark:text-emerald-400'
                                      : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isProfit ? '+' : ''}{trade.pnlPercent}%
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300 animate-pulse">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Entry / Exit & Greeks Bar */}
                      <div className="flex items-center justify-between text-[11px] pt-1.5 border-t border-gray-200/60 dark:border-gray-800/80">
                        <div className="flex items-center gap-3 font-mono text-gray-700 dark:text-gray-300">
                          <span>
                            Entry: <strong className="text-gray-900 dark:text-white">₹{trade.entryPrice}</strong>
                          </span>
                          <span>
                            Exit: <strong className="text-gray-900 dark:text-white">{trade.exitPrice ? `₹${trade.exitPrice}` : 'Open'}</strong>
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* Greek Snapshot if present */}
                          {trade.delta !== null && trade.delta !== undefined && (
                            <div className="hidden sm:flex items-center gap-1.5 text-[10px] font-mono text-gray-500 dark:text-gray-400">
                              <span className="text-emerald-600 dark:text-emerald-400">Δ{trade.delta.toFixed(2)}</span>
                              <span className="text-blue-600 dark:text-blue-400">Γ{trade.gamma?.toFixed(3) || '0'}</span>
                              <span className="text-rose-600 dark:text-rose-400">Θ{trade.theta?.toFixed(1) || '0'}</span>
                            </div>
                          )}

                          {/* Status / Exit Reason Pill */}
                          <span
                            className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                              trade.status === 'OPEN'
                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                                : trade.exitReason === 'TARGET'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : trade.exitReason === 'STOP_LOSS'
                                ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                : trade.exitReason === 'THETA_TIMEOUT'
                                ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {trade.status === 'OPEN'
                              ? 'Active'
                              : trade.exitReason === 'TARGET'
                              ? 'Target (+50%)'
                              : trade.exitReason === 'STOP_LOSS'
                              ? 'Stop-Loss (-22%)'
                              : trade.exitReason === 'THETA_TIMEOUT'
                              ? 'Theta Timeout (45m)'
                              : trade.exitReason || 'Exited'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {tradeLogs.length > 5 && (
                  <div className="pt-2 flex justify-between items-center text-xs">
                    {visibleTradeLimit < tradeLogs.length ? (
                      <button
                        onClick={() => setVisibleTradeLimit((prev) => Math.min(prev + 5, tradeLogs.length))}
                        className="text-purple-600 dark:text-purple-400 hover:underline font-semibold"
                      >
                        Show 5 More ({tradeLogs.length - visibleTradeLimit} remaining)
                      </button>
                    ) : (
                      <button
                        onClick={() => setVisibleTradeLimit(5)}
                        className="text-gray-500 hover:underline font-semibold"
                      >
                        Show Less
                      </button>
                    )}

                    <button
                      onClick={() => setActiveView('ai-trading')}
                      className="text-gray-600 dark:text-gray-300 hover:text-purple-600 dark:hover:text-purple-400 font-semibold inline-flex items-center gap-1"
                    >
                      <span>Execution Book Archive</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: AI Engine & SmartAPI Error Telemetry (AiErrorLog) - 5 cols */}
          <div className="lg:col-span-5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-gray-700/70">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    errorLogs.length === 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {errorLogs.length === 0 ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                    Engine & Error Telemetry
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    PostgreSQL <code className="font-mono text-purple-600 dark:text-purple-400">AiErrorLog</code> table
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {errorLogs.length > 0 && (
                  <button
                    onClick={handleClearErrors}
                    title="Clear resolved error telemetry"
                    className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    errorLogs.length === 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {errorLogs.length === 0 ? 'All Systems Nominal' : `${errorLogs.length} Exceptions`}
                </span>
              </div>
            </div>

            {errorLogs.length === 0 ? (
              <div className="p-6 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/40 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 dark:text-emerald-400 mx-auto" />
                <div>
                  <h5 className="font-bold text-sm text-emerald-950 dark:text-emerald-200">
                    All Systems Operational
                  </h5>
                  <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80 max-w-xs mx-auto mt-1 leading-relaxed">
                    Zero SmartAPI, rate limit, or Auto-Pilot order placement errors recorded.
                  </p>
                </div>

                <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 grid grid-cols-2 gap-2 text-left text-[11px]">
                  <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-900/60 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Session Guard</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">JWT Nominal</span>
                  </div>
                  <div className="p-2 rounded-lg bg-white/70 dark:bg-gray-900/60 border border-emerald-100 dark:border-emerald-900/40">
                    <span className="text-gray-500 dark:text-gray-400 block text-[10px]">Auto-Pilot Engine</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Ready</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[460px] overflow-y-auto pr-1">
                {errorLogs.slice(0, 6).map((err) => {
                  const isExpanded = expandedErrorId === err.id;
                  const timeStr = new Date(err.createdAt).toLocaleTimeString('en-IN');

                  return (
                    <div
                      key={err.id}
                      className="p-3.5 rounded-xl bg-rose-50/40 dark:bg-gray-900/60 border border-rose-200 dark:border-rose-500/20 hover:border-rose-400 dark:hover:border-rose-500/40 transition-all space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-rose-500 dark:text-rose-400 mt-0.5 shrink-0" />
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-mono">
                                {err.source}
                              </span>
                              {err.action && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono">
                                  {err.action}
                                </span>
                              )}
                              {err.symbol && (
                                <span className="text-[11px] font-bold text-gray-900 dark:text-white">
                                  {err.symbol}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 font-sans font-medium line-clamp-2">
                              {err.message}
                            </p>
                          </div>
                        </div>

                        <span className="text-[10px] text-gray-500 font-mono shrink-0">
                          {timeStr}
                        </span>
                      </div>

                      {/* Expandable Technical Details */}
                      {(err.details || err.stack) && (
                        <div>
                          <button
                            onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                            className="text-[11px] text-rose-600 dark:text-rose-400 hover:underline font-semibold flex items-center gap-1"
                          >
                            <span>{isExpanded ? 'Hide Details' : 'View Payload & Stack'}</span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 p-2.5 rounded-lg bg-gray-950 text-gray-300 font-mono text-[10px] overflow-x-auto space-y-1">
                              {err.details && (
                                <div>
                                  <span className="text-gray-500 block">Payload:</span>
                                  <pre className="text-emerald-400 whitespace-pre-wrap">
                                    {typeof err.details === 'object' ? JSON.stringify(err.details, null, 2) : String(err.details)}
                                  </pre>
                                </div>
                              )}
                              {err.stack && (
                                <div className="mt-1 pt-1 border-t border-gray-800">
                                  <span className="text-gray-500 block">Stack:</span>
                                  <pre className="text-rose-400 whitespace-pre-wrap">{err.stack}</pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grid: Quick Actions & Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* User Profile Overview */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <User className="w-5 h-5 text-blue-600" />
            <span>Connected User Account</span>
          </h3>
          <UserProfileCard />
        </div>

        {/* Quick Links Card */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Direct Navigation & Features</span>
          </h3>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div
              onClick={handleNavigatePositions}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Portfolio Positions & Holdings
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Track open positions, P&L, M2M, and delivery holdings
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('ai-trading')}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-purple-50 dark:hover:bg-purple-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400">
                        Greek Momentum Sniper
                      </h4>
                      <span className="text-[10px] px-2 py-0.2 bg-purple-100 dark:bg-purple-900/60 text-purple-700 dark:text-purple-300 font-bold rounded-full">
                        AI Auto-Pilot
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Strike Greek filters (Delta, Gamma, Theta), Golden Hours, and automated +50% target exits
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('fno')}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                        Top Volatile F&O Movers
                      </h4>
                      <span className="text-[10px] px-2 py-0.2 bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold rounded-full">
                        Live
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Futures, Call (CE) & Put (PE) high-swing derivatives
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('markets')}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                      Live Markets & Indices
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Track Nifty, Sensex & BankNifty live market streams
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 group-hover:translate-x-1 transition-all" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
