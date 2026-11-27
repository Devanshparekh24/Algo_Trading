import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Square,
  Bot,
  Activity,
  Wallet,
  Radio,
  Wifi,
  WifiOff,
  Search,
  FileText,
  Trash2,
  BarChart2,
  X,
  Calendar,
  Filter,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import TradingViewChart, { type ChartInterval } from '../tradingview/TradingViewChart';
import {
  fetchActivePositions,
  closeActivePosition,
  fetchAiTradeLogs,
  clearAiTradeLogs,
  fetchAiAnalysisLogs,
  clearAiAnalysisLogs,
  fetchAiErrorLogs,
  fetchTradeOrderReport,
  type OrderBookItem,
  type ActiveAiPosition,
  type AiTradeLogItem,
  type AiAnalysisLogItem,
  type AiErrorLogItem,
  type TraderOrderMasterItem,
  type TradeOrderReportSummary,
} from '../../services/aiTradingService';
import { getSocket, type RealtimeTickData } from '../../services/socketService';
import { formatINR } from '../../utils/formatters';

interface AiOrderBookTabProps {
  orders: OrderBookItem[];
  isLoadingOrders: boolean;
  onRefreshOrders: () => void;
  onOpenChart?: (symbol: string) => void;
  activePositions?: ActiveAiPosition[];
  onClosePosition?: (posId: string) => Promise<void> | void;
  onRefreshPositions?: () => Promise<void> | void;
}

type TabType = 'ACTIVE_POSITIONS' | 'ANALYSIS_LOGS' | 'TRADE_LOGS' | 'ERROR_LOGS' | 'BROKER_ORDERS';

// ---------------------------------------------------------------------------
// Live-price overlay hook  –  subscribes to ai_price_tick + fno_tick sockets
// and maintains a per-symbolToken map with flash direction
// ---------------------------------------------------------------------------
function useLivePrices() {
  const [prices, setPrices] = useState<Record<string, RealtimeTickData>>({});
  const [flashes, setFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const [wsConnected, setWsConnected] = useState(false);
  const [tickCount, setTickCount] = useState(0);
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const handleTick = useCallback((tick: RealtimeTickData) => {
    if (!tick.symbolToken) return;
    const key = tick.symbolToken;

    setPrices((prev) => {
      const prevLtp = prev[key]?.ltp;
      // Flash only when price actually changes
      if (prevLtp !== undefined && prevLtp !== tick.ltp) {
        const dir = tick.ltp > prevLtp ? 'up' : 'down';
        setFlashes((f) => ({ ...f, [key]: dir }));
        if (flashTimers.current[key]) clearTimeout(flashTimers.current[key]);
        flashTimers.current[key] = setTimeout(() => {
          setFlashes((f) => {
            const copy = { ...f };
            delete copy[key];
            return copy;
          });
        }, 700);
      }
      return { ...prev, [key]: tick };
    });
    setTickCount((n) => n + 1);
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onConnect = () => setWsConnected(true);
    const onDisconnect = () => setWsConnected(false);

    setWsConnected(socket.connected);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('ai_price_tick', handleTick);
    socket.on('fno_tick', handleTick);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('ai_price_tick', handleTick);
      socket.off('fno_tick', handleTick);
      Object.values(flashTimers.current).forEach(clearTimeout);
    };
  }, [handleTick]);

  return { prices, flashes, wsConnected, tickCount };
}

// ---------------------------------------------------------------------------
// Live LTP cell component
// ---------------------------------------------------------------------------
interface LiveLtpCellProps {
  token?: string;
  fallbackPrice?: number;
  livePrices: Record<string, RealtimeTickData>;
  flashes: Record<string, 'up' | 'down'>;
  className?: string;
}

