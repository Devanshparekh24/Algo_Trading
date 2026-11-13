import React, { useState, useEffect, useCallback } from 'react';
import {
  History,
  RefreshCw,
  Zap,
  Database,
  Clock,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertTriangle,
  Square,
  Bot,
  Activity,
  Wallet,
} from 'lucide-react';
import {
  fetchActivePositions,
  closeActivePosition,
  fetchAiTradeLogs,
  fetchAiErrorLogs,
  type OrderBookItem,
  type ActiveAiPosition,
  type AiTradeLogItem,
  type AiErrorLogItem,
} from '../../services/aiTradingService';
import { getSocket } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';

interface AiOrderBookTabProps {
  orders: OrderBookItem[];
  isLoadingOrders: boolean;
  onRefreshOrders: () => void;
}

type TabType = 'ACTIVE_POSITIONS' | 'TRADE_LOGS' | 'ERROR_LOGS' | 'BROKER_ORDERS';

export const AiOrderBookTab: React.FC<AiOrderBookTabProps> = ({
  orders,
  isLoadingOrders,
  onRefreshOrders,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE_POSITIONS');
  const [activePositions, setActivePositions] = useState<ActiveAiPosition[]>([]);
  const [tradeLogs, setTradeLogs] = useState<AiTradeLogItem[]>([]);
  const [errorLogs, setErrorLogs] = useState<AiErrorLogItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [closingPosId, setClosingPosId] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'STATUS' | 'SCANNER' | 'EXECUTION' | 'ERRORS'>('ALL');

  // Load Active Positions
  const loadPositions = useCallback(async () => {
    try {
      const pos = await fetchActivePositions();
      setActivePositions(pos || []);
    } catch (err) {
      console.warn('Failed to load active positions:', err);
    }
  }, []);

  // Load Database Trade Logs
  const loadTradeLogs = useCallback(async () => {
    try {
      const logs = await fetchAiTradeLogs(50);
      setTradeLogs(logs || []);
    } catch (err) {
      console.warn('Failed to load database trade logs:', err);
    }
  }, []);

  // Load Database Error Logs
  const loadErrorLogs = useCallback(async () => {
    try {
      const errs = await fetchAiErrorLogs(50);
      setErrorLogs(errs || []);
    } catch (err) {
      console.warn('Failed to load database error logs:', err);
    }
  }, []);

  const handleRefreshAll = useCallback(async () => {
    setIsLoadingData(true);
    try {
      await Promise.all([loadPositions(), loadTradeLogs(), loadErrorLogs()]);
      onRefreshOrders();
    } finally {
      setIsLoadingData(false);
    }
  }, [loadPositions, loadTradeLogs, loadErrorLogs, onRefreshOrders]);

  useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);

  // Listen to live socket events for active positions and exits
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlePositionsUpdate = (positions: ActiveAiPosition[]) => {
      if (Array.isArray(positions)) {
        setActivePositions(positions);
      }
    };

    const handleAutoExitExecuted = () => {
      loadPositions();
      loadTradeLogs();
      onRefreshOrders();
    };

    const handleAutoTradeExecuted = () => {
      loadPositions();
      loadTradeLogs();
      onRefreshOrders();
    };

    socket.on('ai_positions_update', handlePositionsUpdate);
    socket.on('ai_position_opened', loadPositions);
    socket.on('ai_auto_exit_executed', handleAutoExitExecuted);
    socket.on('ai_auto_trade_executed', handleAutoTradeExecuted);
    socket.on('ai_autopilot_status_changed', loadErrorLogs);
    socket.on('ai_scanner_activity', loadErrorLogs);

    return () => {
      socket.off('ai_positions_update', handlePositionsUpdate);
      socket.off('ai_position_opened', loadPositions);
      socket.off('ai_auto_exit_executed', handleAutoExitExecuted);
      socket.off('ai_auto_trade_executed', handleAutoTradeExecuted);
      socket.off('ai_autopilot_status_changed', loadErrorLogs);
      socket.off('ai_scanner_activity', loadErrorLogs);
    };
  }, [loadPositions, loadTradeLogs, onRefreshOrders]);

  // Manual 1-Click Close Position
  const handleClosePosition = async (id: string) => {
    setClosingPosId(id);
    try {
      await closeActivePosition(id);
      await loadPositions();
      await loadTradeLogs();
      onRefreshOrders();
    } catch (err) {
      console.error('Failed to close active position:', err);
    } finally {
      setClosingPosId(null);
    }
  };

  const openPositionsCount = activePositions.filter((p) => p.status === 'OPEN').length;

  return (
    <div className="space-y-5">
      {/* Tab Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <span>Greek Momentum Sniper: Execution & Audit Deck</span>
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Active position monitoring with 45-min theta protection, permanent database audit logs, and system error telemetry.
          </p>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar w-full md:w-auto pb-1 md:pb-0">
          {/* Sub Tabs */}
          <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-semibold whitespace-nowrap overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveTab('ACTIVE_POSITIONS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ACTIVE_POSITIONS'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Active Sniper</span>
              {openPositionsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-400/40">
                  {openPositionsCount}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('TRADE_LOGS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'TRADE_LOGS'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Database className="w-3.5 h-3.5" />
              <span>Database Trade Logs</span>
              {tradeLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-400/40">
                  {tradeLogs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('ERROR_LOGS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ERROR_LOGS'
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Audit & Telemetry Logs</span>
              {errorLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-200 dark:border-purple-400/40">
                  {errorLogs.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('BROKER_ORDERS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'BROKER_ORDERS'
                  ? 'bg-gray-800 text-white dark:bg-gray-700 shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              <span>Broker Orderbook</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isLoadingData || isLoadingOrders}
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white hover:bg-gray-50 text-gray-700 hover:text-gray-900 border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white dark:border-gray-700 text-xs font-semibold transition-all shadow-2xs disabled:opacity-50"
            title="Refresh All Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData || isLoadingOrders ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ==================================================================== */}
      {/* TAB 1: ACTIVE POSITIONS & GREEK SNIPER AUTO-EXIT MONITOR */}
      {/* ==================================================================== */}
      {activeTab === 'ACTIVE_POSITIONS' && (
        <div className="space-y-4">
          {activePositions.filter((p) => p.status === 'OPEN').length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
              <Zap className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No Open AI Sniper Positions</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                When Greek Momentum Sniper or Auto-Pilot executes an order, it is monitored here with real-time target (+50%), stop-loss (-22%), and 45-min theta timeout auto-exits.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {activePositions
                .filter((p) => p.status === 'OPEN')
                .map((pos) => {
                  const isProfit = (pos.pnl || 0) >= 0;
                  const holdingMins = pos.holdingMinutes || 0;
                  const timeoutMins = pos.timeoutMinutes || 45;
                  const timeoutProgress = Math.min(100, Math.round((holdingMins / timeoutMins) * 100));
                  const isClosing = closingPosId === pos.id;

                  return (
                    <div
                      key={pos.id}
                      className="p-5 rounded-2xl bg-white dark:bg-gray-900/90 border border-emerald-200 dark:border-emerald-500/30 shadow-xs hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/60 space-y-4 transition-all"
                    >
                      {/* Card Top: Symbol, Action & Strategy */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-base text-gray-900 dark:text-white">{pos.symbol}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              {pos.strategy}
                            </span>
                            <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                              {pos.mode}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                            Order ID: {pos.orderId} • {pos.quantity} units ({pos.lots} Lot{pos.lots > 1 ? 's' : ''})
                          </div>
                        </div>

                        {/* Live P&L Badge */}
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold font-mono flex items-center justify-end space-x-1 ${
                              isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span>{isProfit ? '+' : ''}₹{(pos.pnl || 0).toLocaleString('en-IN')}</span>
                          </div>
                          <div
                            className={`text-xs font-bold font-mono ${
                              isProfit ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                            }`}
                          >
                            {isProfit ? '+' : ''}{pos.pnlPercent || 0}%
                          </div>
                          {pos.charges !== undefined && pos.charges > 0 && (
                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">
                              Taxes/Costs: ₹{pos.charges}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Auto-Exit Failure / Retry Critical Alert */}
                      {pos.exitRetryCount !== undefined && pos.exitRetryCount > 0 && (
                        <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/70 border border-rose-300 dark:border-rose-500/60 text-rose-800 dark:text-rose-200 text-xs flex items-center justify-between gap-2 animate-pulse">
                          <div className="flex items-center space-x-1.5 overflow-hidden">
                            <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                            <span className="truncate">
                              <strong>Auto-Exit Alert ({pos.exitRetryCount} retries):</strong> {pos.lastExitError || 'Exit rejected'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleClosePosition(pos.id)}
                            disabled={isClosing}
                            className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[10px] shadow-xs"
                          >
                            Emergency Force Exit
                          </button>
                        </div>
                      )}

                      {/* Price Grid */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] text-gray-500 block">Entry Price</span>
                          <span className="font-bold text-gray-900 dark:text-white font-mono text-sm">₹{pos.entryPrice}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] text-gray-500 block">Current LTP</span>
                          <span className="font-bold text-gray-900 dark:text-white font-mono text-sm">₹{pos.currentPrice}</span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] text-gray-500 block">Peak Price</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">₹{pos.highestPrice}</span>
                        </div>
                      </div>

                      {/* Greek Metrics Snapshot (if available) */}
                      {pos.greeks && (
                        <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-950/80 border border-emerald-200 dark:border-emerald-500/20 text-center text-[10px]">
                          <div>
                            <span className="text-gray-500 block text-[9px]">Delta Δ</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{pos.greeks.delta.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px]">Gamma Γ</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{pos.greeks.gamma.toFixed(4)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px]">Theta Θ/d</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">-₹{pos.greeks.theta.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px]">IV %</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{pos.greeks.iv.toFixed(1)}%</span>
                          </div>
                        </div>
                      )}

                      {/* Theta Timeout Countdown Progress */}
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-600 dark:text-gray-400 flex items-center space-x-1.5">
                            <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                            <span>Theta Timeout Protection</span>
                          </span>
                          <span className="font-bold font-mono text-amber-600 dark:text-amber-400 text-xs">
                            {holdingMins}m / {timeoutMins}m{' '}
                            <span className="text-gray-500 font-normal">
                              ({Math.max(0, Math.round(timeoutMins - holdingMins))}m left)
                            </span>
                          </span>
                        </div>
                        <div className="w-full h-2 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              timeoutProgress > 75
                                ? 'bg-rose-500'
                                : timeoutProgress > 50
                                ? 'bg-amber-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${timeoutProgress}%` }}
                          />
                        </div>
                      </div>

                      {/* Auto-Exit Targets & Actions */}
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center space-x-3 text-xs text-gray-600 dark:text-gray-400 font-mono">
                          <span>🎯 Target: ₹{pos.targetPrice}</span>
                          <span>🛡️ SL: ₹{pos.stopLossPrice}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleClosePosition(pos.id)}
                          disabled={isClosing}
                          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all shadow-md shadow-rose-600/20 disabled:opacity-50"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>{isClosing ? 'Exiting...' : 'Exit Position'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: DATABASE TRADE LOGS & STRATEGY AUDIT */}
      {/* ==================================================================== */}
      {activeTab === 'TRADE_LOGS' && (
        <div className="space-y-4">
          {tradeLogs.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
              <Database className="w-12 h-12 text-blue-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No Database Trade Logs Found</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                Every trade executed by Greek Sniper or 1-Click order execution is permanently stored in PostgreSQL with Greeks, AI thesis, and exit reasons.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-sm">
              <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Order / Time</th>
                    <th className="px-4 py-3">Symbol & Strategy</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3 text-right">Entry / Exit</th>
                    <th className="px-4 py-3 text-center">Greeks at Entry</th>
                    <th className="px-4 py-3 text-center">Status / Exit Reason</th>
                    <th className="px-4 py-3 text-right">Net P&L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 font-mono">
                  {tradeLogs.map((log) => {
                    const isBuy = log.action === 'BUY';
                    const isProfit = (log.pnl || 0) >= 0;
                    const dateStr = new Date(log.enteredAt).toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{log.orderId}</div>
                          <div className="text-[10px] text-gray-500 font-sans">{dateStr}</div>
                        </td>
                        <td className="px-4 py-3 font-sans">
                          <div className="font-bold text-gray-900 dark:text-white">{log.symbol}</div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 font-mono">
                              {log.strategy}
                            </span>
                            <span className="text-[10px] text-gray-500 font-mono">
                              {log.quantity} qty ({log.lots} lots)
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              isBuy
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                                : 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                            }`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <div className="text-gray-900 dark:text-white font-bold">₹{log.entryPrice}</div>
                          <div className="text-[10px] text-gray-500 dark:text-gray-400">
                            Exit: {log.exitPrice ? `₹${log.exitPrice}` : 'Open'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          {log.delta !== null && log.delta !== undefined ? (
                            <div className="text-[10px] space-x-1 font-mono text-gray-700 dark:text-gray-300">
                              <span className="text-emerald-600 dark:text-emerald-400">Δ{log.delta.toFixed(2)}</span>
                              <span className="text-blue-600 dark:text-blue-400">Γ{log.gamma?.toFixed(3) || '0'}</span>
                              <span className="text-rose-600 dark:text-rose-400">Θ{log.theta?.toFixed(1) || '0'}</span>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              log.status === 'OPEN'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800'
                                : log.exitReason === 'TARGET'
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                                : log.exitReason === 'STOP_LOSS'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                                : log.exitReason === 'THETA_TIMEOUT'
                                ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {log.status === 'OPEN'
                              ? 'Active / Open'
                              : log.exitReason === 'TARGET'
                              ? 'Target (+50%) Hit'
                              : log.exitReason === 'STOP_LOSS'
                              ? 'Stop-Loss (-22%)'
                              : log.exitReason === 'THETA_TIMEOUT'
                              ? 'Theta Timeout (45m)'
                              : 'Closed'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {log.pnl !== null && log.pnl !== undefined ? (
                            <div>
                              <div
                                className={`font-bold text-sm ${
                                  isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {isProfit ? '+' : ''}₹{log.pnl.toLocaleString('en-IN')}
                              </div>
                              {log.pnlPercent !== null && (
                                <div
                                  className={`text-[10px] font-semibold ${
                                    isProfit ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                                  }`}
                                >
                                  {isProfit ? '+' : ''}{log.pnlPercent}%
                                </div>
                              )}
                              {log.charges !== undefined && log.charges > 0 && (
                                <div className="text-[9px] text-gray-400 font-normal mt-0.5">
                                  Charges: ₹{log.charges}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AUDIT & TELEMETRY LOGS */}
      {/* ==================================================================== */}
      {activeTab === 'ERROR_LOGS' && (
        <div className="space-y-4">
          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 flex-wrap pb-1">
            <span className="text-xs text-gray-500 font-semibold mr-1">Filter Stream:</span>
            {[
              { id: 'ALL', label: 'All Telemetry' },
              { id: 'STATUS', label: 'Auto-Pilot Status (ON/OFF)' },
              { id: 'SCANNER', label: 'Scanner Activity' },
              { id: 'EXECUTION', label: 'Executions & Slabs' },
              { id: 'ERRORS', label: 'Exceptions' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setAuditFilter(f.id as any)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                  auditFilter === f.id
                    ? 'bg-purple-600 text-white border-purple-500 shadow-xs'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {(() => {
            const filteredLogs = errorLogs.filter((err) => {
              if (auditFilter === 'ALL') return true;
              if (auditFilter === 'STATUS') return err.source === 'AUTOPILOT_STATUS';
              if (auditFilter === 'SCANNER') return err.source === 'SCANNER';
              if (auditFilter === 'EXECUTION')
                return err.action === 'ORDER_EXECUTED' || err.action === 'SLAB_EXCEEDED';
              if (auditFilter === 'ERRORS')
                return (
                  err.source !== 'AUTOPILOT_STATUS' &&
                  err.source !== 'SCANNER' &&
                  err.action !== 'ORDER_EXECUTED' &&
                  err.action !== 'SLAB_EXCEEDED'
                );
              return true;
            });

            if (filteredLogs.length === 0) {
              return (
                <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
                  <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No Logs for Selected Filter</h3>
                  <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                    System activity, market scans, and auto-pilot execution events will be logged here in real-time.
                  </p>
                </div>
              );
            }

            return (
              <div className="space-y-2.5">
                {filteredLogs.map((err) => {
                  const isExpanded = expandedErrorId === err.id;
                  const timeStr = new Date(err.createdAt).toLocaleString('en-IN');
                  const isStatus = err.source === 'AUTOPILOT_STATUS';
                  const isScan = err.source === 'SCANNER';
                  const isExecution = err.action === 'ORDER_EXECUTED';
                  const isSlabFilter = err.action === 'SLAB_EXCEEDED';
                  const isException = !isStatus && !isScan && !isExecution && !isSlabFilter;

                  const cardBorder = isStatus
                    ? 'border-emerald-300 dark:border-emerald-500/30 bg-emerald-50/30 dark:bg-emerald-950/20'
                    : isScan
                    ? 'border-blue-300 dark:border-blue-500/30 bg-blue-50/30 dark:bg-blue-950/20'
                    : isExecution
                    ? 'border-emerald-400 dark:border-emerald-500/50 bg-emerald-50/40 dark:bg-emerald-950/30'
                    : isSlabFilter
                    ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50/30 dark:bg-amber-950/20'
                    : 'border-rose-200 dark:border-rose-500/20 bg-rose-50/30 dark:bg-rose-950/20';

                  const badgeClass = isStatus
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                    : isScan
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300'
                    : isExecution
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : isSlabFilter
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300';

                  return (
                    <div
                      key={err.id}
                      className={`p-4 rounded-xl border ${cardBorder} shadow-2xs transition-all space-y-2`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-2.5">
                          {isStatus && <Bot className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />}
                          {isScan && <Activity className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />}
                          {isExecution && <Zap className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0 fill-current" />}
                          {isSlabFilter && <Wallet className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />}
                          {isException && <AlertTriangle className="w-4 h-4 text-rose-500 mt-0.5 shrink-0" />}

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}`}>
                                {err.source}
                              </span>
                              {err.action && (
                                <span className="px-1.5 py-0.2 rounded text-[10px] bg-gray-200 dark:bg-gray-800 text-gray-800 dark:text-gray-200 font-mono font-bold">
                                  {err.action}
                                </span>
                              )}
                              {err.symbol && (
                                <span className="font-bold text-gray-900 dark:text-white text-xs">{err.symbol}</span>
                              )}
                            </div>
                            <p className="text-xs text-gray-800 dark:text-gray-200 mt-1 font-sans font-medium">
                              {err.message}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] text-gray-500 font-mono">{timeStr}</span>
                          {(err.details || err.stack) && (
                            <button
                              type="button"
                              onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>

                      {isExpanded && (err.details || err.stack) && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-800 text-[10px] font-mono text-gray-600 dark:text-gray-400 space-y-1 bg-gray-50 dark:bg-gray-950 p-2.5 rounded-lg overflow-x-auto">
                          {err.details && (
                            <div>
                              <span className="text-gray-500 font-semibold">Telemetry Data: </span>
                              <pre className="text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{JSON.stringify(err.details, null, 2)}</pre>
                            </div>
                          )}
                          {err.stack && (
                            <div className="pt-1">
                              <span className="text-gray-500 font-semibold">Stack Trace: </span>
                              <pre className="text-rose-700 dark:text-rose-300/80 whitespace-pre-wrap">{err.stack}</pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 4: RAW BROKER ORDER BOOK */}
      {/* ==================================================================== */}
      {activeTab === 'BROKER_ORDERS' && (
        <div className="space-y-4">
          {orders.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
              <History className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No Orders in Broker Orderbook</h3>
              <p className="text-sm text-gray-500 mt-1">
                Execute a trade signal or let Auto-Pilot place simulated/live orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/80 shadow-sm">
              <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Order ID / Time</th>
                    <th className="px-4 py-3">Symbol</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Qty</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Execution Mode</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 font-mono">
                  {orders.map((o) => {
                    const isBuy = o.transactiontype === 'BUY';
                    const isPaper = o.orderid.startsWith('PAPER_');

                    return (
                      <tr key={o.orderid} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{o.orderid}</div>
                          <div className="text-[10px] text-gray-500">{o.updatetime}</div>
                        </td>
                        <td className="px-4 py-3 font-sans font-semibold text-gray-900 dark:text-white">
                          {o.tradingsymbol}
                          <span className="text-[10px] text-gray-500 ml-1 font-mono">{o.exchange}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              isBuy
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                                : 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                            }`}
                          >
                            {o.transactiontype}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600 dark:text-gray-400">{o.producttype}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white font-mono">{o.quantity}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-900 dark:text-white font-mono">
                          {o.price > 0 ? formatINR(o.price) : 'MARKET'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              o.status === 'complete' || o.orderstatus === 'complete'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300'
                            }`}
                          >
                            {o.status || o.orderstatus || 'SUBMITTED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isPaper
                                ? 'bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                            }`}
                          >
                            {isPaper ? 'PAPER SIM' : 'ANGEL SMARTAPI'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AiOrderBookTab;
