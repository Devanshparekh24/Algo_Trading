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
  Bot,
  Wallet,
  FileText,
} from 'lucide-react';
import UserProfileCard from '../components/common/UserProfileCard';
import { useAppStore } from '../store';
import {
  fetchAiTradeLogs,
  fetchAiAnalysisLogs,
  fetchAiErrorLogs,
  clearAiErrorLogs,
  resetAutoPilotKillSwitch,
  fetchActivePositions,
  type AiTradeLogItem,
  type AiAnalysisLogItem,
  type AiErrorLogItem,
  type ActiveAiPosition,
} from '../services/aiTradingService';
import { getSocket } from '../services/socketService';
import { formatINR } from '../utils/formatters';

interface DashboardScreenProps {
  onNavigateToPortfolio?: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToPortfolio }) => {
  const setActiveView = useAppStore((state) => state.setActiveView);

  // AI Logs & Active Positions State
  const [logTab, setLogTab] = useState<'TRADES' | 'ANALYSIS'>('TRADES');
  const [tradeLogs, setTradeLogs] = useState<AiTradeLogItem[]>([]);
  const [analysisLogs, setAnalysisLogs] = useState<AiAnalysisLogItem[]>([]);
  const [activePositions, setActivePositions] = useState<ActiveAiPosition[]>([]);
  const [errorLogs, setErrorLogs] = useState<AiErrorLogItem[]>([]);
  const [isLoadingLogs, setIsLoadingLogs] = useState<boolean>(false);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [visibleTradeLimit, setVisibleTradeLimit] = useState<number>(5);
  const [errorFilter, setErrorFilter] = useState<'ALL' | 'EXCEPTIONS' | 'STATUS'>('ALL');

  const handleNavigatePositions = () => {
    if (onNavigateToPortfolio) {
      onNavigateToPortfolio();
    } else {
      setActiveView('positions');
    }
  };

  // Fetch Trade Logs from PostgreSQL (BUY/SELL Executions)
  const loadTradeLogs = useCallback(async () => {
    try {
      const logs = await fetchAiTradeLogs(50);
      setTradeLogs(logs || []);
    } catch (err) {
      console.warn('Dashboard: Failed to load AiTradeLogs:', err);
    }
  }, []);

  // Fetch Analysis Logs from PostgreSQL (Market Evaluations)
  const loadAnalysisLogs = useCallback(async () => {
    try {
      const logs = await fetchAiAnalysisLogs(50);
      setAnalysisLogs(logs || []);
    } catch (err) {
      console.warn('Dashboard: Failed to load AiAnalysisLogs:', err);
    }
  }, []);

  // Fetch Active AI Positions (Live Open Positions)
  const loadActivePositions = useCallback(async () => {
    try {
      const pos = await fetchActivePositions();
      setActivePositions(pos || []);
    } catch (err) {
      console.warn('Dashboard: Failed to load active positions:', err);
    }
  }, []);

  // Fetch Error Logs from PostgreSQL
  const loadErrorLogs = useCallback(async () => {
    try {
      const errs = await fetchAiErrorLogs(50);
      setErrorLogs(errs || []);
    } catch (err) {
      console.warn('Dashboard: Failed to load AiErrorLogs:', err);
    }
  }, []);

  // Refresh All Telemetry
  const handleRefreshTelemetry = useCallback(async () => {
    setIsLoadingLogs(true);
    try {
      await Promise.all([loadTradeLogs(), loadAnalysisLogs(), loadActivePositions(), loadErrorLogs()]);
    } finally {
      setIsLoadingLogs(false);
    }
  }, [loadTradeLogs, loadAnalysisLogs, loadActivePositions, loadErrorLogs]);

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
      loadActivePositions();
    };

    const onAutoExit = () => {
      loadTradeLogs();
      loadActivePositions();
    };

    const onTradeLogged = () => {
      loadTradeLogs();
    };

    const onAnalysisLogged = () => {
      loadAnalysisLogs();
    };

    const onPositionsUpdate = (positions: ActiveAiPosition[]) => {
      if (Array.isArray(positions)) {
        setActivePositions(positions);
      }
    };

    const onErrorLogged = () => {
      loadErrorLogs();
    };

    const onErrorLogsCleared = () => {
      setErrorLogs([]);
    };

    socket.on('ai_positions_update', onPositionsUpdate);
    socket.on('ai_position_opened', loadActivePositions);
    socket.on('ai_auto_trade_executed', onAutoTrade);
    socket.on('ai_auto_exit_executed', onAutoExit);
    socket.on('ai_trade_logged', onTradeLogged);
    socket.on('ai_analysis_logged', onAnalysisLogged);
    socket.on('ai_analysis_logs_cleared', () => setAnalysisLogs([]));
    socket.on('ai_error_logged', onErrorLogged);
    socket.on('ai_error_logs_cleared', onErrorLogsCleared);
    socket.on('ai_audit_event_logged', onErrorLogged);
    socket.on('ai_autopilot_status_changed', onErrorLogged);
    socket.on('ai_scanner_activity', onErrorLogged);

    return () => {
      socket.off('ai_positions_update', onPositionsUpdate);
      socket.off('ai_position_opened', loadActivePositions);
      socket.off('ai_auto_trade_executed', onAutoTrade);
      socket.off('ai_auto_exit_executed', onAutoExit);
      socket.off('ai_trade_logged', onTradeLogged);
      socket.off('ai_analysis_logged', onAnalysisLogged);
      socket.off('ai_error_logged', onErrorLogged);
      socket.off('ai_error_logs_cleared', onErrorLogsCleared);
      socket.off('ai_audit_event_logged', onErrorLogged);
      socket.off('ai_autopilot_status_changed', onErrorLogged);
      socket.off('ai_scanner_activity', onErrorLogged);
    };
  }, [loadTradeLogs, loadAnalysisLogs, loadActivePositions, loadErrorLogs]);

  const handleClearErrors = async () => {
    try {
      await clearAiErrorLogs();
      setErrorLogs([]);
    } catch (err) {
      console.warn('Failed to clear error logs:', err);
    }
  };

  // Metric Computations
  const isClosed = (status?: string) => {
    const s = status?.toUpperCase();
    return s === 'EXITED' || s === 'CLOSED';
  };
  const isOpen = (status?: string) => {
    const s = status?.toUpperCase();
    return s === 'OPEN';
  };

  // Dashboard Telemetry Mode Filter
  const [dashboardModeFilter, setDashboardModeFilter] = useState<'ALL' | 'PAPER' | 'LIVE'>('ALL');

  // Filter trades and active positions by dashboardModeFilter
  const relevantTradeLogs = tradeLogs.filter((t) => {
    if (dashboardModeFilter === 'ALL') return true;
    return t.mode === dashboardModeFilter;
  });
  const relevantActivePositions = activePositions.filter((p) => {
    if (dashboardModeFilter === 'ALL') return true;
    return p.mode === dashboardModeFilter;
  });

  const totalTrades = relevantTradeLogs.length;
  const closedTrades = relevantTradeLogs.filter((t) => isClosed(t.status));
  const openTrades = relevantTradeLogs.filter((t) => isOpen(t.status));

  // Cumulative Realized Net P&L (strictly from exited/closed trades)
  const realizedPnL = closedTrades.reduce((sum, t) => sum + (Number(t.netPnl ?? t.pnl) || 0), 0);
  const winningTrades = closedTrades.filter((t) => (Number(t.netPnl ?? t.pnl) || 0) > 0);
  const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
  const isOverallProfit = realizedPnL > 0;
  const isNeutral = realizedPnL === 0;

  // Active / Unrealized Live P&L from open active positions
  const openPositionsCount = relevantActivePositions.filter((p) => p.status === 'OPEN').length;
  const unrealizedPnL = relevantActivePositions
    .filter((p) => p.status === 'OPEN')
    .reduce((sum, p) => sum + (Number(p.netPnl ?? p.pnl) || 0), 0);

  // Breakdown metrics for BOTH mode
  const paperClosedTrades = tradeLogs.filter((t) => isClosed(t.status) && t.mode === 'PAPER');
  const liveClosedTrades = tradeLogs.filter((t) => isClosed(t.status) && t.mode === 'LIVE');
  const paperRealizedPnL = paperClosedTrades.reduce((sum, t) => sum + (Number(t.netPnl ?? t.pnl) || 0), 0);
  const liveRealizedPnL = liveClosedTrades.reduce((sum, t) => sum + (Number(t.netPnl ?? t.pnl) || 0), 0);
  const paperOpenCount = activePositions.filter((p) => p.status === 'OPEN' && p.mode === 'PAPER').length;
  const liveOpenCount = activePositions.filter((p) => p.status === 'OPEN' && p.mode === 'LIVE').length;

  // Categorize Error / Telemetry Logs
  const isAuditLog = (err: AiErrorLogItem) =>
    err.source === 'AUTOPILOT_STATUS' ||
    err.source === 'SCANNER' ||
    err.action === 'ORDER_EXECUTED' ||
    err.action === 'SLAB_CONFIG_UPDATED' ||
    err.action === 'SLAB_EXCEEDED' ||
    err.action === 'AUTOPILOT_ENABLED' ||
    err.action === 'AUTOPILOT_DISABLED';

  const actualExceptions = errorLogs.filter((err) => !isAuditLog(err));
  const auditLogs = errorLogs.filter(isAuditLog);

  const displayedLogs = errorLogs.filter((err) => {
    if (errorFilter === 'EXCEPTIONS') return !isAuditLog(err);
    if (errorFilter === 'STATUS') return isAuditLog(err);
    return true;
  });

  return (
    <div className="space-y-8 mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-7xl font-sans">
      {/* ==================================================================== */}
      {/* AI OPERATIONS & TELEMETRY DECK (AiTradeLog & AiErrorLog) */}
      {/* ==================================================================== */}
      <div className="space-y-5">
        <div className="flex sm:flex-row flex-col justify-between sm:items-center gap-4">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex justify-center items-center bg-purple-100 dark:bg-purple-900/40 rounded-xl w-9 h-9 text-purple-600 dark:text-purple-400">
                <Activity className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white text-xl">
                AI Greek Sniper Operations & Telemetry
              </h3>
            </div>
            <p className="mt-1 text-gray-500 dark:text-gray-400 text-xs">
              Live PostgreSQL database trade records (<code className="font-mono text-purple-600 dark:text-purple-400">AiTradeLog</code>) and system exception telemetry (<code className="font-mono text-purple-600 dark:text-purple-400">AiErrorLog</code>)
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleRefreshTelemetry}
              disabled={isLoadingLogs}
              className="flex items-center gap-1.5 bg-white hover:bg-gray-50 dark:bg-gray-800 dark:hover:bg-gray-700/60 shadow-2xs px-3.5 py-2 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-700 dark:text-gray-300 text-xs transition-all"
              title="Refresh AI logs from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingLogs ? 'animate-spin text-purple-500' : ''}`} />
              <span>Refresh</span>
            </button>
            <button
              onClick={() => setActiveView('ai-trading')}
              className="flex items-center gap-1.5 bg-purple-50 hover:bg-purple-100 dark:bg-purple-950/60 dark:hover:bg-purple-900/40 shadow-2xs px-3.5 py-2 border border-purple-200 dark:border-purple-800 rounded-xl font-semibold text-purple-700 dark:text-purple-300 text-xs transition-all"
            >
              <span>Full Execution Book</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Mode Filter Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-gray-800/90 border border-gray-200 dark:border-gray-700/80 shadow-2xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">P&amp;L Telemetry Mode:</span>
            <div className="flex items-center p-0.5 rounded-xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setDashboardModeFilter('ALL')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  dashboardModeFilter === 'ALL'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>All Trades</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                  {tradeLogs.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardModeFilter('PAPER')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  dashboardModeFilter === 'PAPER'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>Paper Sim</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                  {tradeLogs.filter((t) => t.mode === 'PAPER').length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardModeFilter('LIVE')}
                className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                  dashboardModeFilter === 'LIVE'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <span>Live Broker</span>
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  {tradeLogs.filter((t) => t.mode === 'LIVE').length}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            {dashboardModeFilter === 'ALL' && (
              <>
                <span className="text-amber-600 dark:text-amber-400 font-bold">
                  Live: {liveRealizedPnL >= 0 ? '+' : ''}{formatINR(liveRealizedPnL)}
                </span>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <span className="text-sky-600 dark:text-sky-400 font-bold">
                  Paper: {paperRealizedPnL >= 0 ? '+' : ''}{formatINR(paperRealizedPnL)}
                </span>
              </>
            )}
            {dashboardModeFilter === 'LIVE' && (
              <span className="text-amber-600 dark:text-amber-400 font-bold">
                Live Broker (Angel One Real Capital)
              </span>
            )}
            {dashboardModeFilter === 'PAPER' && (
              <span className="text-sky-600 dark:text-sky-400 font-bold">
                Paper Simulation (Safe Virtual Capital)
              </span>
            )}
          </div>
        </div>

        {/* 4 Top Metric Cards */}
        <div className="gap-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total AI Trades */}
          <div className="bg-white dark:bg-gray-800 shadow-xs hover:shadow-md p-5 border border-gray-200 dark:border-gray-700/80 rounded-2xl transition-all">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                Total Executions
              </span>
              <div className="flex justify-center items-center bg-blue-50 dark:bg-blue-900/40 rounded-lg w-8 h-8 text-blue-600 dark:text-blue-400">
                <Database className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-gray-900 dark:text-white text-2xl">
              {totalTrades}
            </div>
            <div className="flex items-center gap-2 mt-2 text-gray-500 dark:text-gray-400 text-xs">
              <span className="inline-flex items-center gap-1 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                ● {openTrades.length} Active
              </span>
              <span>•</span>
              <span className="font-mono">{closedTrades.length} Exited</span>
            </div>
          </div>

          {/* Card 2: Realized AI P&L */}
          <div className="bg-white dark:bg-gray-800 shadow-xs hover:shadow-md p-5 border border-gray-200 dark:border-gray-700/80 rounded-2xl transition-all">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                Realized Net P&L
              </span>
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  isNeutral
                    ? 'bg-gray-100 dark:bg-gray-750 text-gray-500 dark:text-gray-400'
                    : isOverallProfit
                    ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                    : 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                }`}
              >
                {isNeutral ? (
                  <Database className="w-4 h-4" />
                ) : isOverallProfit ? (
                  <TrendingUp className="w-4 h-4" />
                ) : (
                  <TrendingDown className="w-4 h-4" />
                )}
              </div>
            </div>
            <div
              className={`text-2xl font-black font-mono mt-2 ${
                isNeutral
                  ? 'text-gray-900 dark:text-white'
                  : isOverallProfit
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-rose-600 dark:text-rose-400'
              }`}
            >
              {isNeutral ? '' : isOverallProfit ? '+' : ''}{formatINR(realizedPnL)}
            </div>
            <div className="mt-2 text-gray-500 dark:text-gray-400 text-xs flex flex-wrap items-center justify-between gap-1">
              <span>
                {closedTrades.length > 0
                  ? `From ${closedTrades.length} closed trade${closedTrades.length === 1 ? '' : 's'}`
                  : '0 closed trades'}
              </span>
              {openPositionsCount > 0 && (
                <span className={`font-mono font-semibold ${unrealizedPnL >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  Live: {unrealizedPnL >= 0 ? '+' : ''}{formatINR(unrealizedPnL)} ({openPositionsCount} open)
                </span>
              )}
            </div>
            {dashboardModeFilter === 'ALL' && (closedTrades.length > 0 || openPositionsCount > 0) && (
              <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700/60 flex items-center justify-between text-[10px] font-mono">
                <span className="text-amber-600 dark:text-amber-400 font-semibold">
                  Live: {liveRealizedPnL >= 0 ? '+' : ''}{formatINR(liveRealizedPnL)} ({liveClosedTrades.length} exited, {liveOpenCount} open)
                </span>
                <span className="text-sky-600 dark:text-sky-400 font-semibold">
                  Paper: {paperRealizedPnL >= 0 ? '+' : ''}{formatINR(paperRealizedPnL)} ({paperClosedTrades.length} exited, {paperOpenCount} open)
                </span>
              </div>
            )}
          </div>

          {/* Card 3: Win Rate */}
          <div className="bg-white dark:bg-gray-800 shadow-xs hover:shadow-md p-5 border border-gray-200 dark:border-gray-700/80 rounded-2xl transition-all">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
                AI Win Rate
              </span>
              <div className="flex justify-center items-center bg-purple-50 dark:bg-purple-900/40 rounded-lg w-8 h-8 text-purple-600 dark:text-purple-400">
                <Award className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-2 font-mono font-black text-gray-900 dark:text-white text-2xl">
              {winRate.toFixed(1)}%
            </div>
            <div className="mt-2 text-gray-500 dark:text-gray-400 text-xs">
              <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                {winningTrades.length} Win{winningTrades.length !== 1 ? 's' : ''}
              </span>{' '}
              / {closedTrades.length} closed ({closedTrades.length - winningTrades.length} losses)
            </div>
          </div>

          {/* Card 4: System & API Health */}
          <div className="bg-white dark:bg-gray-800 shadow-xs hover:shadow-md p-5 border border-gray-200 dark:border-gray-700/80 rounded-2xl transition-all">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-gray-500 dark:text-gray-400 text-xs uppercase tracking-wider">
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
            <div className="flex items-center gap-1.5 mt-2 text-gray-500 dark:text-gray-400 text-xs">
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
        <div className="items-start gap-6 grid grid-cols-1 lg:grid-cols-12">
          {/* Left Column: Recent AI Trade Executions / Market Analysis - 7 cols */}
          <div className="space-y-4 lg:col-span-7 bg-white dark:bg-gray-800 shadow-xs p-5 border border-gray-200 dark:border-gray-700/80 rounded-2xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-gray-100 dark:border-gray-700/70 border-b gap-2">
              <div className="flex items-center gap-2">
                <div className="flex justify-center items-center bg-purple-100 dark:bg-purple-900/40 rounded-lg w-7 h-7 text-purple-600 dark:text-purple-400">
                  {logTab === 'TRADES' ? <TrendingUp className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                    {logTab === 'TRADES' ? 'Recent AI Trade Executions' : 'AI Market Analysis Records'}
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    PostgreSQL <code className="font-mono text-purple-600 dark:text-purple-400">{logTab === 'TRADES' ? 'AiTradeLog' : 'AiAnalysisLog'}</code> table
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-700/60 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setLogTab('TRADES')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      logTab === 'TRADES'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Trades ({tradeLogs.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTab('ANALYSIS')}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      logTab === 'ANALYSIS'
                        ? 'bg-purple-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    Analysis ({analysisLogs.length})
                  </button>
                </div>

                <button
                  onClick={() => setActiveView('ai-trading')}
                  className="flex items-center gap-1 font-semibold text-purple-600 hover:text-purple-700 dark:hover:text-purple-300 dark:text-purple-400 text-xs shrink-0"
                >
                  <span>View All</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {logTab === 'ANALYSIS' ? (
              analysisLogs.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-900/40 py-12 border border-gray-200 dark:border-gray-800 border-dashed rounded-xl text-center">
                  <FileText className="mx-auto mb-2 w-10 h-10 text-gray-400 dark:text-gray-600" />
                  <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                    No Database Analysis Logs Found
                  </h5>
                  <p className="mx-auto mt-1 max-w-sm text-gray-500 dark:text-gray-400 text-xs">
                    Multi-factor scanner evaluations from F&O and Equity universes are recorded in the AiAnalysisLog PostgreSQL table.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {analysisLogs.slice(0, visibleTradeLimit).map((item) => {
                    const isBuy = item.action === 'BUY';
                    const isSell = item.action === 'SELL';
                    const dateStr = new Date(item.createdAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <div
                        key={item.id}
                        className="space-y-2 bg-gray-50 dark:bg-gray-900/60 p-3.5 border border-gray-200 hover:border-indigo-300 dark:border-gray-700/60 dark:hover:border-indigo-500/40 rounded-xl transition-all"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                  isBuy
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : isSell
                                    ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {item.action}
                              </span>
                              <span className="font-bold text-gray-900 dark:text-white text-sm">
                                {item.symbol}
                              </span>
                              {item.contractType && (
                                <span className="bg-gray-200 dark:bg-gray-700 px-1.5 py-0.2 rounded font-mono text-[10px] text-gray-700 dark:text-gray-300">
                                  {item.contractType} {item.strike || ''}
                                </span>
                              )}
                              <span className="text-[10px] text-gray-400 font-mono">
                                {item.segment}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400 line-clamp-1">
                              {item.aiThesisSummary || 'Technical confluence evaluation.'}
                            </p>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="font-bold font-mono text-gray-900 dark:text-white text-sm">
                              ₹{item.currentPrice?.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-gray-400 font-mono">
                              {dateStr}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap justify-between items-center pt-1.5 border-t border-gray-200/60 dark:border-gray-700 text-[10px] text-gray-500 font-mono">
                          <div className="flex items-center gap-2">
                            <span>Conf: <strong className="text-gray-900 dark:text-white">{item.confidence}%</strong></span>
                            {item.rsi && <span>RSI: {item.rsi.toFixed(1)}</span>}
                          </div>
                          {item.delta != null && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-emerald-600 dark:text-emerald-400">Δ{item.delta.toFixed(2)}</span>
                              <span className="text-blue-600 dark:text-blue-400">Γ{item.gamma?.toFixed(3) || '0'}</span>
                              <span className="text-rose-600 dark:text-rose-400">Θ{item.theta?.toFixed(1) || '0'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {analysisLogs.length > 5 && (
                    <div className="flex justify-between items-center pt-2 text-xs">
                      {visibleTradeLimit < analysisLogs.length ? (
                        <button
                          onClick={() => setVisibleTradeLimit((prev) => Math.min(prev + 5, analysisLogs.length))}
                          className="font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                        >
                          Show 5 More ({analysisLogs.length - visibleTradeLimit} remaining)
                        </button>
                      ) : (
                        <button
                          onClick={() => setVisibleTradeLimit(5)}
                          className="font-semibold text-gray-500 hover:underline"
                        >
                          Show Less
                        </button>
                      )}
                      <span className="text-gray-400 font-mono text-[10px]">
                        Showing {Math.min(visibleTradeLimit, analysisLogs.length)} of {analysisLogs.length}
                      </span>
                    </div>
                  )}
                </div>
              )
            ) : relevantTradeLogs.length === 0 ? (
              <div className="bg-gray-50 dark:bg-gray-900/40 py-12 border border-gray-200 dark:border-gray-800 border-dashed rounded-xl text-center">
                <Database className="mx-auto mb-2 w-10 h-10 text-gray-400 dark:text-gray-600" />
                <h5 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                  No {dashboardModeFilter !== 'ALL' ? `${dashboardModeFilter} ` : ''}Trade Logs Found
                </h5>
                <p className="mx-auto mt-1 max-w-sm text-gray-500 dark:text-gray-400 text-xs">
                  Trades executed by the Greek Momentum Sniper or Auto-Pilot will be permanently audited here with Greeks, entry/exit prices, and exit triggers.
                </p>
                <button
                  onClick={() => setActiveView('ai-trading')}
                  className="inline-flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 shadow-sm mt-4 px-4 py-2 rounded-xl font-bold text-white text-xs transition-all"
                >
                  <Zap className="w-3.5 h-3.5" />
                  <span>Launch AI Auto-Pilot</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {relevantTradeLogs.slice(0, visibleTradeLimit).map((trade) => {
                  const isBuy = trade.action === 'BUY';
                  const pnlVal = trade.netPnl ?? trade.pnl;
                  const isProfit = (Number(pnlVal) || 0) >= 0;
                  const dateStr = new Date(trade.enteredAt).toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <div
                      key={trade.id}
                      className="space-y-2 bg-gray-50 dark:bg-gray-900/60 p-3.5 border border-gray-200 hover:border-purple-300 dark:border-gray-700/60 dark:hover:border-purple-500/40 rounded-xl transition-all"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-black uppercase ${
                                isBuy
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}
                            >
                              {trade.action}
                            </span>
                            <span className="font-bold text-gray-900 dark:text-white text-xs sm:text-sm">
                              {trade.symbol}
                            </span>
                            <span className="bg-purple-100 dark:bg-purple-950 px-1.5 py-0.2 rounded font-mono text-[10px] text-purple-800 dark:text-purple-300">
                              {trade.strategy || 'GREEK_SNIPER'}
                            </span>
                            <span
                              className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                                trade.mode === 'LIVE'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60'
                              }`}
                            >
                              {trade.mode === 'LIVE' ? 'LIVE' : 'PAPER'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-0.5 font-mono text-[11px] text-gray-500 dark:text-gray-400">
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
                          {pnlVal !== null && pnlVal !== undefined ? (
                            <div>
                              <div
                                className={`text-xs sm:text-sm font-bold font-mono ${
                                  isProfit
                                    ? 'text-emerald-600 dark:text-emerald-400'
                                    : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isProfit ? '+' : ''}₹{Number(pnlVal).toLocaleString('en-IN')}
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
                            <span className="bg-blue-100 dark:bg-blue-950 px-2 py-0.5 rounded-full font-bold text-[10px] text-blue-700 dark:text-blue-300 animate-pulse">
                              Active
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Entry / Exit & Greeks Bar */}
                      <div className="flex justify-between items-center pt-1.5 border-gray-200/60 dark:border-gray-800/80 border-t text-[11px]">
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
                            <div className="hidden sm:flex items-center gap-1.5 font-mono text-[10px] text-gray-500 dark:text-gray-400">
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
                  <div className="flex justify-between items-center pt-2 text-xs">
                    {visibleTradeLimit < tradeLogs.length ? (
                      <button
                        onClick={() => setVisibleTradeLimit((prev) => Math.min(prev + 5, tradeLogs.length))}
                        className="font-semibold text-purple-600 dark:text-purple-400 hover:underline"
                      >
                        Show 5 More ({tradeLogs.length - visibleTradeLimit} remaining)
                      </button>
                    ) : (
                      <button
                        onClick={() => setVisibleTradeLimit(5)}
                        className="font-semibold text-gray-500 hover:underline"
                      >
                        Show Less
                      </button>
                    )}

                    <button
                      onClick={() => setActiveView('ai-trading')}
                      className="inline-flex items-center gap-1 font-semibold text-gray-600 hover:text-purple-600 dark:hover:text-purple-400 dark:text-gray-300"
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
          <div className="space-y-4 lg:col-span-5 bg-white dark:bg-gray-800 shadow-xs p-5 border border-gray-200 dark:border-gray-700/80 rounded-2xl">
            <div className="flex justify-between items-center pb-3 border-gray-100 dark:border-gray-700/70 border-b">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                    actualExceptions.length === 0
                      ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400'
                      : 'bg-rose-100 dark:bg-rose-900/40 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {actualExceptions.length === 0 ? (
                    <ShieldCheck className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                </div>
                <div>
                  <h4 className="font-bold text-gray-900 dark:text-white text-sm">
                    Engine & Telemetry Deck
                  </h4>
                  <p className="text-[11px] text-gray-500 dark:text-gray-400">
                    Live operational audit & error telemetry
                  </p>  
                </div>
              </div>

              <div className="flex items-center gap-2">
                {errorLogs.length > 0 && (
                  <button
                    onClick={handleClearErrors}
                    title="Clear resolved telemetry logs"
                    className="flex items-center gap-1 hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded-md font-semibold text-[11px] text-gray-500 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    actualExceptions.length === 0
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                  }`}
                >
                  {actualExceptions.length === 0
                    ? errorLogs.length === 0
                      ? 'All Systems Nominal'
                      : `Nominal • ${errorLogs.length} Events`
                    : `${actualExceptions.length} Exception${actualExceptions.length > 1 ? 's' : ''}`}
                </span>
              </div>
            </div>

            {/* Filter Pills */}
            {errorLogs.length > 0 && (
              <div className="flex items-center gap-1.5 p-1 bg-gray-100 dark:bg-gray-900/80 rounded-lg text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setErrorFilter('ALL')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    errorFilter === 'ALL'
                      ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-gray-800 dark:text-gray-400'
                  }`}
                >
                  All ({errorLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setErrorFilter('STATUS')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    errorFilter === 'STATUS'
                      ? 'bg-white dark:bg-gray-800 text-purple-600 dark:text-purple-400 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-purple-600 dark:text-gray-400'
                  }`}
                >
                  Status & Sizing ({auditLogs.length})
                </button>
                <button
                  type="button"
                  onClick={() => setErrorFilter('EXCEPTIONS')}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    errorFilter === 'EXCEPTIONS'
                      ? 'bg-white dark:bg-gray-800 text-rose-600 dark:text-rose-400 shadow-2xs font-bold'
                      : 'text-gray-500 hover:text-rose-600 dark:text-gray-400'
                  }`}
                >
                  Exceptions ({actualExceptions.length})
                </button>
              </div>
            )}

            {displayedLogs.length === 0 ? (
              <div className="space-y-3 bg-emerald-50/50 dark:bg-emerald-950/20 p-6 border border-emerald-200 dark:border-emerald-800/40 rounded-xl text-center">
                <CheckCircle2 className="mx-auto w-10 h-10 text-emerald-500 dark:text-emerald-400" />
                <div>
                  <h5 className="font-bold text-emerald-950 dark:text-emerald-200 text-sm">
                    {errorFilter === 'EXCEPTIONS' ? 'Zero System Exceptions' : 'All Systems Operational'}
                  </h5>
                  <p className="mx-auto mt-1 max-w-xs text-emerald-800/80 dark:text-emerald-300/80 text-xs leading-relaxed">
                    {errorFilter === 'EXCEPTIONS'
                      ? 'No SmartAPI, rate limit, or order placement exceptions recorded.'
                      : 'Zero broker or engine execution errors recorded.'}
                  </p>
                </div>

                <div className="gap-2 grid grid-cols-2 pt-2 border-emerald-200/60 dark:border-emerald-800/40 border-t text-[11px] text-left">
                  <div className="bg-white/70 dark:bg-gray-900/60 p-2 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400">Session Guard</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">JWT Nominal</span>
                  </div>
                  <div className="bg-white/70 dark:bg-gray-900/60 p-2 border border-emerald-100 dark:border-emerald-900/40 rounded-lg">
                    <span className="block text-[10px] text-gray-500 dark:text-gray-400">Auto-Pilot Engine</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">Ready</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 pr-1 max-h-[460px] overflow-y-auto">
                {displayedLogs.slice(0, 6).map((err) => {
                  const isExpanded = expandedErrorId === err.id;
                  const timeStr = new Date(err.createdAt).toLocaleTimeString('en-IN');
                  const isStatus = err.source === 'AUTOPILOT_STATUS' || err.action === 'AUTOPILOT_ENABLED' || err.action === 'AUTOPILOT_DISABLED';
                  const isScan = err.source === 'SCANNER';
                  const isExecution = err.action === 'ORDER_EXECUTED';
                  const isSlabFilter = err.action === 'SLAB_EXCEEDED' || err.action === 'SLAB_CONFIG_UPDATED';
                  const isException = !isStatus && !isScan && !isExecution && !isSlabFilter;

                  const cardContainer = isStatus
                    ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 hover:border-purple-300 dark:border-purple-800/40'
                    : isScan
                    ? 'bg-blue-50/40 dark:bg-blue-950/20 border-blue-200 hover:border-blue-300 dark:border-blue-800/40'
                    : isExecution
                    ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 hover:border-emerald-300 dark:border-emerald-800/40'
                    : isSlabFilter
                    ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200 hover:border-amber-300 dark:border-amber-800/40'
                    : 'bg-rose-50/40 dark:bg-gray-900/60 border-rose-200 hover:border-rose-400 dark:border-rose-500/20';

                  const badgeClass = isStatus
                    ? 'bg-purple-100 dark:bg-purple-900/60 text-purple-800 dark:text-purple-300 border-purple-200'
                    : isScan
                    ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 border-blue-200'
                    : isExecution
                    ? 'bg-emerald-100 dark:bg-emerald-900/60 text-emerald-800 dark:text-emerald-300 border-emerald-200'
                    : isSlabFilter
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border-rose-200';

                  const textButtonClass = isStatus
                    ? 'text-purple-600 dark:text-purple-400'
                    : isScan
                    ? 'text-blue-600 dark:text-blue-400'
                    : isExecution
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : isSlabFilter
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-rose-600 dark:text-rose-400';

                  return (
                    <div
                      key={err.id}
                      className={`space-y-2 p-3.5 border rounded-xl transition-all ${cardContainer}`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-start space-x-2">
                          {isStatus && <Bot className="mt-0.5 w-4 h-4 text-purple-600 dark:text-purple-400 shrink-0" />}
                          {isScan && <Activity className="mt-0.5 w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />}
                          {isExecution && <Zap className="mt-0.5 w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 fill-current" />}
                          {isSlabFilter && <Wallet className="mt-0.5 w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />}
                          {isException && <AlertTriangle className="mt-0.5 w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />}

                          <div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] border ${badgeClass}`}>
                                {err.source}
                              </span>
                              {err.action && (
                                <span className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.2 rounded font-mono text-[10px] text-gray-700 dark:text-gray-300">
                                  {err.action}
                                </span>
                              )}
                              {err.symbol && (
                                <span className="font-bold text-[11px] text-gray-900 dark:text-white">
                                  {err.symbol}
                                </span>
                              )}
                            </div>
                            <p className="mt-1 font-sans font-medium text-gray-800 dark:text-gray-200 text-xs line-clamp-2">
                              {err.message}
                            </p>
                          </div>
                        </div>

                        <span className="font-mono text-[10px] text-gray-500 shrink-0">
                          {timeStr}
                        </span>
                      </div>

                      {/* Expandable Technical / Telemetry Details */}
                      {(err.details || err.stack) && (
                        <div>
                          <button
                            onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                            className={`flex items-center gap-1 font-semibold text-[11px] hover:underline ${textButtonClass}`}
                          >
                            <span>
                              {isException
                                ? isExpanded
                                  ? 'Hide Details'
                                  : 'View Payload & Stack'
                                : isExpanded
                                ? 'Hide Details'
                                : 'View Telemetry Payload'}
                            </span>
                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          </button>

                          {err.source === 'KILL_SWITCH' && (
                            <div className="pt-2 flex items-center justify-between border-t border-rose-200/60 dark:border-rose-900/40">
                              <span className="text-[11px] text-rose-700 dark:text-rose-300 font-medium">Daily loss limit halt</span>
                              <button
                                type="button"
                                onClick={async () => {
                                  try {
                                    await resetAutoPilotKillSwitch();
                                    await loadErrorLogs();
                                  } catch (e) {
                                    console.error(e);
                                  }
                                }}
                                className="px-2.5 py-1 rounded-md bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] shadow-xs transition-all"
                              >
                                Reset Kill-Switch
                              </button>
                            </div>
                          )}

                          {isExpanded && (
                            <div className="space-y-1 bg-gray-950 mt-2 p-2.5 rounded-lg overflow-x-auto font-mono text-[10px] text-gray-300">
                              {err.details && (
                                <div>
                                  <span className="block text-gray-500">
                                    {isException ? 'Payload:' : 'Operational Payload:'}
                                  </span>
                                  <pre className="text-emerald-400 whitespace-pre-wrap">
                                    {typeof err.details === 'object' ? JSON.stringify(err.details, null, 2) : String(err.details)}
                                  </pre>
                                </div>
                              )}
                              {err.stack && (
                                <div className="mt-1 pt-1 border-gray-800 border-t">
                                  <span className="block text-gray-500">Stack:</span>
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
      <div className="items-start gap-6 grid grid-cols-1 md:grid-cols-2">
        {/* User Profile Overview */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white text-lg">
            <User className="w-5 h-5 text-blue-600" />
            <span>Connected User Account</span>
          </h3>
          <UserProfileCard />
        </div>

        {/* Quick Links Card */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 font-bold text-gray-900 dark:text-white text-lg">
            <Zap className="w-5 h-5 text-amber-500" />
            <span>Direct Navigation & Features</span>
          </h3>

          <div className="space-y-4 bg-white dark:bg-gray-800 shadow-sm p-6 border border-gray-200 dark:border-gray-700/80 rounded-2xl">
            <div
              onClick={handleNavigatePositions}
              className="group bg-gray-50 hover:bg-blue-50 dark:bg-gray-700/50 dark:hover:bg-blue-900/30 p-4 border border-gray-200 dark:border-gray-700 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="flex justify-center items-center bg-blue-100 dark:bg-blue-900/40 rounded-xl w-10 h-10 text-blue-600 dark:text-blue-400">
                    <Briefcase className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:group-hover:text-blue-400 dark:text-white group-hover:text-blue-600 text-sm">
                      Portfolio Positions & Holdings
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      Track open positions, P&L, M2M, and delivery holdings
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('ai-trading')}
              className="group bg-gray-50 hover:bg-purple-50 dark:bg-gray-700/50 dark:hover:bg-purple-900/30 p-4 border border-gray-200 dark:border-gray-700 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="flex justify-center items-center bg-purple-100 dark:bg-purple-900/40 rounded-xl w-10 h-10 text-purple-600 dark:text-purple-400">
                    <Zap className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 dark:group-hover:text-purple-400 dark:text-white group-hover:text-purple-600 text-sm">
                        Greek Momentum Sniper
                      </h4>
                      <span className="bg-purple-100 dark:bg-purple-900/60 px-2 py-0.2 rounded-full font-bold text-[10px] text-purple-700 dark:text-purple-300">
                        AI Auto-Pilot
                      </span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      Strike Greek filters (Delta, Gamma, Theta), Golden Hours, and automated +50% target exits
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-purple-600 transition-all group-hover:translate-x-1" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('fno')}
              className="group bg-gray-50 hover:bg-indigo-50 dark:bg-gray-700/50 dark:hover:bg-indigo-900/30 p-4 border border-gray-200 dark:border-gray-700 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="flex justify-center items-center bg-indigo-100 dark:bg-indigo-900/40 rounded-xl w-10 h-10 text-indigo-600 dark:text-indigo-400">
                    <Flame className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-bold text-gray-900 dark:group-hover:text-indigo-400 dark:text-white group-hover:text-indigo-600 text-sm">
                        Top Volatile F&O Movers
                      </h4>
                      <span className="bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.2 rounded-full font-bold text-[10px] text-indigo-700 dark:text-indigo-300">
                        Live
                      </span>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      Futures, Call (CE) & Put (PE) high-swing derivatives
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 transition-all group-hover:translate-x-1" />
              </div>
            </div>

            <div
              onClick={() => setActiveView('markets')}
              className="group bg-gray-50 hover:bg-emerald-50 dark:bg-gray-700/50 dark:hover:bg-emerald-900/30 p-4 border border-gray-200 dark:border-gray-700 rounded-xl transition-all cursor-pointer"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="flex justify-center items-center bg-emerald-100 dark:bg-emerald-900/40 rounded-xl w-10 h-10 text-emerald-600 dark:text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900 dark:group-hover:text-emerald-400 dark:text-white group-hover:text-emerald-600 text-sm">
                      Live Markets & Indices
                    </h4>
                    <p className="text-gray-500 dark:text-gray-400 text-xs">
                      Track Nifty, Sensex & BankNifty live market streams
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-emerald-600 transition-all group-hover:translate-x-1" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