const LiveLtpCell: React.FC<LiveLtpCellProps> = ({ token, fallbackPrice, livePrices, flashes, className = '' }) => {
  const tick = token ? livePrices[token] : undefined;
  const ltp = tick?.ltp ?? fallbackPrice ?? 0;
  const flash = token ? flashes[token] : undefined;

  return (
    <span
      className={`font-bold font-mono transition-colors duration-200 ${
        flash === 'up'
          ? 'text-emerald-500 dark:text-emerald-400'
          : flash === 'down'
          ? 'text-rose-500 dark:text-rose-400'
          : className || 'text-gray-900 dark:text-white'
      }`}
    >
      ₹{ltp.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    </span>
  );
};

// ---------------------------------------------------------------------------
// Live P&L calculator using real-time LTP
// ---------------------------------------------------------------------------
function computeLivePnl(pos: ActiveAiPosition, livePrice: number | undefined) {
  const ltp = livePrice ?? pos.currentPrice ?? pos.entryPrice;
  const qty = pos.quantity ?? 0;
  const entry = pos.entryPrice ?? 0;
  const isBuy = pos.action === 'BUY';
  const rawPnl = isBuy ? (ltp - entry) * qty : (entry - ltp) * qty;
  const charges = pos.charges ?? 0;
  const netPnl = rawPnl - charges;
  const pnlPct = entry > 0 ? ((rawPnl / (entry * qty)) * 100).toFixed(2) : '0.00';
  return { ltp, netPnl, pnlPct };
}

// ---------------------------------------------------------------------------
// WS Status pill
// ---------------------------------------------------------------------------
const WsStatusPill: React.FC<{ connected: boolean; tickCount: number }> = ({ connected, tickCount }) => (
  <div
    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border ${
      connected
        ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-500/40 dark:text-emerald-400'
        : 'bg-gray-100 border-gray-200 text-gray-500 dark:bg-gray-900 dark:border-gray-700 dark:text-gray-500'
    }`}
    title={connected ? `WebSocket live – ${tickCount} ticks received` : 'WebSocket disconnected'}
  >
    {connected ? (
      <>
        <Wifi className="w-3 h-3" />
        <span className="hidden sm:inline">LIVE WS</span>
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        {tickCount > 0 && <span className="text-emerald-600 dark:text-emerald-500 font-mono">{tickCount}</span>}
      </>
    ) : (
      <>
        <WifiOff className="w-3 h-3" />
        <span className="hidden sm:inline">WS OFF</span>
      </>
    )}
  </div>
);

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export const AiOrderBookTab: React.FC<AiOrderBookTabProps> = ({
  orders,
  isLoadingOrders,
  onRefreshOrders,
  onOpenChart: _onOpenChart,
  activePositions: propsActivePositions,
  onClosePosition: propsOnClosePosition,
  onRefreshPositions: propsOnRefreshPositions,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('ACTIVE_POSITIONS');
  const [localActivePositions, setLocalActivePositions] = useState<ActiveAiPosition[]>([]);
  const activePositions = propsActivePositions ?? localActivePositions;
  const [tradeLogs, setTradeLogs] = useState<AiTradeLogItem[]>([]);
  const [analysisLogs, setAnalysisLogs] = useState<AiAnalysisLogItem[]>([]);
  const [errorLogs, setErrorLogs] = useState<AiErrorLogItem[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [closingPosId, setClosingPosId] = useState<string | null>(null);
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);
  const [auditFilter, setAuditFilter] = useState<'ALL' | 'STATUS' | 'SCANNER' | 'EXECUTION' | 'ERRORS'>('ALL');

  // Interactive TradingView Chart Modal for Active Sniper
  const [chartModalPos, setChartModalPos] = useState<ActiveAiPosition | null>(null);
  const [chartInterval, setChartInterval] = useState<ChartInterval>('5');
  const [modalSecondSectionTab, setModalSecondSectionTab] = useState<'TELEMETRY' | 'UNDERLYING_CHART' | 'ORDER_SPECS'>('TELEMETRY');
  const [modalLayoutMode, setModalLayoutMode] = useState<'SPLIT' | 'CHART_ONLY' | 'SECTION2_ONLY'>('SPLIT');

  // Active Sniper Mode Filter (ALL / PAPER / LIVE)
  const [sniperModeFilter, setSniperModeFilter] = useState<'ALL' | 'PAPER' | 'LIVE'>('ALL');

  // Trade Execution Logs Mode Filter
  const [tradeModeFilter, setTradeModeFilter] = useState<'ALL' | 'PAPER' | 'LIVE'>('ALL');

  // Master-Detail & Date-Range Report States
  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const [reportPreset, setReportPreset] = useState<'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'ALL'>('TODAY');
  const [reportFromDate, setReportFromDate] = useState<string>(getTodayDateStr());
  const [reportToDate, setReportToDate] = useState<string>(getTodayDateStr());
  const [reportStrategyFilter, setReportStrategyFilter] = useState<string>('ALL');
  const [reportUnderlyingFilter, setReportUnderlyingFilter] = useState<string>('ALL');
  const [reportStatusFilter, setReportStatusFilter] = useState<'ALL' | 'OPEN' | 'EXITED'>('ALL');
  const [reportSummary, setReportSummary] = useState<TradeOrderReportSummary | null>(null);
  const [traderOrders, setTraderOrders] = useState<TraderOrderMasterItem[]>([]);
  const [activeScanningSlab, setActiveScanningSlab] = useState<number>(0);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [expandedMasterIds, setExpandedMasterIds] = useState<Set<string>>(new Set());

  const handleApplyPreset = (preset: 'TODAY' | 'YESTERDAY' | '7D' | '30D' | 'ALL') => {
    setReportPreset(preset);
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    if (preset === 'TODAY') {
      setReportFromDate(todayStr);
      setReportToDate(todayStr);
    } else if (preset === 'YESTERDAY') {
      const yest = new Date(today);
      yest.setDate(yest.getDate() - 1);
      const yestStr = yest.toISOString().split('T')[0];
      setReportFromDate(yestStr);
      setReportToDate(yestStr);
    } else if (preset === '7D') {
      const d7 = new Date(today);
      d7.setDate(d7.getDate() - 7);
      setReportFromDate(d7.toISOString().split('T')[0]);
      setReportToDate(todayStr);
    } else if (preset === '30D') {
      const d30 = new Date(today);
      d30.setDate(d30.getDate() - 30);
      setReportFromDate(d30.toISOString().split('T')[0]);
      setReportToDate(todayStr);
    } else if (preset === 'ALL') {
      setReportFromDate('');
      setReportToDate('');
    }
  };

  const toggleExpandMaster = (masterId: string) => {
    setExpandedMasterIds((prev) => {
      const next = new Set(prev);
      if (next.has(masterId)) {
        next.delete(masterId);
      } else {
        next.add(masterId);
      }
      return next;
    });
  };

  // Load Institutional Trade Order Report (From Date to To Date)
  const loadTradeOrderReport = useCallback(async () => {
    setIsLoadingReport(true);
    try {
      const res = await fetchTradeOrderReport({
        fromDate: reportFromDate || undefined,
        toDate: reportToDate || undefined,
        mode: tradeModeFilter,
        strategy: reportStrategyFilter !== 'ALL' ? reportStrategyFilter : undefined,
        underlying: reportUnderlyingFilter !== 'ALL' ? reportUnderlyingFilter : undefined,
        status: reportStatusFilter !== 'ALL' ? reportStatusFilter : undefined,
      });
      setReportSummary(res.summary);
      setTraderOrders(res.data || []);
      setActiveScanningSlab(res.activeScanningSlab || 0);
    } catch (err) {
      console.warn('Failed to load trade order report:', err);
    } finally {
      setIsLoadingReport(false);
    }
  }, [reportFromDate, reportToDate, tradeModeFilter, reportStrategyFilter, reportUnderlyingFilter, reportStatusFilter]);

  // Broker Orderbook Mode Filter (ALL / PAPER / LIVE)
  const [orderbookModeFilter, setOrderbookModeFilter] = useState<'ALL' | 'PAPER' | 'LIVE'>('ALL');

  // Market Analysis Logs Filters (BUY / SELL / HOLD, Segment, Search)
  const [analysisActionFilter, setAnalysisActionFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'HOLD'>('ALL');
  const [analysisSegmentFilter, setAnalysisSegmentFilter] = useState<'ALL' | 'FNO' | 'EQUITY'>('ALL');
  const [analysisSearchTerm, setAnalysisSearchTerm] = useState('');

  // Live WebSocket prices
  const { prices: livePrices, flashes, wsConnected, tickCount } = useLivePrices();

  // Load Active Positions
  const loadPositions = useCallback(async () => {
    try {
      if (propsOnRefreshPositions) {
        await propsOnRefreshPositions();
      }
      const pos = await fetchActivePositions();
      setLocalActivePositions(pos || []);
    } catch (err) {
      console.warn('Failed to load active positions:', err);
    }
  }, [propsOnRefreshPositions]);

  // Load Database Trade Logs (strictly BUY/SELL executed trades)
  const loadTradeLogs = useCallback(async () => {
    try {
      const logs = await fetchAiTradeLogs(100, undefined, tradeModeFilter);
      setTradeLogs(logs || []);
    } catch (err) {
      console.warn('Failed to load database trade logs:', err);
    }
  }, [tradeModeFilter]);

  // Load Database Analysis Logs (Technical scanning evaluations)
  const loadAnalysisLogs = useCallback(async () => {
    try {
      const logs = await fetchAiAnalysisLogs(100, analysisSegmentFilter, analysisActionFilter);
      setAnalysisLogs(logs || []);
    } catch (err) {
      console.warn('Failed to load database analysis logs:', err);
    }
  }, [analysisSegmentFilter, analysisActionFilter]);

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
      await Promise.all([loadPositions(), loadTradeLogs(), loadAnalysisLogs(), loadErrorLogs(), loadTradeOrderReport()]);
      onRefreshOrders();
    } finally {
      setIsLoadingData(false);
    }
  }, [loadPositions, loadTradeLogs, loadAnalysisLogs, loadErrorLogs, loadTradeOrderReport, onRefreshOrders]);

  useEffect(() => {
    handleRefreshAll();
  }, [handleRefreshAll]);

  useEffect(() => {
    loadTradeLogs();
  }, [loadTradeLogs]);

  useEffect(() => {
    loadTradeOrderReport();
  }, [loadTradeOrderReport]);

  useEffect(() => {
    loadAnalysisLogs();
  }, [loadAnalysisLogs]);

  // Listen to live socket events for active positions, exits, and analysis logs
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handlePositionsUpdate = (positions: ActiveAiPosition[]) => {
      if (Array.isArray(positions)) {
        setLocalActivePositions(positions);
      }
    };

    const handleAutoExitExecuted = () => {
      loadPositions();
      loadTradeLogs();
      loadTradeOrderReport();
      onRefreshOrders();
    };

    const handleAutoTradeExecuted = () => {
      loadPositions();
      loadTradeLogs();
      loadTradeOrderReport();
      onRefreshOrders();
    };

    const handleAnalysisLogged = () => {
      loadAnalysisLogs();
    };

    socket.on('ai_positions_update', handlePositionsUpdate);
    socket.on('ai_position_opened', loadPositions);
    socket.on('ai_auto_exit_executed', handleAutoExitExecuted);
    socket.on('ai_auto_trade_executed', handleAutoTradeExecuted);
    socket.on('ai_trade_logged', () => {
      loadTradeLogs();
      loadTradeOrderReport();
    });
    socket.on('ai_analysis_logged', handleAnalysisLogged);
    socket.on('ai_autopilot_status_changed', loadErrorLogs);
    socket.on('ai_scanner_activity', loadErrorLogs);

    return () => {
      socket.off('ai_positions_update', handlePositionsUpdate);
      socket.off('ai_position_opened', loadPositions);
      socket.off('ai_auto_exit_executed', handleAutoExitExecuted);
      socket.off('ai_auto_trade_executed', handleAutoTradeExecuted);
      socket.off('ai_trade_logged', loadTradeLogs);
      socket.off('ai_analysis_logged', handleAnalysisLogged);
      socket.off('ai_autopilot_status_changed', loadErrorLogs);
      socket.off('ai_scanner_activity', loadErrorLogs);
    };
  }, [loadPositions, loadTradeLogs, loadTradeOrderReport, loadAnalysisLogs, onRefreshOrders]);

  // Manual 1-Click Close Position
  const handleClosePosition = async (id: string) => {
    setClosingPosId(id);
    try {
      if (propsOnClosePosition) {
        await propsOnClosePosition(id);
      } else {
        await closeActivePosition(id);
      }
      await loadPositions();
      await loadTradeLogs();
      onRefreshOrders();
    } catch (err) {
      console.error('Failed to close active position:', err);
    } finally {
      setClosingPosId(null);
    }
  };

  const handleClearAnalysis = async () => {
    if (!window.confirm('Clear all historical AI market analysis logs?')) return;
    try {
      await clearAiAnalysisLogs();
      setAnalysisLogs([]);
    } catch (err) {
      console.error('Failed to clear analysis logs:', err);
    }
  };

  const openPositions = activePositions.filter((p) => p.status === 'OPEN');
  const openPositionsCount = openPositions.length;
  const paperOpenCount = openPositions.filter((p) => p.mode === 'PAPER').length;
  const liveOpenCount = openPositions.filter((p) => p.mode === 'LIVE').length;
  const filteredSniperPositions = openPositions.filter((p) => {
    if (sniperModeFilter === 'ALL') return true;
    return p.mode === sniperModeFilter;
  });

  const filteredAnalysisLogs = analysisLogs.filter((log) => {
    if (!analysisSearchTerm) return true;
    const term = analysisSearchTerm.toLowerCase();
    return (
      log.symbol.toLowerCase().includes(term) ||
      (log.token && log.token.includes(term)) ||
      (log.aiThesisSummary && log.aiThesisSummary.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-5">
      {/* Tab Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-gray-200 dark:border-gray-800 transition-colors">
        <div>
          <h2 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            <span>Greek Momentum Sniper: Execution &amp; Audit Deck</span>
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
              onClick={() => setActiveTab('ANALYSIS_LOGS')}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all ${
                activeTab === 'ANALYSIS_LOGS'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Analysis Logs</span>
              {analysisLogs.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-400/40">
                  {analysisLogs.length}
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
              <span>Trade Orders &amp; Report</span>
              {(traderOrders.length > 0 || tradeLogs.length > 0) && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200 dark:border-blue-400/40">
                  {traderOrders.length || tradeLogs.length}
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
              <span>Audit &amp; Telemetry Logs</span>
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

          {/* WebSocket Live Status */}
          <WsStatusPill connected={wsConnected} tickCount={tickCount} />

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
      {/* TAB 1: ACTIVE POSITIONS & GREEK SNIPER AUTO-EXIT MONITOR             */}
      {/* ==================================================================== */}
      {activeTab === 'ACTIVE_POSITIONS' && (
        <div className="space-y-4">
          {/* Active Sniper Control & Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-2xs">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Execution Filter:</span>
              <div className="flex items-center p-1 rounded-xl bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setSniperModeFilter('ALL')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    sniperModeFilter === 'ALL'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span>All Modes</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20 text-white">
                    {openPositionsCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSniperModeFilter('PAPER')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    sniperModeFilter === 'PAPER'
                      ? 'bg-sky-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span>Paper Sim</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300">
                    {paperOpenCount}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setSniperModeFilter('LIVE')}
                  className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                    sniperModeFilter === 'LIVE'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <span>Live Broker</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    {liveOpenCount}
                  </span>
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs font-mono text-gray-500 dark:text-gray-400">
              <span>Auto-Exit: SL 22% • Target 50% • Timeout 45m</span>
            </div>
          </div>

          {filteredSniperPositions.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
              <Zap className="w-12 h-12 text-emerald-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">
                {openPositionsCount === 0
                  ? 'No Open AI Sniper Positions'
                  : `No Open Positions in ${sniperModeFilter} Mode`}
              </h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                {openPositionsCount === 0
                  ? 'When Greek Momentum Sniper or Auto-Pilot executes an order, it is monitored here with real-time target (+50%), stop-loss (-22%), and 45-min theta timeout auto-exits.'
                  : `You have ${openPositionsCount} active position(s) in other modes. Switch filter to "All Modes" to see all open positions.`}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredSniperPositions
                .map((pos) => {
                  // Resolve live LTP from WebSocket, fall back to DB price
                  // pos.token is the AngelOne symbolToken used as the WS key
                  const liveTick = pos.token ? livePrices[pos.token] : undefined;
                  const { ltp: liveLtp, netPnl, pnlPct } = computeLivePnl(pos, liveTick?.ltp);
                  const isProfit = netPnl >= 0;
                  const holdingMins = pos.holdingMinutes || 0;
                  const timeoutMins = pos.timeoutMinutes || 45;
                  const timeoutProgress = Math.min(100, Math.round((holdingMins / timeoutMins) * 100));
                  const isClosing = closingPosId === pos.id;
                  const flash = pos.token ? flashes[pos.token] : undefined;

                  // Target / SL distance from live LTP
                  const tgtDist = pos.targetPrice && liveLtp
                    ? (((pos.targetPrice - liveLtp) / liveLtp) * 100).toFixed(1)
                    : null;
                  const slDist = pos.stopLossPrice && liveLtp
                    ? (((liveLtp - pos.stopLossPrice) / liveLtp) * 100).toFixed(1)
                    : null;

                  return (
                    <div
                      key={pos.id}
                      className="p-5 rounded-2xl bg-white dark:bg-gray-900/90 border border-emerald-200 dark:border-emerald-500/30 shadow-xs hover:shadow-md hover:border-emerald-400 dark:hover:border-emerald-500/60 space-y-4 transition-all"
                    >
                      {/* Card Top: Symbol, Action & Strategy */}
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-base text-gray-900 dark:text-white font-mono">{pos.symbol}</span>
                            
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                              {pos.strategy}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 ${
                                pos.mode === 'LIVE'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60'
                              }`}
                            >
                              {pos.mode === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                              {pos.mode === 'LIVE' ? 'LIVE BROKER' : 'PAPER SIM'}
                            </span>
                            {/* Live / Stale badge */}
                            {liveTick ? (
                              <span className="flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-600/40">
                                <Radio className="w-2.5 h-2.5 animate-pulse" />
                                LIVE
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500 border border-gray-200 dark:border-gray-700">
                                CACHED
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 font-mono">
                            Order ID: {pos.orderId} • {pos.quantity} units ({pos.lots} Lot{pos.lots > 1 ? 's' : ''})
                          </div>
                        </div>

                        {/* Live P&L Badge */}
                        <div className="text-right">
                          <div
                            className={`text-lg font-bold font-mono flex items-center justify-end space-x-1 transition-colors duration-300 ${
                              isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                            <span>
                              {isProfit ? '+' : ''}₹{Math.abs(netPnl).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                            </span>
                          </div>
                          <div
                            className={`text-xs font-bold font-mono ${
                              isProfit ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                            }`}
                          >
                            {isProfit ? '+' : ''}{pnlPct}%
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

                      {/* Price Grid – Live LTP via WebSocket */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {/* Entry */}
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] text-gray-500 block">Entry Price</span>
                          <span className="font-bold text-gray-900 dark:text-white font-mono text-sm">
                            ₹{pos.entryPrice}
                          </span>
                        </div>

                        {/* Live LTP */}
                        <div
                          className={`p-2.5 rounded-xl border transition-all duration-200 ${
                            flash === 'up'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-500/50'
                              : flash === 'down'
                              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-500/50'
                              : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'
                          }`}
                        >
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mb-0.5">
                            {liveTick ? (
                              <Radio className="w-2.5 h-2.5 text-emerald-500 animate-pulse shrink-0" />
                            ) : (
                              <span className="inline-block w-2.5 h-2.5" />
                            )}
                            Live LTP
                          </span>
                          <LiveLtpCell
                            token={pos.token}
                            fallbackPrice={pos.currentPrice}
                            livePrices={livePrices}
                            flashes={flashes}
                            className="text-sm"
                          />
                          {liveTick && (
                            <div className={`text-[9px] font-mono mt-0.5 ${(liveTick.change ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'}`}>
                              {(liveTick.change ?? 0) >= 0 ? '+' : ''}₹{(liveTick.change ?? 0).toFixed(2)} ({(liveTick.percentChange ?? 0) >= 0 ? '+' : ''}{(liveTick.percentChange ?? 0).toFixed(2)}%)
                            </div>
                          )}
                        </div>

                        {/* Peak Price */}
                        <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] text-gray-500 block">Peak Price</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono text-sm">
                            ₹{(pos.peakPrice || pos.highestPrice || pos.currentPrice || 0).toFixed(2)}
                          </span>
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

                      {/* Auto-Exit Targets & Live Distance Bars */}
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          {/* Target */}
                          <div className="flex-1">
                            <div className="text-[10px] text-gray-500 mb-1">🎯 Target ₹{pos.targetPrice}</div>
                            {tgtDist !== null && (
                              <div className="flex items-center gap-1.5">
                                <div className="flex-1 h-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 overflow-hidden">
                                  <div
                                    className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                    style={{ width: `${Math.min(100, Math.max(0, 100 - parseFloat(tgtDist)))}%` }}
                                  />
                                </div>
                                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 shrink-0">
                                  {parseFloat(tgtDist) > 0 ? `+${tgtDist}%` : `${tgtDist}%`} away
                                </span>
                              </div>
                            )}
                          </div>

                          {/* Stop Loss */}
                          <div className="flex-1 text-right">
                            <div className="text-[10px] text-gray-500 mb-1">🛡️ SL ₹{pos.stopLossPrice}</div>
                            {slDist !== null && (
                              <div className="flex items-center gap-1.5 justify-end">
                                <span className="text-[10px] font-mono text-rose-600 dark:text-rose-400 shrink-0">
                                  {slDist}% cushion
                                </span>
                                <div className="flex-1 h-1.5 rounded-full bg-rose-100 dark:bg-rose-950/60 overflow-hidden">
                                  <div
                                    className="h-full bg-rose-500 rounded-full transition-all duration-500 ml-auto"
                                    style={{ width: `${Math.min(100, Math.max(0, parseFloat(slDist) * 5))}%` }}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Position Action Bar: Open Chart Screen & Exit */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                          <button
                            type="button"
                            onClick={() => setChartModalPos(pos)}
                            className="flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-600/25 transition-all"
                            title={`Open dedicated chart & live info screen for ${pos.symbol}`}
                          >
                            <BarChart2 className="w-4 h-4" />
                            <span>Open Position Chart Screen</span>
                          </button>

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
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 2: AI MARKET ANALYSIS LOGS                                        */}
      {/* ==================================================================== */}
      {activeTab === 'ANALYSIS_LOGS' && (
        <div className="space-y-4">
          {/* Header Controls: Search, Filters & Counters */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 bg-white dark:bg-gray-900/90 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Filter by symbol, token, or thesis..."
                  value={analysisSearchTerm}
                  onChange={(e) => setAnalysisSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 rounded-xl focus:outline-hidden focus:ring-1 focus:ring-indigo-500 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Segment Filter */}
              <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] font-semibold">
                {(['ALL', 'FNO', 'EQUITY'] as const).map((seg) => (
                  <button
                    key={seg}
                    type="button"
                    onClick={() => setAnalysisSegmentFilter(seg)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      analysisSegmentFilter === seg
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {seg}
                  </button>
                ))}
              </div>

              {/* Action Filter */}
              <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] font-semibold">
                {(['ALL', 'BUY', 'SELL', 'HOLD'] as const).map((act) => (
                  <button
                    key={act}
                    type="button"
                    onClick={() => setAnalysisActionFilter(act)}
                    className={`px-2.5 py-1 rounded-md transition-all ${
                      analysisActionFilter === act
                        ? act === 'BUY'
                          ? 'bg-emerald-600 text-white'
                          : act === 'SELL'
                          ? 'bg-rose-600 text-white'
                          : 'bg-indigo-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    {act}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={loadAnalysisLogs}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingData ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>

              {analysisLogs.length > 0 && (
                <button
                  type="button"
                  onClick={handleClearAnalysis}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800/40 transition-all"
                  title="Clear all analysis logs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Analysis Logs Table */}
          {filteredAnalysisLogs.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
              <FileText className="w-12 h-12 text-indigo-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No Market Analysis Logs Found</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                Every market scanner evaluation and strike analysis is logged here in PostgreSQL. When the AI scans F&O and Equity universes, multi-factor confluences and options Greeks will populate this table.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-sm">
              <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Symbol &amp; Contract</th>
                    <th className="px-4 py-3">Analyzed Time</th>
                    <th className="px-4 py-3 text-center">AI Action</th>
                    <th className="px-4 py-3 text-center">Confidence</th>
                    <th className="px-4 py-3 text-right">Price / Targets</th>
                    <th className="px-4 py-3 text-center">Indicators Confluence</th>
                    <th className="px-4 py-3 text-center">Option Greeks</th>
                    <th className="px-4 py-3">AI Thesis Summary</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80">
                  {filteredAnalysisLogs.map((log) => {
                    const isBuy = log.action === 'BUY';
                    const isSell = log.action === 'SELL';
                    const dateObj = new Date(log.createdAt);
                    const timeStr = dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    const dateStr = dateObj.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

                    return (
                      <tr key={log.id} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
                            <span>{log.symbol}</span>
                            {log.contractType && (
                              <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold ${
                                log.contractType === 'CE'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : log.contractType === 'PE'
                                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  : 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              }`}>
                                {log.contractType} {log.strike ? log.strike : ''}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-gray-500 flex items-center gap-2 mt-0.5 font-mono">
                            <span>{log.segment}</span>
                            {log.expiry && <span>Exp: {log.expiry}</span>}
                            <span>T: {log.token}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 font-mono">
                          <div className="font-semibold text-gray-900 dark:text-white">{timeStr}</div>
                          <div className="text-[10px] text-gray-500 font-sans flex items-center gap-1">
                            <span>{dateStr}</span>
                            <span className="px-1 py-0.2 rounded text-[9px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
                              {log.source}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2.5 py-1 rounded-md font-bold text-[11px] inline-flex items-center gap-1 ${
                            isBuy
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                              : isSell
                              ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                              : 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                          }`}>
                            {isBuy && <TrendingUp className="w-3 h-3" />}
                            {isSell && <TrendingDown className="w-3 h-3" />}
                            <span>{log.action}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          <div className="inline-flex items-center gap-1.5">
                            <span className="font-bold text-gray-900 dark:text-white">{log.confidence}%</span>
                            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  log.confidence >= 75 ? 'bg-emerald-500' : log.confidence >= 55 ? 'bg-blue-500' : 'bg-amber-500'
                                }`}
                                style={{ width: `${log.confidence}%` }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-mono">
                          <div className="text-gray-900 dark:text-white font-bold">₹{log.currentPrice.toFixed(2)}</div>
                          <div className="text-[10px] text-gray-500 flex items-center justify-end gap-1.5 mt-0.5">
                            {log.target1 && <span className="text-emerald-600 dark:text-emerald-400 font-semibold">T1: ₹{log.target1}</span>}
                            {log.stopLoss && <span className="text-rose-600 dark:text-rose-400 font-semibold">SL: ₹{log.stopLoss}</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex flex-col items-center gap-0.5 font-mono text-[10px]">
                            {log.rsi !== null && log.rsi !== undefined && (
                              <span className={log.rsi > 70 ? 'text-rose-500 font-bold' : log.rsi < 30 ? 'text-emerald-500 font-bold' : 'text-gray-600 dark:text-gray-300'}>
                                RSI: {log.rsi.toFixed(1)}
                              </span>
                            )}
                            {log.emaTrend && (
                              <span className={log.emaTrend.includes('BULLISH') ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-rose-600 dark:text-rose-400 font-semibold'}>
                                {log.emaTrend}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center font-mono">
                          {log.delta !== null && log.delta !== undefined ? (
                            <div className="text-[10px] space-x-1 text-gray-700 dark:text-gray-300">
                              <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Δ{log.delta.toFixed(2)}</span>
                              <span className="text-blue-600 dark:text-blue-400">Γ{log.gamma?.toFixed(3) || '0'}</span>
                              <span className="text-rose-600 dark:text-rose-400">Θ{log.theta?.toFixed(1) || '0'}</span>
                              {log.iv && <span className="text-purple-600 dark:text-purple-400">IV:{log.iv.toFixed(0)}%</span>}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 max-w-xs font-sans">
                          <p className="text-xs text-gray-700 dark:text-gray-300 line-clamp-2" title={log.aiThesisSummary || ''}>
                            {log.aiThesisSummary || 'Multi-factor technical scan confluence.'}
                          </p>
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
      {/* TAB 3: INSTITUTIONAL TRADE ORDER MASTER-DETAIL & DATE-RANGE REPORT     */}
      {/* ==================================================================== */}
      {activeTab === 'TRADE_LOGS' && (
        <div className="space-y-4">
          {/* 1. Date Range & Report Filters Command Bar */}
          <div className="p-4 bg-white dark:bg-gray-900/90 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs space-y-3">
            {/* Top row: Date Presets & Custom Pickers */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 flex-wrap">
              {/* Presets */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  Date Range:
                </span>
                <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] font-semibold">
                  {(['TODAY', 'YESTERDAY', '7D', '30D', 'ALL'] as const).map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => handleApplyPreset(preset)}
                      className={`px-3 py-1 rounded-md transition-all ${
                        reportPreset === preset
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {preset === 'TODAY'
                        ? 'Today'
                        : preset === 'YESTERDAY'
                        ? 'Yesterday'
                        : preset === '7D'
                        ? 'Last 7D'
                        : preset === '30D'
                        ? 'Last 30D'
                        : 'All Time'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Date Pickers & Search Button */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-gray-500 dark:text-gray-400">From:</span>
                  <input
                    type="date"
                    value={reportFromDate}
                    onChange={(e) => {
                      setReportFromDate(e.target.value);
                      setReportPreset('ALL');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono">
                  <span className="text-gray-500 dark:text-gray-400">To:</span>
                  <input
                    type="date"
                    value={reportToDate}
                    onChange={(e) => {
                      setReportToDate(e.target.value);
                      setReportPreset('ALL');
                    }}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 text-xs focus:ring-1 focus:ring-blue-500 outline-hidden"
                  />
                </div>
                <button
                  type="button"
                  onClick={loadTradeOrderReport}
                  className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1"
                >
                  <Filter className="w-3 h-3" />
                  <span>Apply</span>
                </button>
              </div>
            </div>

            {/* Bottom row: Mode, Underlying, Status & Slab Visibility */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex-wrap">
              <div className="flex items-center gap-3 flex-wrap">
                {/* Mode Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Mode:</span>
                  <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] font-semibold">
                    <button
                      type="button"
                      onClick={() => setTradeModeFilter('ALL')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        tradeModeFilter === 'ALL'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      ALL
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeModeFilter('PAPER')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        tradeModeFilter === 'PAPER'
                          ? 'bg-sky-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      PAPER
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeModeFilter('LIVE')}
                      className={`px-2.5 py-1 rounded-md transition-all ${
                        tradeModeFilter === 'LIVE'
                          ? 'bg-amber-600 text-white shadow-xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      LIVE BROKER
                    </button>
                  </div>
                </div>

                {/* Underlying Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Index:</span>
                  <select
                    value={reportUnderlyingFilter}
                    onChange={(e) => setReportUnderlyingFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="ALL">All Underlyings</option>
                    <option value="NIFTY">NIFTY 50</option>
                    <option value="BANKNIFTY">BANK NIFTY</option>
                    <option value="FINNIFTY">FIN NIFTY</option>
                  </select>
                </div>

                {/* Strategy Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Strategy:</span>
                  <select
                    value={reportStrategyFilter}
                    onChange={(e) => setReportStrategyFilter(e.target.value)}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="ALL">All Strategies</option>
                    <option value="GREEK_SNIPER">GREEK_SNIPER</option>
                    <option value="MOMENTUM_BREAKOUT">MOMENTUM_BREAKOUT</option>
                    <option value="ORB_BREAKOUT">ORB_BREAKOUT</option>
                    <option value="SCALPER_9_20">SCALPER_9_20</option>
                    <option value="EXPIRY_SPECIAL">EXPIRY_SPECIAL</option>
                  </select>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Status:</span>
                  <select
                    value={reportStatusFilter}
                    onChange={(e) => setReportStatusFilter(e.target.value as any)}
                    className="px-2.5 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 text-xs font-semibold focus:ring-1 focus:ring-blue-500 outline-hidden"
                  >
                    <option value="ALL">All Status</option>
                    <option value="EXITED">Closed Only</option>
                    <option value="OPEN">Open Only</option>
                  </select>
                </div>
              </div>

              {/* Right side: Active Scanning Slab & Actions */}
              <div className="flex items-center gap-2">
                {/* Active Working Slab Indicator */}
                <div
                  className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs font-mono font-bold shadow-2xs"
                  title="Current Active Working Budget Slab used for Market Scanning & Trade Sizing"
                >
                  <span>💰 Scanning Slab:</span>
                  <span className="underline decoration-emerald-500">
                    {activeScanningSlab > 0 ? `₹${activeScanningSlab.toLocaleString('en-IN')}` : 'Dynamic'}
                  </span>
                </div>

                {/* Clear Paper Logs */}
                <button
                  type="button"
                  onClick={async () => {
                    if (window.confirm('Delete all historical simulated paper trade orders? Live broker orders are never touched.')) {
                      await clearAiTradeLogs('PAPER');
                      loadTradeOrderReport();
                      loadTradeLogs();
                    }
                  }}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 text-xs font-semibold border border-rose-200 dark:border-rose-800/40 transition-all"
                  title="Clear simulated paper records from database"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear Paper</span>
                </button>

                {/* Refresh Button */}
                <button
                  type="button"
                  onClick={loadTradeOrderReport}
                  className="flex items-center gap-1 px-3 py-1 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingReport ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>
          </div>

          {/* 2. Institutional Performance Summary Analytics Dashboard */}
          {reportSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1: Net Realized P&L */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-xs relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Net Realized P&amp;L
                  </span>
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      reportSummary.netPnL >= 0
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                    }`}
                  >
                    PF: {reportSummary.profitFactor >= 99 ? '∞' : reportSummary.profitFactor}
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span
                    className={`text-2xl font-black font-mono tracking-tight ${
                      reportSummary.netPnL >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {reportSummary.netPnL >= 0 ? '+' : ''}₹{reportSummary.netPnL.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between text-[11px] font-mono text-gray-500">
                  <span>Gross: ₹{reportSummary.grossPnL.toLocaleString('en-IN')}</span>
                  <span>Charges: ₹{reportSummary.totalCharges.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Card 2: Win Rate & Orders */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Win Rate &amp; Efficiency
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                    {reportSummary.totalOrders} Total Orders
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 tracking-tight">
                    {reportSummary.winRatePct}%
                  </span>
                  <span className="text-xs text-gray-500">({reportSummary.closedOrders} closed)</span>
                </div>
                {/* Progress bar */}
                <div className="mt-2 w-full bg-gray-100 dark:bg-gray-800 h-1.5 rounded-full overflow-hidden flex">
                  <div
                    className="bg-emerald-500 h-full transition-all"
                    style={{ width: `${reportSummary.winRatePct}%` }}
                  />
                  <div
                    className="bg-rose-500 h-full transition-all"
                    style={{ width: `${100 - reportSummary.winRatePct}%` }}
                  />
                </div>
                <div className="mt-2 flex items-center justify-between text-[11px] font-mono">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">{reportSummary.winTrades} Wins</span>
                  <span className="text-rose-600 dark:text-rose-400 font-bold">{reportSummary.lossTrades} Losses</span>
                  {reportSummary.openOrders > 0 && (
                    <span className="text-amber-500 font-semibold">{reportSummary.openOrders} Open</span>
                  )}
                </div>
              </div>

              {/* Card 3: Best Win & Max Drawdown */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Max Profit &amp; Drawdown
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                    ⏱ {reportSummary.avgHoldingMinutes}m Avg Hold
                  </span>
                </div>
                <div className="mt-2 space-y-1 font-mono">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                      Peak Win:
                    </span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">
                      +₹{reportSummary.maxProfit.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500 flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                      Max Loss:
                    </span>
                    <span className="font-bold text-rose-600 dark:text-rose-400">
                      ₹{reportSummary.maxDrawdown.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-800/80 text-[10px] text-gray-400">
                  Risk bounds strictly enforced per underlying
                </div>
              </div>

              {/* Card 4: Active Scanning Slab & Allocation */}
              <div className="p-4 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Working Slab Budget
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    Scanning
                  </span>
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 tracking-tight">
                    {activeScanningSlab > 0 ? `₹${activeScanningSlab.toLocaleString('en-IN')}` : 'Dynamic'}
                  </span>
                  <span className="text-xs text-gray-500">per strike</span>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  {Object.entries(reportSummary.bySlab || {}).slice(0, 3).map(([k, v]) => (
                    <span
                      key={k}
                      className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
                    >
                      {k}: {v.count} ({v.winRate}%)
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* 3. Master-Detail Orders Table */}
          {traderOrders.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
              <Database className="w-12 h-12 text-blue-500/40 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">No Orders Found for Selected Range</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto mt-1 leading-relaxed">
                No orders match your selected Date Range ({reportFromDate || 'Start'} to {reportToDate || 'Now'}) and filters. Try selecting 'Today' or 'All Time' presets above.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/90 shadow-sm">
              <table className="w-full text-left text-xs text-gray-700 dark:text-gray-300">
                <thead className="bg-gray-50 dark:bg-gray-950 text-gray-600 dark:text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="px-4 py-3">Order / Time</th>
                    <th className="px-4 py-3">Symbol &amp; Strategy</th>
                    <th className="px-4 py-3 text-center">Mode</th>
                    <th className="px-4 py-3 text-center">Scanning Slab</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3 text-right">Entry / Target / SL</th>
                    <th className="px-4 py-3 text-center">Greeks at Entry</th>
                    <th className="px-4 py-3 text-center">Status / Exit Reason</th>
                    <th className="px-4 py-3 text-right">Net P&amp;L</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 font-mono">
                  {traderOrders.map((order) => {
                    const isBuy = order.action === 'BUY';
                    const net = order.netPnl != null ? order.netPnl : (order.pnl || 0) - (order.charges || 0);
                    const isProfit = net >= 0;
                    const isOpen = order.status === 'OPEN';
                    const isExpanded = expandedMasterIds.has(order.masterOrderId);
                    const enteredDate = new Date(order.enteredAt);
                    const dateFormatted = enteredDate.toLocaleDateString('en-IN', {
                      day: '2-digit',
                      month: 'short',
                    });
                    const timeFormatted = enteredDate.toLocaleTimeString('en-IN', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    });

                    return (
                      <React.Fragment key={order.masterOrderId || order.id}>
                        {/* Parent Master Row */}
                        <tr
                          onClick={() => toggleExpandMaster(order.masterOrderId)}
                          className={`hover:bg-blue-50/50 dark:hover:bg-blue-950/20 cursor-pointer transition-colors ${
                            isOpen ? 'bg-emerald-50/15 dark:bg-emerald-950/20' : ''
                          }`}
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <span className="text-gray-400 hover:text-blue-500 transition-colors">
                                {isExpanded ? (
                                  <ChevronDown className="w-3.5 h-3.5 text-blue-500" />
                                ) : (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                )}
                              </span>
                              <div>
                                <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1">
                                  <span>{order.masterOrderId}</span>
                                  {order.details && order.details.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded text-[9px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 font-sans">
                                      {order.details.length} legs
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-gray-500 font-sans">
                                  {dateFormatted} • {timeFormatted}
                                </div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-3 font-sans">
                            <div className="font-bold text-gray-900 dark:text-white">{order.symbol}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 font-mono">
                                {order.strategy}
                              </span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                {order.quantity} qty ({order.lots} lot{order.lots === 1 ? '' : 's'})
                              </span>
                            </div>
                          </td>

                          <td className="px-4 py-3 text-center font-sans">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1 ${
                                order.mode === 'LIVE'
                                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border border-amber-300 dark:border-amber-700/60'
                                  : 'bg-sky-100 text-sky-800 dark:bg-sky-950/80 dark:text-sky-300 border border-sky-300 dark:border-sky-700/60'
                              }`}
                            >
                              {order.mode === 'LIVE' && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                              {order.mode === 'LIVE' ? 'LIVE' : 'PAPER'}
                            </span>
                          </td>

                          <td className="px-3 py-3 text-center font-sans">
                            <span className="text-[10px] px-2 py-0.5 rounded font-mono font-bold bg-emerald-50 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                              {order.slabAmount && order.slabAmount > 0 ? `₹${order.slabAmount.toLocaleString('en-IN')}` : 'Dynamic'}
                            </span>
                          </td>

                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                isBuy
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                                  : 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                              }`}
                            >
                              {order.action} {order.contractType || ''}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right font-mono">
                            <div className="text-gray-900 dark:text-white font-bold">
                              ₹{order.entryPrice.toFixed(2)}
                            </div>
                            <div className="text-[10px] text-gray-500 dark:text-gray-400">
                              T: ₹{order.targetPrice?.toFixed(2) || '—'} • SL: ₹{order.stopLossPrice?.toFixed(2) || '—'}
                            </div>
                            {order.peakPrice !== undefined && order.peakPrice > 0 && (
                              <div className="text-[9px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                Peak: ₹{order.peakPrice.toFixed(2)}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            {order.delta !== null && order.delta !== undefined ? (
                              <div className="text-[10px] space-x-1 font-mono text-gray-700 dark:text-gray-300">
                                <span className="text-emerald-600 dark:text-emerald-400">Δ{order.delta.toFixed(2)}</span>
                                <span className="text-blue-600 dark:text-blue-400">Γ{order.gamma?.toFixed(3) || '0'}</span>
                                <span className="text-rose-600 dark:text-rose-400">θ{order.theta?.toFixed(1) || '0'}</span>
                              </div>
                            ) : (
                              <span className="text-gray-400 text-[10px]">—</span>
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                order.status === 'OPEN'
                                  ? 'bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800 animate-pulse'
                                  : order.exitReason === 'TARGET'
                                  ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30'
                                  : order.exitReason === 'STOP_LOSS'
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30'
                                  : order.exitReason === 'THETA_TIMEOUT'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30'
                                  : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              {order.status === 'OPEN'
                                ? 'Active / Open'
                                : order.exitReason === 'TARGET'
                                ? 'Target Hit'
                                : order.exitReason === 'STOP_LOSS'
                                ? 'Stop-Loss'
                                : order.exitReason === 'THETA_TIMEOUT'
                                ? 'Theta Timeout'
                                : 'Closed'}
                            </span>
                            {order.exitPrice && (
                              <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                                @ ₹{order.exitPrice.toFixed(2)}
                              </div>
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            {order.pnl !== null && order.pnl !== undefined ? (
                              <div>
                                <div
                                  className={`font-bold text-sm ${
                                    isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                                  }`}
                                >
                                  {isProfit ? '+' : ''}₹{net.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                                {order.pnlPercent !== null && (
                                  <div
                                    className={`text-[10px] font-semibold ${
                                      isProfit ? 'text-emerald-600 dark:text-emerald-500' : 'text-rose-600 dark:text-rose-500'
                                    }`}
                                  >
                                    {isProfit ? '+' : ''}{order.pnlPercent}%
                                  </div>
                                )}
                                {order.charges !== undefined && order.charges > 0 && (
                                  <div className="text-[9px] text-gray-400 font-normal mt-0.5">
                                    Charges: ₹{order.charges.toFixed(2)}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400 text-xs">—</span>
                            )}
                          </td>
                        </tr>

                        {/* Child Expandable Execution Legs View (TradeOrderDetail) */}
                        {isExpanded && (
                          <tr className="bg-blue-50/30 dark:bg-blue-950/20 border-b border-gray-200 dark:border-gray-800">
                            <td colSpan={9} className="px-6 py-4">
                              <div className="rounded-xl border border-blue-200 dark:border-blue-900/50 bg-white dark:bg-gray-900/90 p-4 shadow-2xs space-y-3">
                                <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-2">
                                  <div className="flex items-center gap-2">
                                    <Layers className="w-4 h-4 text-blue-500" />
                                    <span className="text-xs font-bold uppercase tracking-wider text-gray-800 dark:text-gray-200">
                                      Execution Legs Breakdown ({order.details?.length || 0} Leg{order.details?.length === 1 ? '' : 's'})
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2 text-[11px] text-gray-500 font-mono">
                                    <span>Master Ref: {order.masterOrderId}</span>
                                    <span>•</span>
                                    <span>Scanning Slab: {order.slabAmount ? `₹${order.slabAmount.toLocaleString('en-IN')}` : 'Dynamic'}</span>
                                  </div>
                                </div>

                                {(!order.details || order.details.length === 0) ? (
                                  <div className="text-xs text-gray-400 py-3 italic text-center">
                                    Single direct execution leg (no separate child order details).
                                  </div>
                                ) : (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs font-mono">
                                      <thead className="text-[10px] uppercase text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                                        <tr>
                                          <th className="py-2 px-3">Leg Type</th>
                                          <th className="py-2 px-3">Action</th>
                                          <th className="py-2 px-3">Quantity &amp; Lots</th>
                                          <th className="py-2 px-3 text-right">Fill Price</th>
                                          <th className="py-2 px-3 text-right">Trigger Price</th>
                                          <th className="py-2 px-3 text-center">Status</th>
                                          <th className="py-2 px-3 text-right">Charges</th>
                                          <th className="py-2 px-3 text-center">Execution Time</th>
                                          <th className="py-2 px-3 text-right">Order Leg ID</th>
                                        </tr>
                                      </thead>
                                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                        {order.details.map((leg) => {
                                          const isEntryLeg = leg.legType === 'ENTRY';
                                          const isTargetLeg = leg.legType === 'TARGET';
                                          const isStopLossLeg = leg.legType === 'STOP_LOSS';
                                          const legDate = new Date(leg.executedAt);
                                          const legTimeStr = legDate.toLocaleTimeString('en-IN', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                            second: '2-digit',
                                          });

                                          return (
                                            <tr key={leg.id || leg.orderId} className="hover:bg-gray-50 dark:hover:bg-gray-800/40">
                                              <td className="py-2 px-3 font-sans">
                                                <span
                                                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                    isEntryLeg
                                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300'
                                                      : isTargetLeg
                                                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300'
                                                      : isStopLossLeg
                                                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300'
                                                      : 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300'
                                                  }`}
                                                >
                                                  {leg.legType}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3">
                                                <span
                                                  className={`font-bold ${
                                                    leg.action === 'BUY'
                                                      ? 'text-emerald-600 dark:text-emerald-400'
                                                      : 'text-rose-600 dark:text-rose-400'
                                                  }`}
                                                >
                                                  {leg.action}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-gray-700 dark:text-gray-300">
                                                {leg.quantity} qty ({leg.lots} lot{leg.lots === 1 ? '' : 's'})
                                              </td>
                                              <td className="py-2 px-3 text-right font-bold text-gray-900 dark:text-white">
                                                ₹{leg.price.toFixed(2)}
                                              </td>
                                              <td className="py-2 px-3 text-right text-gray-500">
                                                {leg.triggerPrice ? `₹${leg.triggerPrice.toFixed(2)}` : '—'}
                                              </td>
                                              <td className="py-2 px-3 text-center">
                                                <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40">
                                                  {leg.status}
                                                </span>
                                              </td>
                                              <td className="py-2 px-3 text-right text-gray-500">
                                                ₹{(leg.charges || 0).toFixed(2)}
                                              </td>
                                              <td className="py-2 px-3 text-center text-gray-500 font-sans">
                                                {legTimeStr}
                                              </td>
                                              <td className="py-2 px-3 text-right text-[10px] text-gray-400 font-mono">
                                                {leg.orderId}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ==================================================================== */}
      {/* TAB 3: AUDIT & TELEMETRY LOGS                                        */}
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

                  // If this error/log has a symbol, show its live price too
                  const errToken = err.token || undefined;
                  const errTick = errToken ? livePrices[errToken] : undefined;

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
                              {/* Show live LTP for symbols in audit logs */}
                              {errTick && (
                                <span className={`text-[10px] font-mono font-bold ${(errTick.change ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                  ₹{errTick.ltp.toFixed(2)} ({(errTick.percentChange ?? 0) >= 0 ? '+' : ''}{(errTick.percentChange ?? 0).toFixed(2)}%)
                                </span>
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
      {/* TAB 4: RAW BROKER ORDER BOOK                                         */}
      {/* ==================================================================== */}
      {activeTab === 'BROKER_ORDERS' && (() => {
        const filteredBrokerOrders = orders.filter((o) => {
          if (orderbookModeFilter === 'ALL') return true;
          const isPaper = o.orderid.startsWith('PAPER_');
          return orderbookModeFilter === 'PAPER' ? isPaper : !isPaper;
        });
        const paperOrdersCount = orders.filter((o) => o.orderid.startsWith('PAPER_')).length;
        const liveOrdersCount = orders.length - paperOrdersCount;

        return (
          <div className="space-y-4">
            {/* Broker Orders Mode Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-white dark:bg-gray-900/90 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Order Source:</span>
                <div className="flex items-center p-0.5 rounded-lg bg-gray-100 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => setOrderbookModeFilter('ALL')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      orderbookModeFilter === 'ALL'
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    ALL ({orders.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderbookModeFilter('PAPER')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      orderbookModeFilter === 'PAPER'
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    PAPER SIM ({paperOrdersCount})
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderbookModeFilter('LIVE')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      orderbookModeFilter === 'LIVE'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    SMARTAPI LIVE ({liveOrdersCount})
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={onRefreshOrders}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs font-semibold transition-all self-start sm:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
                <span>Refresh Orderbook</span>
              </button>
            </div>

            {filteredBrokerOrders.length === 0 ? (
              <div className="text-center py-16 bg-white dark:bg-gray-900/40 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-2xs">
                <History className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                <h3 className="text-base font-semibold text-gray-800 dark:text-gray-300">
                  {orders.length === 0 ? 'No Orders in Broker Orderbook' : `No ${orderbookModeFilter} Orders Found`}
                </h3>
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
                    {filteredBrokerOrders.map((o) => {
                      const isBuy = o.transactiontype === 'BUY';
                      const isPaper = o.orderid.startsWith('PAPER_');

                      return (
                        <tr key={o.orderid} className="hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-gray-900 dark:text-white flex items-center gap-1.5 flex-wrap">
                              <span>{o.orderid}</span>
                              {o.uniqueorderid && (
                                <span
                                  className="px-1.5 py-0.2 rounded text-[9px] font-mono bg-purple-50 text-purple-700 dark:bg-purple-950/70 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                  title={`Unique Order ID: ${o.uniqueorderid}`}
                                >
                                  UID: {o.uniqueorderid.length > 14 ? `${o.uniqueorderid.substring(0, 12)}…` : o.uniqueorderid}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-gray-500 mt-0.5">{o.updatetime}</div>
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
                                  ? 'bg-sky-100 text-sky-800 border border-sky-200 dark:bg-sky-500/20 dark:text-sky-300 dark:border-sky-500/30'
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
        );
      })()}
      {/* ==================================================================== */}
      {/* FULLSCREEN TRADINGVIEW CHART MODAL FOR ACTIVE SNIPER POSITIONS      */}
      {/* ==================================================================== */}
      {chartModalPos && (() => {
        const modalTick = chartModalPos.token ? livePrices[chartModalPos.token] : undefined;
        const { ltp: modalLtp, netPnl: modalNetPnl, pnlPct: modalPnlPct } = computeLivePnl(chartModalPos, modalTick?.ltp);
        const isModalProfit = modalNetPnl >= 0;

        const enteredAt = chartModalPos.enteredAt || Date.now();
        const holdingMins = Math.round((Date.now() - enteredAt) / 60000);
        const timeoutMins = chartModalPos.timeoutMinutes || 25;

        const tgtDist = chartModalPos.targetPrice && modalLtp > 0
          ? (((chartModalPos.targetPrice - modalLtp) / modalLtp) * 100).toFixed(1)
          : null;
        const slDist = chartModalPos.stopLossPrice && modalLtp > 0
          ? (((modalLtp - chartModalPos.stopLossPrice) / modalLtp) * 100).toFixed(1)
          : null;

        const thetaPct = Math.min(100, Math.max(0, Math.round((holdingMins / timeoutMins) * 100)));

        const modalClean = chartModalPos.symbol
          .replace(/^NSE:/, '')
          .replace(/^BSE:/, '')
          .replace(/^NFO:/, '')
          .toUpperCase();

        const isBankNifty = modalClean.includes('BANK') || modalClean.includes('BANKNIFTY');
        const modalUnderlyingSymbol = isBankNifty ? 'NSE:BANKBEES' : 'NSE:NIFTYBEES';
        const modalUnderlyingToken = isBankNifty ? '99926009' : '99926000';
        const modalUnderlyingLabel = isBankNifty ? 'BANK NIFTY Spot' : 'NIFTY 50 Spot';

        const modalUnderlyingQuote =
          (modalUnderlyingToken ? livePrices[modalUnderlyingToken] : undefined) ||
          livePrices[modalUnderlyingSymbol];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-black/85 backdrop-blur-md animate-in fade-in">
            <div className="w-full max-w-[96vw] xl:max-w-7xl max-h-[96vh] flex flex-col rounded-2xl bg-gray-950 border border-gray-800 shadow-2xl overflow-hidden">
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gray-900/90 flex-wrap gap-3">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
                    <BarChart2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <h3 className="font-extrabold text-white text-base sm:text-lg font-mono">{chartModalPos.symbol}</h3>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase">
                        {chartModalPos.strategy}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          chartModalPos.mode === 'LIVE'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                            : 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}
                      >
                        {chartModalPos.mode === 'LIVE' ? '🔴 LIVE BROKER' : '📝 PAPER SIM'}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-gray-800 text-gray-300">
                        {chartModalPos.lots || 1} Lot ({chartModalPos.quantity} units)
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 text-xs text-gray-400 mt-1 font-mono flex-wrap">
                      <span>Order: {chartModalPos.orderId}</span>
                      <span>•</span>
                      <span>Entry: <strong className="text-white font-bold">₹{chartModalPos.entryPrice}</strong></span>
                      <span>•</span>
                      <span>Live LTP: <strong className="text-white font-bold">₹{modalLtp}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right: Live P&L, Quick Exit & Close */}
                <div className="flex items-center space-x-3">
                  <div className="text-right font-mono">
                    <div className={`text-base sm:text-lg font-bold flex items-center justify-end space-x-1 ${isModalProfit ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isModalProfit ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                      <span>
                        {isModalProfit ? '+' : ''}₹{Math.abs(modalNetPnl).toFixed(2)} ({isModalProfit ? '+' : ''}{modalPnlPct}%)
                      </span>
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Live Net P&amp;L
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      handleClosePosition(chartModalPos.id);
                      setChartModalPos(null);
                    }}
                    disabled={closingPosId === chartModalPos.id}
                    className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-600/20 disabled:opacity-50 transition-all"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                    <span>{closingPosId === chartModalPos.id ? 'Exiting...' : 'Exit Trade'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChartModalPos(null)}
                    className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                    title="Close chart screen"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Modal Subheader: Telemetry KPIs, Greeks & Timeframe Switcher */}
              <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/60 flex items-center justify-between text-xs flex-wrap gap-2">
                <div className="flex items-center gap-2.5 flex-wrap font-mono text-[11px]">
                  <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
                    🎯 Target: <strong>₹{chartModalPos.targetPrice}</strong> {tgtDist && `(${tgtDist}% away)`}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-500/30">
                    🏔️ Peak: <strong>₹{(chartModalPos.peakPrice || chartModalPos.highestPrice || chartModalPos.entryPrice || 0).toFixed(2)}</strong>
                  </span>
                  <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-500/30">
                    🛡️ SL: <strong>₹{chartModalPos.stopLossPrice}</strong> {slDist && `(${slDist}% cushion)`}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-amber-950/60 text-amber-300 border border-amber-500/30">
                    ⏱️ Theta: <strong>{holdingMins}m / {timeoutMins}m</strong> ({Math.max(0, timeoutMins - holdingMins)}m left)
                  </span>
                  {chartModalPos.greeks && (
                    <>
                      <span className="text-gray-400">Δ: <strong className="text-emerald-400">{chartModalPos.greeks.delta.toFixed(2)}</strong></span>
                      <span className="text-gray-400">Γ: <strong className="text-blue-400">{chartModalPos.greeks.gamma.toFixed(4)}</strong></span>
                      <span className="text-gray-400">Θ: <strong className="text-rose-400">-₹{Math.abs(chartModalPos.greeks.theta).toFixed(1)}/d</strong></span>
                      <span className="text-gray-400">IV: <strong className="text-amber-400">{chartModalPos.greeks.iv.toFixed(1)}%</strong></span>
                    </>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  {/* Layout Mode Selector (2 Sections vs Full Chart) */}
                  <div className="flex items-center space-x-1 bg-gray-950 p-1 rounded-lg border border-gray-800 text-[11px] font-mono">
                    <button
                      type="button"
                      onClick={() => setModalLayoutMode('SPLIT')}
                      className={`px-2 py-0.5 rounded transition-all font-semibold ${
                        modalLayoutMode === 'SPLIT'
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Show both Chart (Section 1) and Telemetry/Spot (Section 2)"
                    >
                      2 Sections
                    </button>
                    <button
                      type="button"
                      onClick={() => setModalLayoutMode('CHART_ONLY')}
                      className={`px-2 py-0.5 rounded transition-all font-semibold ${
                        modalLayoutMode === 'CHART_ONLY'
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-gray-400 hover:text-white'
                      }`}
                      title="Expand Chart to Full Width"
                    >
                      Full Chart
                    </button>
                  </div>

                  {/* Timeframe Duration Selector: Seconds, Minutes, Hours/Days */}
                  <div className="flex items-center space-x-1.5 flex-wrap gap-y-1">
                    {/* Seconds Section */}
                    <div className="flex items-center space-x-0.5 bg-gray-950 p-0.5 rounded-lg border border-emerald-500/40">
                      <span className="text-[10px] font-bold text-emerald-400 px-1 font-mono uppercase">Sec:</span>
                      {(['5s', '10s', '15s', '30s'] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setChartInterval(tf)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-bold transition-all ${
                            chartInterval === tf
                              ? 'bg-emerald-600 text-white shadow-xs'
                              : 'text-gray-400 hover:text-emerald-300 hover:bg-gray-800'
                          }`}
                          title={`${tf} second candles`}
                        >
                          {tf}
                        </button>
                      ))}
                    </div>

                    {/* Minutes Section */}
                    <div className="flex items-center space-x-0.5 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                      <span className="text-[10px] font-bold text-blue-400 px-1 font-mono uppercase">Min:</span>
                      {(['1', '3', '5', '15', '30'] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setChartInterval(tf)}
                          className={`px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${
                            chartInterval === tf
                              ? 'bg-blue-600 text-white shadow-xs'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }`}
                          title={`${tf} minute candles`}
                        >
                          {tf}m
                        </button>
                      ))}
                    </div>

                    {/* Hours/Days */}
                    <div className="flex items-center space-x-0.5 bg-gray-950 p-0.5 rounded-lg border border-gray-800">
                      {(['60', 'D'] as const).map((tf) => (
                        <button
                          key={tf}
                          type="button"
                          onClick={() => setChartInterval(tf)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all ${
                            chartInterval === tf
                              ? 'bg-purple-600 text-white shadow-xs'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800'
                          }`}
                          title={tf === 'D' ? '1 Day candles' : '1 Hour candles'}
                        >
                          {tf === 'D' ? '1D' : '1H'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Body - 2 Sections Grid */}
              <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 overflow-hidden min-h-[580px] max-h-[calc(96vh-140px)]">
                {/* SECTION 1: Active Option Candlestick Chart (Left Pane) */}
                <div
                  className={`p-2 bg-gray-950 flex flex-col border-b lg:border-b-0 lg:border-r border-gray-800 transition-all ${
                    modalLayoutMode === 'SPLIT'
                      ? 'lg:col-span-8 xl:col-span-8 h-[440px] lg:h-auto'
                      : modalLayoutMode === 'CHART_ONLY'
                      ? 'col-span-12 h-full'
                      : 'hidden'
                  }`}
                >
                  <div className="flex items-center justify-between px-2.5 py-1 mb-1 bg-gray-900/70 rounded-xl border border-gray-800 text-xs flex-wrap gap-2 shrink-0">
                    <div className="flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      <span className="font-extrabold text-white font-mono text-[11px] sm:text-xs">
                        Section 1: {chartModalPos.symbol} (Option Candles)
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-950/80 text-blue-300 font-mono font-semibold">
                        LTP: ₹{modalLtp}
                      </span>
                    </div>

                    <span className="text-[10px] text-gray-500 font-mono hidden sm:inline">
                      Primary Interactive Candlestick Engine
                    </span>
                  </div>

                  <div className="flex-1 w-full min-h-[460px] overflow-hidden">
                    <TradingViewChart
                      symbol={chartModalPos.symbol}
                      symbolToken={chartModalPos.token}
                      interval={chartInterval}
                      height="100%"
                      theme="dark"
                      enableStudies={true}
                      showToolbar={true}
                      livePrice={modalLtp}
                      onIntervalChange={(newInt) => setChartInterval(newInt as any)}
                    />
                  </div>
                </div>

                {/* SECTION 2: Trade Telemetry, Greeks, Spot Chart & Orders (Right Pane) */}
                <div
                  className={`p-3 bg-gray-900/95 flex flex-col overflow-y-auto space-y-3 transition-all ${
                    modalLayoutMode === 'SPLIT'
                      ? 'lg:col-span-4 xl:col-span-4'
                      : modalLayoutMode === 'SECTION2_ONLY'
                      ? 'col-span-12'
                      : 'hidden'
                  }`}
                >
                  {/* Section 2 Tab Switcher Header */}
                  <div className="flex items-center justify-between pb-2 border-b border-gray-800 flex-wrap gap-2 shrink-0">
                    <div className="flex items-center space-x-1 p-1 bg-gray-950 rounded-xl border border-gray-800 text-xs font-semibold">
                      <button
                        type="button"
                        onClick={() => setModalSecondSectionTab('TELEMETRY')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all ${
                          modalSecondSectionTab === 'TELEMETRY'
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Telemetry</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalSecondSectionTab('UNDERLYING_CHART')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all ${
                          modalSecondSectionTab === 'UNDERLYING_CHART'
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <BarChart2 className="w-3.5 h-3.5" />
                        <span>Spot Chart</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalSecondSectionTab('ORDER_SPECS')}
                        className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg transition-all ${
                          modalSecondSectionTab === 'ORDER_SPECS'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-gray-400 hover:text-gray-200'
                        }`}
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Specs</span>
                      </button>
                    </div>

                    <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-2 py-0.5 rounded">
                      Section 2
                    </span>
                  </div>

                  {/* Section 2 Tab 1: TELEMETRY & GREEKS */}
                  {modalSecondSectionTab === 'TELEMETRY' && (
                    <div className="space-y-3 animate-in fade-in">
                      {/* Live P&L Big Card */}
                      <div className={`p-4 rounded-xl border ${
                        isModalProfit
                          ? 'bg-emerald-950/40 border-emerald-500/40'
                          : 'bg-rose-950/40 border-rose-500/40'
                      }`}>
                        <div className="flex items-center justify-between text-xs font-semibold mb-1">
                          <span className="text-gray-300">Live Net P&amp;L</span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-black/40 text-gray-300 font-mono">
                            {chartModalPos.lots || 1} Lot ({chartModalPos.quantity} Units)
                          </span>
                        </div>
                        <div className="flex items-baseline justify-between">
                          <div className={`text-2xl font-black font-mono flex items-center gap-1.5 ${
                            isModalProfit ? 'text-emerald-400' : 'text-rose-400'
                          }`}>
                            {isModalProfit ? <TrendingUp className="w-6 h-6" /> : <TrendingDown className="w-6 h-6" />}
                            <span>{isModalProfit ? '+' : ''}₹{Math.abs(modalNetPnl).toFixed(2)}</span>
                          </div>
                          <span className={`text-sm font-bold font-mono px-2 py-0.5 rounded ${
                            isModalProfit ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                          }`}>
                            {isModalProfit ? '+' : ''}{modalPnlPct}%
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-gray-800 text-[11px] font-mono">
                          <div>
                            <span className="text-gray-400 block text-[10px]">Taken Entry</span>
                            <strong className="text-white">₹{chartModalPos.entryPrice}</strong>
                          </div>
                          <div>
                            <span className="text-gray-400 block text-[10px]">Current LTP</span>
                            <strong className="text-white">₹{modalLtp}</strong>
                          </div>
                        </div>
                      </div>

                      {/* Target & Stop Loss Cards */}
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 space-y-1">
                          <div className="text-[10px] text-emerald-400 font-semibold uppercase flex items-center justify-between">
                            <span>🎯 Target (+25%)</span>
                            {tgtDist && <span className="font-mono text-[9px]">{tgtDist}%</span>}
                          </div>
                          <div className="text-base font-black text-emerald-300 font-mono">
                            ₹{chartModalPos.targetPrice}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Gain: +₹{((chartModalPos.targetPrice - chartModalPos.entryPrice) * chartModalPos.quantity).toFixed(0)}
                          </div>
                        </div>

                        <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/30 space-y-1">
                          <div className="text-[10px] text-rose-400 font-semibold uppercase flex items-center justify-between">
                            <span>🛡️ Stop Loss (-12%)</span>
                            {slDist && <span className="font-mono text-[9px]">{slDist}%</span>}
                          </div>
                          <div className="text-base font-black text-rose-300 font-mono">
                            ₹{chartModalPos.stopLossPrice}
                          </div>
                          <div className="text-[10px] text-gray-400 font-mono">
                            Risk: -₹{((chartModalPos.entryPrice - chartModalPos.stopLossPrice) * chartModalPos.quantity).toFixed(0)}
                          </div>
                        </div>
                      </div>

                      {/* Theta Decay Progress Bar */}
                      <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                        <div className="flex items-center justify-between text-xs font-semibold">
                          <span className="text-amber-400 flex items-center gap-1.5 text-[11px]">
                            <Clock className="w-3.5 h-3.5" />
                            <span>Theta Protection Countdown</span>
                          </span>
                          <span className="text-[11px] font-mono text-gray-300">
                            {holdingMins}m / {timeoutMins}m ({Math.max(0, timeoutMins - holdingMins)}m left)
                          </span>
                        </div>
                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all duration-500 ${
                              thetaPct > 80 ? 'bg-rose-500' : thetaPct > 50 ? 'bg-amber-400' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${thetaPct}%` }}
                          />
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono flex justify-between">
                          <span>Entered: {new Date(enteredAt).toLocaleTimeString()}</span>
                          <span>Max Timeout: {timeoutMins} mins</span>
                        </div>
                      </div>

                      {/* Option Greeks Grid */}
                      {chartModalPos.greeks && (
                        <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                            Option Greeks &amp; Volatility
                          </span>
                          <div className="grid grid-cols-3 gap-2 text-center font-mono">
                            <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                              <span className="text-[9px] text-gray-400 block">Delta (Δ)</span>
                              <span className="text-xs font-bold text-emerald-400">{chartModalPos.greeks.delta.toFixed(2)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                              <span className="text-[9px] text-gray-400 block">Gamma (Γ)</span>
                              <span className="text-xs font-bold text-blue-400">{chartModalPos.greeks.gamma.toFixed(4)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                              <span className="text-[9px] text-gray-400 block">Theta (Θ/d)</span>
                              <span className="text-xs font-bold text-rose-400">-₹{Math.abs(chartModalPos.greeks.theta).toFixed(1)}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                              <span className="text-[9px] text-gray-400 block">IV %</span>
                              <span className="text-xs font-bold text-amber-400">{chartModalPos.greeks.iv.toFixed(1)}%</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                              <span className="text-[9px] text-gray-400 block">Peak Price</span>
                              <span className="text-xs font-bold text-emerald-300">₹{chartModalPos.highestPrice ?? '--'}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-900 border border-gray-800">
                              <span className="text-[9px] text-gray-400 block">Est. Charges</span>
                              <span className="text-xs font-bold text-gray-300">₹{chartModalPos.charges ?? 20}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 1-Click Fast Action Button */}
                      <div className="pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            handleClosePosition(chartModalPos.id);
                            setChartModalPos(null);
                          }}
                          disabled={closingPosId === chartModalPos.id}
                          className="w-full flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all disabled:opacity-50"
                        >
                          <Square className="w-3.5 h-3.5 fill-current" />
                          <span>{closingPosId === chartModalPos.id ? 'Exiting Position...' : 'Square Off Position Now'}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Section 2 Tab 2: UNDERLYING SPOT CHART (Dual Charting!) */}
                  {modalSecondSectionTab === 'UNDERLYING_CHART' && (
                    <div className="space-y-2 flex-1 flex flex-col animate-in fade-in">
                      <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs">
                        <div>
                          <div className="text-[10px] text-blue-300 uppercase font-bold flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <span>Underlying: {modalUnderlyingLabel}</span>
                          </div>
                          <div className="text-[11px] font-mono text-gray-300 mt-0.5">
                            Dual Chart: Watch spot levels alongside option premium
                          </div>
                        </div>
                        {modalUnderlyingQuote && typeof modalUnderlyingQuote.ltp === 'number' && (
                          <div className="text-right font-mono">
                            <div className="text-sm font-black text-white">₹{modalUnderlyingQuote.ltp.toLocaleString('en-IN')}</div>
                            {typeof modalUnderlyingQuote.percentChange === 'number' && (
                              <div className={`text-[10px] font-bold ${
                                modalUnderlyingQuote.percentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {modalUnderlyingQuote.percentChange >= 0 ? '+' : ''}{modalUnderlyingQuote.percentChange}%
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Secondary Candlestick Chart for Underlying */}
                      <div className="flex-1 min-h-[380px] rounded-xl overflow-hidden border border-gray-800">
                        <TradingViewChart
                          symbol={modalUnderlyingSymbol}
                          symbolToken={modalUnderlyingToken}
                          interval={chartInterval}
                          height={380}
                          theme="dark"
                          enableStudies={false}
                          showToolbar={false}
                          livePrice={modalUnderlyingQuote?.ltp}
                        />
                      </div>
                    </div>
                  )}

                  {/* Section 2 Tab 3: ORDER SPECS & AUDIT */}
                  {modalSecondSectionTab === 'ORDER_SPECS' && (
                    <div className="space-y-2.5 animate-in fade-in text-xs font-mono">
                      <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                          Execution Specifications
                        </span>
                        <div className="space-y-1.5 text-gray-300 text-[11px]">
                          <div className="flex justify-between py-1 border-b border-gray-900">
                            <span className="text-gray-400">Order ID:</span>
                            <span className="text-white font-bold">{chartModalPos.orderId}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-900">
                            <span className="text-gray-400">Position ID:</span>
                            <span className="text-gray-300">{chartModalPos.id}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-900">
                            <span className="text-gray-400">Trading Mode:</span>
                            <span className={chartModalPos.mode === 'LIVE' ? 'text-amber-400 font-bold' : 'text-sky-400 font-bold'}>
                              {chartModalPos.mode === 'LIVE' ? '🔴 LIVE BROKER' : '📝 PAPER SIM'}
                            </span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-900">
                            <span className="text-gray-400">Strategy Engine:</span>
                            <span className="text-emerald-400 font-bold">{chartModalPos.strategy}</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-900">
                            <span className="text-gray-400">Lot Sizing:</span>
                            <span className="text-white">{chartModalPos.lots || 1} Lot ({chartModalPos.quantity} units)</span>
                          </div>
                          <div className="flex justify-between py-1 border-b border-gray-900">
                            <span className="text-gray-400">Exchange / Segment:</span>
                            <span className="text-white">NSE / NFO (Options)</span>
                          </div>
                          <div className="flex justify-between py-1">
                            <span className="text-gray-400">Entry Timestamp:</span>
                            <span className="text-gray-300">{new Date(enteredAt).toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default AiOrderBookTab;
