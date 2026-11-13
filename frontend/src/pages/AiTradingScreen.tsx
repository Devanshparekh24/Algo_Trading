import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  X,
  Zap,
  Clock,
  Calendar,
  Sparkles,
  Bot,
  Wallet,
  Activity,
  Sliders,
} from 'lucide-react';
import {
  fetchAiSignals,
  analyzeScrip,
  lookupOptionStrike,
  executeSignalOrder,
  fetchOrderHistory,
  fetchAutoPilotConfig,
  updateAutoPilotConfig,
  fetchScanUniverse,
  addUniverseScrip,
  removeUniverseScrip,
  resetUniverse,
  searchInstrumentsApi,
  fetchBudgetAdvice,
  fetchStrategySchedule,
  logStrategySchedule,
  type TradeSignal,
  type AutoPilotConfig,
  type AutoPilotStrategy,
  type OrderBookItem,
  type MarketSegment,
  type UniverseScrip,
  type BudgetAnalysisResult,
  type RiskProfile,
  type BudgetSegment,
  type VolatileOptionItem,
  type LiveStrategySuggestion,
  type StrategyScheduleRecord,
} from '../services/aiTradingService';
import { useFnoMovers, useMarketStatus } from '../hooks/useMarket';
import { getRMSLimit } from '../services/authService';
import { getSocket, requestAiPricesRefresh, type RealtimeTickData } from '../services/socketService';
import { AiTradingHeader } from '../components/aiTrading/AiTradingHeader';
import { AiTradingNavTabs, type AiTradingTab } from '../components/aiTrading/AiTradingNavTabs';
import { AiSignalsTab } from '../components/aiTrading/AiSignalsTab';
import { AiBudgetAllocatorTab } from '../components/aiTrading/AiBudgetAllocatorTab';
import { AiOptionChainScannerTab } from '../components/aiTrading/AiOptionChainScannerTab';
import { AiTradingChartTab } from '../components/aiTrading/AiTradingChartTab';
import { AiScripAnalyzerTab, POPULAR_SCRIPS } from '../components/aiTrading/AiScripAnalyzerTab';
import { AiOrderBookTab } from '../components/aiTrading/AiOrderBookTab';
import { AiOrderExecutionModal } from '../components/aiTrading/AiOrderExecutionModal';
import { AiAutoPilotModal } from '../components/aiTrading/AiAutoPilotModal';
import { AiUniverseModal } from '../components/aiTrading/AiUniverseModal';
import { AiStrategyScheduleModal } from '../components/aiTrading/AiStrategyScheduleModal';
import { useAppStore } from '../store';

export const AiTradingScreen: React.FC = () => {
  const showValidationModal = useAppStore((state) => state.showValidationModal);
  const { data: marketStatus } = useMarketStatus();

  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<AiTradingTab>('signals');
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL'>('ALL');
  const [layoutMode, setLayoutMode] = useState<'STUDIO' | 'TABS'>('STUDIO');

  // Segment State: EQUITY (Cash) vs FNO (Futures & Options)
  const [selectedSegment, setSelectedSegment] = useState<MarketSegment>('EQUITY');

  // Realtime WebSocket Live Prices & Ticks
  const [livePrices, setLivePrices] = useState<Record<string, RealtimeTickData>>({});
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const [lastTickAt, setLastTickAt] = useState<string | null>(null);
  const [totalTicksReceived, setTotalTicksReceived] = useState<number>(0);
  const flashTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const getLiveQuote = useCallback(
    (tokenOrSymbol?: string): RealtimeTickData | undefined => {
      if (!tokenOrSymbol) return undefined;
      const t = tokenOrSymbol.trim();
      const clean = t
        .replace(/-EQ$/, '')
        .replace(/^NSE:/, '')
        .replace(/^BSE:/, '')
        .replace(/^NFO:/, '')
        .toUpperCase();
      return livePrices[t] || livePrices[clean] || livePrices[t.toUpperCase()];
    },
    [livePrices]
  );

  const triggerFlash = useCallback((key: string, direction: 'up' | 'down') => {
    if (flashTimers.current[key]) clearTimeout(flashTimers.current[key]);
    setPriceFlashes((prev) => ({ ...prev, [key]: direction }));
    flashTimers.current[key] = setTimeout(() => {
      setPriceFlashes((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }, 1200);
  }, []);

  // Budget Advisor State
  const [budgetInput, setBudgetInput] = useState<string>('10000');
  const [budgetRiskProfile, setBudgetRiskProfile] = useState<RiskProfile>('MODERATE');
  const [budgetSegment, setBudgetSegment] = useState<BudgetSegment>('ALL');
  const [budgetMaxTrades, setBudgetMaxTrades] = useState<number>(3);
  const [budgetAnalysis, setBudgetAnalysis] = useState<BudgetAnalysisResult | null>(null);
  const [isAnalyzingBudget, setIsAnalyzingBudget] = useState<boolean>(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [brokerFunds, setBrokerFunds] = useState<{ net: number; available: number } | null>(null);

  const [isLoadingFunds, setIsLoadingFunds] = useState<boolean>(false);
  const [volatileRadarTab, setVolatileRadarTab] = useState<'calls' | 'puts'>('calls');

  // F&O Movers hook
  const fnoMoversQuery = useFnoMovers();

  // F&O Custom Strike Lookup State
  const [fnoUnderlying, setFnoUnderlying] = useState<string>('NIFTY');
  const [fnoStrike, setFnoStrike] = useState<number>(25000);
  const [fnoOptionType, setFnoOptionType] = useState<'CE' | 'PE'>('PE');
  const [isLookingUpOption, setIsLookingUpOption] = useState<boolean>(false);

  // Chart Integration State
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('NSE:NIFTYBEES');
  const [chartInterval, setChartInterval] = useState<'1' | '5' | '15' | '60' | 'D'>('5');

  // Signals State
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Auto-Pilot State: Greek Momentum Sniper
  const [autoPilot, setAutoPilot] = useState<AutoPilotConfig>({
    enabled: false,
    mode: 'PAPER',
    strategy: 'GREEK_SNIPER',
    enforceGoldenHours: true,
    profitTargetPct: 50,
    stopLossPct: 22,
    thetaTimeoutMinutes: 45,
    maxDailyTrades: 5,
    defaultQuantity: 1,
    productType: 'INTRADAY',
    executedToday: 0,
  });
  const [hudSlab, setHudSlab] = useState<number>(5000);
  const [isAutoPilotModalOpen, setIsAutoPilotModalOpen] = useState(false);

  // Live Strategy Schedule & IST Timetable State
  const [strategySuggestion, setStrategySuggestion] = useState<LiveStrategySuggestion | null>(null);
  const [strategySchedules, setStrategySchedules] = useState<StrategyScheduleRecord[]>([]);
  const [strategyLogs, setStrategyLogs] = useState<any[]>([]);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isLoadingSchedule, setIsLoadingSchedule] = useState(false);

  // Dynamic Scanning Universe State
  const [universe, setUniverse] = useState<UniverseScrip[]>([]);
  const [isUniverseModalOpen, setIsUniverseModalOpen] = useState(false);
  const [isLoadingUniverse, setIsLoadingUniverse] = useState(false);
  const [universeSearchQuery, setUniverseSearchQuery] = useState('');
  const [universeSearchResults, setUniverseSearchResults] = useState<any[]>([]);
  const [isSearchingUniverse, setIsSearchingUniverse] = useState(false);
  const [universeFilter, setUniverseFilter] = useState<'ALL' | 'CUSTOM' | 'HOLDING' | 'MARKET_MOVER' | 'CORE'>('ALL');

  // Deep Analyzer State
  const [selectedScrip, setSelectedScrip] = useState(POPULAR_SCRIPS[0]);
  const [customSymbol, setCustomSymbol] = useState('');
  const [customToken, setCustomToken] = useState('');
  const [analyzedSignal, setAnalyzedSignal] = useState<TradeSignal | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // 1-Click Order Execution Modal State
  const [executingSignal, setExecutingSignal] = useState<TradeSignal | null>(null);
  const [execQuantity, setExecQuantity] = useState<number>(1);
  const [execLots, setExecLots] = useState<number>(1);
  const [execProductType, setExecProductType] = useState<'INTRADAY' | 'DELIVERY' | 'CARRYFORWARD'>('INTRADAY');
  const [execOrderType, setExecOrderType] = useState<'MARKET' | 'LIMIT'>('MARKET');
  const [execLimitPrice, setExecLimitPrice] = useState<number>(0);
  const [execMode, setExecMode] = useState<'PAPER' | 'LIVE'>('PAPER');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionToast, setExecutionToast] = useState<{
    type: 'success' | 'error' | 'info';
    message: string;
  } | null>(null);

  // Order Book State
  const [orders, setOrders] = useState<OrderBookItem[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);

  // WebSocket Live Connection
  const [isLiveConnected, setIsLiveConnected] = useState(false);

  // Load Signals & Config
  const loadSignals = useCallback(async (refresh = false, segment = selectedSegment) => {
    setIsScanning(true);
    setScanError(null);
    try {
      const data = await fetchAiSignals(refresh, segment);
      setSignals(data.signals || []);
      setLastScanTime(data.lastScanTime);
    } catch (err: any) {
      setScanError(err?.message || 'Failed to scan market');
    } finally {
      setIsScanning(false);
    }
  }, [selectedSegment]);

  const loadAutoPilot = useCallback(async () => {
    try {
      const cfg = await fetchAutoPilotConfig();
      setAutoPilot(cfg);
      setExecMode(cfg.mode);
    } catch (err) {
      console.warn('Could not load autopilot config:', err);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setIsLoadingOrders(true);
    try {
      const res = await fetchOrderHistory();
      setOrders(res.orders || []);
    } catch (err) {
      console.warn('Could not load orders:', err);
    } finally {
      setIsLoadingOrders(false);
    }
  }, []);

  const loadUniverse = useCallback(async () => {
    setIsLoadingUniverse(true);
    try {
      const data = await fetchScanUniverse(selectedSegment);
      setUniverse(data.universe || []);
    } catch (err: any) {
      console.warn('Could not load universe:', err);
    } finally {
      setIsLoadingUniverse(false);
    }
  }, [selectedSegment]);

  const loadStrategySchedule = useCallback(async () => {
    setIsLoadingSchedule(true);
    try {
      const data = await fetchStrategySchedule();
      if (data) {
        setStrategySuggestion(data.liveSuggestion);
        setStrategySchedules(data.schedules || []);
        setStrategyLogs(data.history || []);
      }
    } catch (err) {
      console.warn('Could not load strategy schedules:', err);
    } finally {
      setIsLoadingSchedule(false);
    }
  }, []);

  const handleUniverseSearch = async (query: string) => {
    setUniverseSearchQuery(query);
    if (query.trim().length < 2) {
      setUniverseSearchResults([]);
      return;
    }
    setIsSearchingUniverse(true);
    try {
      const results = await searchInstrumentsApi(query.trim(), 10);
      setUniverseSearchResults(results);
    } catch (err) {
      console.warn('Universe search error:', err);
    } finally {
      setIsSearchingUniverse(false);
    }
  };

  const handleAddUniverseScrip = async (item: {
    symbol: string;
    token: string;
    name?: string;
    exch_seg?: string;
    instrumenttype?: string;
    lotsize?: string | number;
    strike?: string | number;
    expiry?: string;
  }) => {
    if (!item.symbol || !item.token) {
      showValidationModal({
        title: 'Invalid Instrument',
        message: 'The selected instrument is missing a symbol or token.',
        type: 'warning',
      });
      return;
    }
    if (universe.some((u) => u.token === item.token)) {
      showValidationModal({
        title: 'Already in Universe',
        message: `${item.symbol} is already part of your active scanning universe.`,
        type: 'info',
        suggestion: 'The AI Sniper Engine is already actively tracking this symbol.',
      });
      return;
    }
    try {
      const exch = item.exch_seg || (selectedSegment === 'FNO' ? 'NFO' : 'NSE');
      const isFno = exch === 'NFO' || item.symbol.endsWith('CE') || item.symbol.endsWith('PE') || item.symbol.endsWith('FUT');
      await addUniverseScrip({
        symbol: item.symbol,
        token: item.token,
        exchange: exch,
        name: item.name || item.symbol,
        segment: isFno ? 'FNO' : 'EQUITY',
        contractType: item.symbol.endsWith('CE') ? 'CE' : item.symbol.endsWith('PE') ? 'PE' : item.symbol.endsWith('FUT') ? 'FUT' : 'EQ',
        strike: item.strike ? Number(item.strike) : undefined,
        expiry: item.expiry,
        lotSize: item.lotsize ? Number(item.lotsize) : (item.symbol.startsWith('BANKNIFTY') ? 30 : 65),
      });
      setExecutionToast({
        type: 'success',
        message: `Added ${item.symbol} to dynamic scanning universe!`,
      });
      setUniverseSearchQuery('');
      setUniverseSearchResults([]);
      await loadUniverse();
      loadSignals(true);
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to add scrip to universe',
      });
    }
  };

  const handleRemoveUniverseScrip = async (token: string, symbol: string) => {
    try {
      await removeUniverseScrip(token);
      setExecutionToast({
        type: 'success',
        message: `Removed ${symbol} from AI scanning universe`,
      });
      await loadUniverse();
      loadSignals(true);
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to remove scrip',
      });
    }
  };

  const handleResetUniverse = async () => {
    try {
      await resetUniverse();
      setExecutionToast({
        type: 'success',
        message: 'Dynamic universe reset to core bluechips & holdings',
      });
      await loadUniverse();
      loadSignals(true);
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to reset universe',
      });
    }
  };

  const loadBrokerFunds = useCallback(async () => {
    setIsLoadingFunds(true);
    try {
      const rms = await getRMSLimit();
      if (rms) {
        const avail = parseFloat(String(rms.availablecash || rms.net || '0'));
        const net = parseFloat(String(rms.net || '0'));
        if (avail > 0 || net > 0) {
          setBrokerFunds({ net: Math.round(net), available: Math.round(avail) });
        }
      }
    } catch (err) {
      console.warn('RMS funds not available or session expired:', err);
    } finally {
      setIsLoadingFunds(false);
    }
  }, []);

  const handleRunBudgetAnalysis = useCallback(async (customBudget?: number, overrideSegment?: BudgetSegment) => {
    const rawVal = customBudget !== undefined ? String(customBudget) : budgetInput;
    const amount = customBudget !== undefined ? customBudget : parseFloat(budgetInput.replace(/,/g, ''));
    if (!rawVal || isNaN(amount) || amount < 500) {
      const errorMsg = 'Please enter a budget of at least ₹500';
      setBudgetError(errorMsg);
      showValidationModal({
        title: 'Minimum Budget Required',
        message: errorMsg,
        type: 'warning',
        suggestion: 'Trading capital of at least ₹500 is required to size equity positions and F&O option contracts according to exchange lot rules and margin requirements.',
        actionLabel: 'Set Budget to ₹5,000',
        onAction: () => {
          setBudgetInput('5000');
          handleRunBudgetAnalysis(5000);
        },
      });
      return;
    }
    const targetSegment = overrideSegment || budgetSegment;
    setIsAnalyzingBudget(true);
    setBudgetError(null);
    try {
      const res = await fetchBudgetAdvice({
        budget: amount,
        riskProfile: budgetRiskProfile,
        segment: targetSegment,
        maxTrades: budgetMaxTrades,
      });
      setBudgetAnalysis(res);
    } catch (err: any) {
      const errorMsg = err?.message || 'Failed to generate budget suggestions';
      setBudgetError(errorMsg);
      showValidationModal({
        title: 'Budget Allocation Notice',
        message: errorMsg,
        type: 'error',
        suggestion: 'Please verify that your selected universe has active trading instruments or adjust your risk profile parameters.',
      });
    } finally {
      setIsAnalyzingBudget(false);
    }
  }, [budgetInput, budgetRiskProfile, budgetSegment, budgetMaxTrades, showValidationModal]);

  // Handler to 1-click allocate budget to a top volatile Call or Put option
  const handleAllocateVolatileOption = useCallback((option: VolatileOptionItem) => {
    const lotSize = option.tradingSymbol.startsWith('BANKNIFTY') ? 30 : 65;
    const minCost = Math.round(option.ltp * lotSize);
    const currentBudgetNum = parseFloat(budgetInput.replace(/,/g, '')) || 0;
    const newBudget = currentBudgetNum >= minCost ? currentBudgetNum : Math.max(minCost, 5000);

    setBudgetInput(String(newBudget));
    const targetSeg: BudgetSegment = option.instrumentType === 'CE' ? 'VOLATILE_CALLS' : 'VOLATILE_PUTS';
    setBudgetSegment(targetSeg);
    handleRunBudgetAnalysis(newBudget, targetSeg);
  }, [budgetInput, handleRunBudgetAnalysis]);

  useEffect(() => {
    loadSignals(false);
    loadAutoPilot();
    loadOrders();
    loadUniverse();
    loadBrokerFunds();
    loadStrategySchedule();

    const timer = setInterval(() => {
      loadStrategySchedule();
    }, 60000);
    return () => clearInterval(timer);
  }, [loadSignals, loadAutoPilot, loadOrders, loadUniverse, loadBrokerFunds, loadStrategySchedule]);

  // Request WebSocket price update when chart symbol changes
  useEffect(() => {
    if (!selectedChartSymbol) return;
    const clean = selectedChartSymbol
      .replace(/^NSE:/, '')
      .replace(/^BSE:/, '')
      .replace(/^NFO:/, '')
      .toUpperCase();
    const match =
      signals.find((s) => s.symbol.toUpperCase() === clean) ||
      universe.find((u) => u.symbol.toUpperCase() === clean) ||
      POPULAR_SCRIPS.find((p) => p.symbol.toUpperCase().startsWith(clean));
    if (match?.token) {
      requestAiPricesRefresh([
        { token: match.token, exchange: match.exchange || 'NSE' },
      ]);
    }
  }, [selectedChartSymbol, signals, universe]);

  // Socket.IO event listeners for live prices, signals & auto-pilot executions
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const handleConnect = () => {
      setIsLiveConnected(true);
      requestAiPricesRefresh();
    };
    const handleDisconnect = () => setIsLiveConnected(false);

    const handlePriceTick = (tick: RealtimeTickData) => {
      if (!tick || !tick.symbolToken || typeof tick.ltp !== 'number') return;
      const token = tick.symbolToken;
      const sym = tick.tradingSymbol || '';
      const cleanSym = sym.replace(/-EQ$/, '').toUpperCase();

      setLivePrices((prev) => {
        const existing = prev[token] || (sym ? prev[sym] : undefined);
        if (existing) {
          if (tick.ltp > existing.ltp) {
            triggerFlash(token, 'up');
            if (sym) triggerFlash(sym, 'up');
            if (cleanSym) triggerFlash(cleanSym, 'up');
          } else if (tick.ltp < existing.ltp) {
            triggerFlash(token, 'down');
            if (sym) triggerFlash(sym, 'down');
            if (cleanSym) triggerFlash(cleanSym, 'down');
          }
        }
        return {
          ...prev,
          [token]: tick,
          ...(sym ? { [sym]: tick } : {}),
          ...(cleanSym ? { [cleanSym]: tick } : {}),
        };
      });

      setLastTickAt(new Date().toLocaleTimeString('en-IN', { hour12: false }));
      setTotalTicksReceived((n) => n + 1);

      // Dynamically update active signals with live WebSocket price tick
      setSignals((prev) =>
        prev.map((s) => {
          const match =
            s.token === token ||
            s.symbol.toUpperCase() === sym.toUpperCase() ||
            s.symbol.replace(/-EQ$/, '').toUpperCase() === cleanSym;
          if (!match) return s;
          return {
            ...s,
            currentPrice: tick.ltp,
            netChange: tick.change ?? s.netChange,
            percentChange: tick.percentChange ?? s.percentChange,
          };
        })
      );

      // Dynamically update deep analyzed signal if matching
      setAnalyzedSignal((prev) => {
        if (!prev) return prev;
        const match =
          prev.token === token ||
          prev.symbol.toUpperCase() === sym.toUpperCase() ||
          prev.symbol.replace(/-EQ$/, '').toUpperCase() === cleanSym;
        if (!match) return prev;
        return {
          ...prev,
          currentPrice: tick.ltp,
          netChange: tick.change ?? prev.netChange,
          percentChange: tick.percentChange ?? prev.percentChange,
        };
      });

      // Dynamically update budget analysis recommendations
      setBudgetAnalysis((prev) => {
        if (!prev) return prev;
        const updatedSuggestions = prev.suggestions.map((sugg) => {
          const match =
            sugg.signal.token === token ||
            sugg.signal.symbol.toUpperCase() === sym.toUpperCase() ||
            sugg.signal.symbol.replace(/-EQ$/, '').toUpperCase() === cleanSym;
          if (!match) return sugg;
          return {
            ...sugg,
            signal: {
              ...sugg.signal,
              currentPrice: tick.ltp,
              netChange: tick.change ?? sugg.signal.netChange,
              percentChange: tick.percentChange ?? sugg.signal.percentChange,
            },
          };
        });
        return {
          ...prev,
          suggestions: updatedSuggestions,
        };
      });
    };

    const handleAiSignalsUpdate = (payload: any) => {
      if (payload?.signals) {
        setSignals(payload.signals);
        if (payload.scannedAt) setLastScanTime(payload.scannedAt);
      }
    };

    const handleAiAutoTradeExecuted = (payload: any) => {
      const sym = payload.symbol || payload.position?.symbol || payload.signal?.symbol || 'Scrip';
      const act = payload.position?.action || payload.signal?.action || 'TRADE';
      const cost = payload.investedCost ? ` • Cost: ₹${Number(payload.investedCost).toLocaleString('en-IN')}` : '';
      setExecutionToast({
        type: 'success',
        message: `[${payload.mode || 'PAPER'}] Executed ${act} ${sym}${cost} (${payload.strategy || 'AUTO'})`,
      });
      loadOrders();
    };

    const handleAutoPilotStatusChanged = (payload: any) => {
      setAutoPilot((prev) => ({
        ...prev,
        enabled: payload.enabled,
        mode: payload.mode,
        strategy: payload.strategy,
        maxBudgetPerTrade: payload.maxBudgetPerTrade,
      }));
      setExecutionToast({
        type: payload.enabled ? 'success' : 'info',
        message: `Auto-Pilot: ${payload.enabled ? 'ARMED (ON)' : 'PAUSED (OFF)'} [${payload.mode} Mode] • ${payload.strategy} • ${payload.slabInfo}`,
      });
      loadOrders();
    };

    const handleScannerActivity = (payload: any) => {
      if (payload.topActionable && payload.topActionable.length > 0) {
        const topSymbols = payload.topActionable.slice(0, 3).map((s: any) => `${s.symbol} (${s.action})`).join(', ');
        setExecutionToast({
          type: 'info',
          message: `[${payload.mode}] Scanner evaluated ${payload.totalScanned} ${payload.segment} instruments. Top: ${topSymbols}`,
        });
      }
    };

    const handleAiAutoExitExecuted = (payload: any) => {
      setExecutionToast({
        type: (payload.pnl || 0) >= 0 ? 'success' : 'error',
        message: `Auto-Exit [${payload.reason}]: ${payload.position?.symbol} closed (${(payload.pnl || 0) >= 0 ? '+' : ''}₹${payload.pnl || 0})`,
      });
      loadOrders();
    };

    const handleSignalExecuted = () => {
      loadOrders();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('ai_signals_update', handleAiSignalsUpdate);
    socket.on('ai_auto_trade_executed', handleAiAutoTradeExecuted);
    socket.on('ai_autopilot_status_changed', handleAutoPilotStatusChanged);
    socket.on('ai_scanner_activity', handleScannerActivity);
    socket.on('ai_auto_exit_executed', handleAiAutoExitExecuted);
    socket.on('ai_signal_executed', handleSignalExecuted);
    socket.on('ai_price_tick', handlePriceTick);
    socket.on('market_tick', handlePriceTick);
    socket.on('holding_tick', handlePriceTick);

    setIsLiveConnected(socket.connected);
    if (socket.connected) {
      requestAiPricesRefresh();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('ai_signals_update', handleAiSignalsUpdate);
      socket.off('ai_auto_trade_executed', handleAiAutoTradeExecuted);
      socket.off('ai_autopilot_status_changed', handleAutoPilotStatusChanged);
      socket.off('ai_scanner_activity', handleScannerActivity);
      socket.off('ai_auto_exit_executed', handleAiAutoExitExecuted);
      socket.off('ai_signal_executed', handleSignalExecuted);
      socket.off('ai_price_tick', handlePriceTick);
      socket.off('market_tick', handlePriceTick);
      socket.off('holding_tick', handlePriceTick);
    };
  }, [loadOrders, triggerFlash]);

  // Run On-Demand Analysis
  const handleAnalyzeScrip = async (symbol: string, token: string, exchange = 'NSE') => {
    setIsAnalyzing(true);
    try {
      const res = await analyzeScrip(symbol, token, exchange);
      setAnalyzedSignal(res);
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Analysis failed',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  // Run Option Strike Lookup & AI Analysis
  const handleLookupOption = async (
    underlying = fnoUnderlying,
    strike = fnoStrike,
    optionType = fnoOptionType
  ) => {
    setIsLookingUpOption(true);
    try {
      const res = await lookupOptionStrike({ underlying, strike, optionType });
      setSignals((prev) => [res, ...prev.filter((s) => s.id !== res.id)]);
      setAnalyzedSignal(res);
      setExecutionToast({
        type: 'success',
        message: `AI Analysis ready: ${res.symbol} (${res.action} @ ₹${res.currentPrice})`,
      });
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to analyze option strike',
      });
    } finally {
      setIsLookingUpOption(false);
    }
  };

  // Open 1-Click Execution Modal
  const handleOpenExecuteModal = (signal: TradeSignal, customLots?: number, customQty?: number) => {
    setExecutingSignal(signal);
    const isFno = signal.exchange === 'NFO' || signal.segment === 'FNO' || signal.symbol.endsWith('CE') || signal.symbol.endsWith('PE');
    const lotSize = signal.lotSize || 65;
    const initialLots = customLots && customLots > 0 ? customLots : 1;
    setExecLots(initialLots);
    setExecQuantity(customQty && customQty > 0 ? customQty : (isFno ? initialLots * lotSize : autoPilot.defaultQuantity || 1));
    setExecProductType(isFno ? 'CARRYFORWARD' : autoPilot.productType || 'INTRADAY');
    setExecOrderType('MARKET');
    setExecLimitPrice(signal.currentPrice);
    setExecMode(autoPilot.mode);
  };

  // Submit Order Execution
  const handleConfirmOrder = async () => {
    if (!executingSignal) return;

    const isFno = executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO' || executingSignal.symbol.endsWith('CE') || executingSignal.symbol.endsWith('PE');
    const lotSize = executingSignal.lotSize || 65;
    const finalQuantity = isFno ? execLots * lotSize : execQuantity;

    if (!finalQuantity || finalQuantity <= 0) {
      showValidationModal({
        title: 'Invalid Order Quantity',
        message: 'Order quantity must be at least 1 unit or 1 lot.',
        type: 'warning',
        suggestion: 'Please enter a valid quantity or lot count before confirming order execution.',
      });
      return;
    }

    if (execOrderType === 'LIMIT' && (!execLimitPrice || execLimitPrice <= 0)) {
      showValidationModal({
        title: 'Invalid Limit Price',
        message: 'Please specify a valid Limit Price greater than ₹0.',
        type: 'warning',
        suggestion: 'Limit orders require an explicit execution price trigger.',
      });
      return;
    }

    setIsExecuting(true);
    try {

      const res = await executeSignalOrder({
        signalId: executingSignal.id,
        quantity: finalQuantity,
        lots: isFno ? execLots : undefined,
        productType: execProductType,
        orderType: execOrderType,
        limitPrice: execOrderType === 'LIMIT' ? execLimitPrice : undefined,
        mode: execMode,
        signal: executingSignal,
      });

      setExecutionToast({
        type: 'success',
        message: `${executingSignal.action} order executed successfully! [Order ID: ${res.orderId}] (${res.mode} Mode, ${finalQuantity} Qty)`,
      });

      // Update signal status in memory
      setSignals((prev) =>
        prev.map((s) => (s.id === executingSignal.id ? { ...s, status: 'EXECUTED' } : s))
      );
      if (analyzedSignal?.id === executingSignal.id) {
        setAnalyzedSignal((prev) => (prev ? { ...prev, status: 'EXECUTED' } : null));
      }

      setExecutingSignal(null);
      loadOrders();
    } catch (err: any) {
      const errorMsg = err?.message || 'Order execution failed';
      setExecutionToast({
        type: 'error',
        message: errorMsg,
      });
      showValidationModal({
        title: 'Order Execution Alert',
        message: errorMsg,
        type: 'error',
        suggestion: 'Verify SmartAPI session tokens, available margin balances, or switch to Paper mode for simulation.',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Save AutoPilot settings with Market Closed Validation
  const handleSaveAutoPilot = async (
    updated: Partial<AutoPilotConfig>,
    bypassMarketCheck = false
  ) => {
    // Validation: Check if enabling or arming Auto-Pilot while Indian markets are closed
    const isEnabling = updated.enabled === true || (autoPilot.enabled && updated.enabled !== false);
    const isClosed = marketStatus ? !marketStatus.isOpen : false;

    if (isEnabling && isClosed && !bypassMarketCheck) {
      const statusReason =
        marketStatus?.message ||
        marketStatus?.closeReason ||
        (marketStatus?.isWeekend
          ? 'Markets are closed on weekends'
          : 'Regular trading hours are 09:15 AM – 03:30 PM IST');
      const nextSession = marketStatus?.nextSession || 'Next trading day at 09:15 AM IST';
      const targetMode = updated.mode || autoPilot.mode;

      showValidationModal({
        title: 'Market is Currently Closed',
        message: `Indian markets (NSE/BSE) are currently CLOSED (${statusReason}). Auto-Pilot cannot execute orders on the exchange while markets are shut.`,
        type: 'warning',
        suggestion: `Next trading session: ${nextSession}. You can switch to Paper Mode for real-time strategy testing, or queue Auto-Pilot to automatically arm at market open.`,
        actionLabel:
          targetMode === 'LIVE' ? 'Switch to Paper Mode & Arm' : 'Arm Anyway (Queue for Open)',
        onAction: () => {
          const finalConfig: Partial<AutoPilotConfig> =
            targetMode === 'LIVE' ? { ...updated, mode: 'PAPER' } : updated;
          handleSaveAutoPilot(finalConfig, true);
        },
      });
      return;
    }

    if (updated.profitTargetPct !== undefined && (updated.profitTargetPct <= 0 || updated.profitTargetPct > 500)) {
      showValidationModal({
        title: 'Invalid Profit Target',
        message: 'Profit Target percentage must be between 1% and 500%.',
        type: 'warning',
        suggestion: 'Recommended setting for Greek Momentum Sniper is +50%.',
      });
      return;
    }
    if (updated.stopLossPct !== undefined && (updated.stopLossPct <= 0 || updated.stopLossPct > 100)) {
      showValidationModal({
        title: 'Invalid Stop-Loss',
        message: 'Stop-Loss percentage must be between 1% and 100%.',
        type: 'warning',
        suggestion: 'Recommended setting is -22% to strictly protect capital against sudden market swings.',
      });
      return;
    }
    if (updated.thetaTimeoutMinutes !== undefined && (updated.thetaTimeoutMinutes < 5 || updated.thetaTimeoutMinutes > 360)) {
      showValidationModal({
        title: 'Invalid Theta Timeout',
        message: 'Theta timeout must be between 5 and 360 minutes.',
        type: 'warning',
        suggestion: 'Recommended timeout is 45 minutes to protect option buyers against theta decay.',
      });
      return;
    }
    try {
      const res = await updateAutoPilotConfig(updated);
      setAutoPilot(res);

      const strategyMap: Record<string, string> = {
        GREEK_SNIPER: 'Greek Sniper',
        GAMMA_BLAST: 'Expiry Gamma Blast',
        VWAP_TRAP: 'VWAP Fakeout Trap',
        ORB_15M: '15-Min ORB',
        PCR_REVERSAL: 'PCR Reversal',
        STANDARD: 'Standard Scalper',
        EMA_9_21: 'NIFTY 9/21 EMA Crossover',
      };
      const strategyLabel = strategyMap[res.strategy] || res.strategy;
      const budgetText =
        res.maxBudgetPerTrade && res.maxBudgetPerTrade > 0
          ? `Cap: ₹${res.maxBudgetPerTrade.toLocaleString('en-IN')}`
          : 'Dynamic Sizing (No Cap)';
      const details = `Target: +${res.profitTargetPct || 35}%, SL: -${res.stopLossPct || 18}% • ${budgetText}`;

      setExecutionToast({
        type: 'success',
        message: `Auto-Pilot updated: ${res.enabled ? 'ACTIVE' : 'PAUSED'} (${res.mode} Mode • ${strategyLabel} • ${details})`,
      });
      setIsAutoPilotModalOpen(false);
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to update Auto-Pilot',
      });
    }
  };

  // 1-Click Arm Strategy from Suggestion or Timetable (Dynamic sizing without fixed price dependency)
  const handleArmStrategy = async (
    strategy: AutoPilotStrategy,
    budget?: number,
    targetPct?: number,
    slPct?: number
  ) => {
    // 0 = Dynamic sizing (by lot size at market price, no fixed price restriction)
    const tradeBudget = typeof budget === 'number' ? budget : (hudSlab !== undefined ? hudSlab : (autoPilot.maxBudgetPerTrade || 0));
    const target = targetPct || 35;
    const sl = slPct || 18;

    const updated: Partial<AutoPilotConfig> = {
      ...autoPilot,
      strategy,
      maxBudgetPerTrade: tradeBudget,
      profitTargetPct: target,
      stopLossPct: sl,
      enabled: true,
    };

    try {
      await handleSaveAutoPilot(updated);
      await logStrategySchedule({
        strategy,
        name: strategySuggestion?.strategyName || strategy,
        startTime: strategySuggestion?.timeWindowLabel?.split('–')[0]?.trim() || '09:30',
        endTime: strategySuggestion?.timeWindowLabel?.split('–')[1]?.trim() || '15:30',
        suggestedBudget: tradeBudget,
        targetProfitPct: target,
        stopLossPct: sl,
        marketCondition:
          strategySuggestion?.reason ||
          (tradeBudget === 0
            ? 'Dynamic Market Sizing (No Fixed Price Limit)'
            : `Custom Cap: ₹${tradeBudget.toLocaleString('en-IN')}`),
      }).catch(() => {});
      loadStrategySchedule();
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to arm strategy',
      });
    }
  };

  // Filtered Signals
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (filterAction === 'BUY') return s.action === 'BUY';
      if (filterAction === 'SELL') return s.action === 'SELL';
      return true;
    });
  }, [signals, filterAction]);

  // Statistics
  const buyCount = useMemo(() => signals.filter((s) => s.action === 'BUY').length, [signals]);
  const sellCount = useMemo(() => signals.filter((s) => s.action === 'SELL').length, [signals]);
  const holdCount = useMemo(() => signals.filter((s) => s.action === 'HOLD').length, [signals]);

  return (
    <div className="space-y-5 pb-12 w-full max-w-[1720px] mx-auto px-3 sm:px-6 animate-in fade-in duration-200">
      {/* Toast Notification */}
      {executionToast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            executionToast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 backdrop-blur-md'
              : executionToast.type === 'info'
              ? 'bg-blue-950/90 text-blue-200 border-blue-500/50 backdrop-blur-md'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/50 backdrop-blur-md'
          }`}
        >
          {executionToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : executionToast.type === 'info' ? (
            <Zap className="w-5 h-5 text-blue-400 shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
          )}
          <span>{executionToast.message}</span>
          <button
            type="button"
            onClick={() => setExecutionToast(null)}
            className="text-gray-400 hover:text-white ml-2 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Command Deck Header Bar */}
      <AiTradingHeader
        isLiveConnected={isLiveConnected}
        totalTicksReceived={totalTicksReceived}
        lastTickAt={lastTickAt}
        autoPilot={autoPilot}
        universeCount={universe.length}
        isScanning={isScanning}
        onRefreshLivePrices={() => requestAiPricesRefresh()}
        onChangeAutoPilotMode={(mode) => handleSaveAutoPilot({ mode })}
        onOpenAutoPilotModal={() => setIsAutoPilotModalOpen(true)}
        onOpenUniverseModal={() => {
          setIsUniverseModalOpen(true);
          loadUniverse();
        }}
        onScanMarket={() => loadSignals(true)}
        onPauseAutoPilot={() => handleSaveAutoPilot({ enabled: false })}
        marketStatus={marketStatus}
        layoutMode={layoutMode}
        onToggleLayoutMode={setLayoutMode}
        activeStrategyName={strategySuggestion?.strategyName}
      />

      {/* Hero AI Strategy Intelligence HUD */}
      {strategySuggestion && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900/90 to-blue-950/40 border border-amber-500/30 p-4 sm:p-5 shadow-xl shadow-amber-500/5 transition-all">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-52 h-52 bg-gradient-to-br from-amber-500/15 via-orange-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
            {/* Strategy Meta & Explanation */}
            <div className="space-y-2 flex-1">
              <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  <Sparkles className="w-3 h-3 mr-1 fill-amber-300 text-amber-300" />
                  Live AI Strategy Suggestion
                </span>

                <span
                  className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                    strategySuggestion.activeNow
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 animate-pulse'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                  }`}
                >
                  <Clock className="w-2.5 h-2.5 mr-1" />
                  {strategySuggestion.activeNow ? '🟢 ACTIVE NOW' : '⏳ UPCOMING'} • {strategySuggestion.timeWindowLabel}
                </span>

                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-amber-300 border border-amber-500/30">
                  {strategySuggestion.expiryIndexToday}
                </span>

                <span className="text-[11px] text-gray-400 font-mono">
                  IST: {strategySuggestion.dateTime}
                </span>
              </div>

              <div className="flex items-baseline space-x-2 flex-wrap">
                <h3 className="text-base sm:text-xl font-black text-white flex items-center gap-2">
                  <span>{strategySuggestion.strategyName}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-md bg-gray-800/90 text-amber-400 font-bold border border-gray-700">
                    {strategySuggestion.badge}
                  </span>
                </h3>
              </div>

              <p className="text-xs text-gray-300 leading-relaxed max-w-4xl">
                {strategySuggestion.reason}
              </p>

              {/* Strategy Telemetry Chips */}
              <div className="flex items-center space-x-3 sm:space-x-5 text-xs pt-1 flex-wrap gap-y-1.5">
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-gray-950/70 border border-gray-800">
                  <span className="text-gray-400">Trade Sizing:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {hudSlab > 0 ? `₹${hudSlab.toLocaleString('en-IN')} Slab` : 'Dynamic Lots (No Cap)'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-gray-950/70 border border-gray-800">
                  <span className="text-gray-400">Target Profit:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    +{strategySuggestion.targetProfitPct}%
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-gray-950/70 border border-gray-800">
                  <span className="text-gray-400">Stop-Loss:</span>
                  <span className="font-mono font-bold text-rose-400">
                    -{strategySuggestion.stopLossPct}%
                  </span>
                </div>
              </div>

              {/* Quick Investment Slab Selector Pills & Manual Input */}
              <div className="flex items-center gap-1.5 flex-wrap pt-1.5">
                <span className="text-[11px] text-gray-400 font-semibold mr-1">Investment Slab:</span>
                {[
                  { label: 'Dynamic Lots', val: 0 },
                  { label: '₹5,000', val: 5000 },
                  { label: '₹10,000', val: 10000 },
                  { label: '₹25,000', val: 25000 },
                ].map((s) => (
                  <button
                    key={s.val}
                    type="button"
                    onClick={() => setHudSlab(s.val)}
                    className={`px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold transition-all border ${
                      hudSlab === s.val
                        ? 'bg-amber-500 text-gray-950 border-amber-400 shadow-sm'
                        : 'bg-gray-900/90 text-gray-300 border-gray-700 hover:border-amber-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}

                <div className="flex items-center bg-gray-900 border border-gray-700 rounded-lg px-2 py-0.5">
                  <span className="text-gray-400 text-[11px] font-mono mr-1">₹</span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={hudSlab || ''}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      setHudSlab(isNaN(v) ? 0 : Math.max(0, v));
                    }}
                    placeholder="Custom Slab"
                    className="w-20 bg-transparent text-[11px] font-mono text-white focus:outline-none"
                    title="Type any manual investment amount"
                  />
                </div>
              </div>
            </div>

            {/* Strategy Action Buttons */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0 pt-2 lg:pt-0 flex-wrap gap-y-2">
              <button
                type="button"
                onClick={() =>
                  handleArmStrategy(
                    strategySuggestion.recommendedStrategy,
                    hudSlab,
                    strategySuggestion.targetProfitPct,
                    strategySuggestion.stopLossPct
                  )
                }
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-gray-950 font-black text-xs shadow-lg shadow-amber-500/25 flex items-center space-x-1.5 transition-all transform active:scale-95"
              >
                <Zap className="w-4 h-4 fill-current" />
                <span>Arm Strategy ({hudSlab > 0 ? `₹${hudSlab.toLocaleString('en-IN')} Slab` : 'Dynamic Lots'})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutoPilot((p) => ({
                    ...p,
                    strategy: strategySuggestion.recommendedStrategy,
                    profitTargetPct: strategySuggestion.targetProfitPct,
                    stopLossPct: strategySuggestion.stopLossPct,
                  }));
                  setIsAutoPilotModalOpen(true);
                }}
                className="px-3.5 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 text-gray-200 border border-gray-700 font-bold text-xs flex items-center space-x-1 transition-colors"
                title="Customize lots, target %, or set optional budget cap"
              >
                <Sliders className="w-3.5 h-3.5 text-gray-400" />
                <span>Customize</span>
              </button>

              <button
                type="button"
                onClick={() => setIsScheduleModalOpen(true)}
                className="px-3.5 py-2.5 rounded-xl bg-gray-800/90 hover:bg-gray-700/90 text-gray-200 border border-gray-700 font-bold text-xs flex items-center space-x-1.5 transition-colors"
                title="View full strategy schedule timetable, active days & database logs"
              >
                <Calendar className="w-4 h-4 text-blue-400" />
                <span>Timetable & DB Logs</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4-Card Quick KPI Telemetry Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* KPI 1: AI Signal Flow */}
        <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800/80 shadow-lg space-y-2 hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">AI Signal Flow</span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <Activity className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl sm:text-2xl font-black text-white font-mono">
              {signals.length}
            </span>
            <span className="text-xs text-gray-400">Signals Detected</span>
          </div>
          <div className="flex items-center space-x-2 text-xs font-mono font-bold pt-0.5">
            <span className="text-emerald-400">{buyCount} Longs</span>
            <span className="text-gray-600">•</span>
            <span className="text-rose-400">{sellCount} Shorts</span>
            <span className="text-gray-600">•</span>
            <span className="text-amber-400">{holdCount} Neutral</span>
          </div>
        </div>

        {/* KPI 2: Autonomous Engine Status */}
        <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800/80 shadow-lg space-y-2 hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Auto-Pilot Engine</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Bot className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-xl sm:text-2xl font-black font-mono ${autoPilot.enabled ? 'text-emerald-400' : 'text-gray-400'}`}>
              {autoPilot.enabled ? 'ACTIVE' : 'IDLE'}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-300 font-semibold text-[11px]">
              {autoPilot.mode}
            </span>
          </div>
          <div className="text-xs text-gray-400 truncate">
            {autoPilot.strategy.replace('_', ' ')} • {autoPilot.executedToday || 0}/{autoPilot.maxDailyTrades || 5} Fills Today
          </div>
        </div>

        {/* KPI 3: Available Margin & Sizing */}
        <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800/80 shadow-lg space-y-2 hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Broker Margin Cash</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <Wallet className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              ₹{brokerFunds ? brokerFunds.available.toLocaleString('en-IN') : '10,000'}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-gray-400 pt-0.5">
            <span>Sizing: Dynamic Lots</span>
            {brokerFunds && brokerFunds.available > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBudgetInput('5000');
                  handleRunBudgetAnalysis(5000);
                  setActiveTab('budget');
                }}
                className="text-[11px] font-bold text-blue-400 hover:text-blue-300 underline"
              >
                Allocate ₹5k
              </button>
            )}
          </div>
        </div>

        {/* KPI 4: Market Session & Expiry */}
        <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800/80 shadow-lg space-y-2 hover:border-gray-700 transition-colors">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span className="font-semibold uppercase tracking-wider text-[11px]">Market Timing & Expiry</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl sm:text-2xl font-black text-purple-300 font-mono truncate">
              {strategySuggestion?.expiryIndexToday || 'NIFTY 50'}
            </span>
          </div>
          <div className="text-xs text-gray-400 flex items-center space-x-1.5 truncate">
            <span className={`w-1.5 h-1.5 rounded-full ${marketStatus?.isOpen ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            <span>{marketStatus?.isOpen ? 'Regular Trading Session' : (marketStatus?.subStatus || 'Closed')}</span>
          </div>
        </div>
      </div>

      {/* Navigation View Tabs */}
      <AiTradingNavTabs
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'budget' && !budgetAnalysis && !isAnalyzingBudget) {
            handleRunBudgetAnalysis();
          }
        }}
        signalsCount={signals.length}
        ordersCount={orders.length}
        buyCount={buyCount}
        sellCount={sellCount}
        holdCount={holdCount}
        brokerFunds={brokerFunds}
        onUseBrokerFunds={(amount) => {
          if (amount < 500) {
            showValidationModal({
              title: 'Insufficient Broker Margin',
              message: `Your available broker cash (₹${amount.toLocaleString('en-IN')}) is below the minimum required ₹500.`,
              type: 'warning',
              suggestion: 'Please transfer funds to your Angel One account or use Paper mode with recommended presets.',
              actionLabel: 'Use ₹5,000 Preset',
              onAction: () => {
                setBudgetInput('5000');
                handleRunBudgetAnalysis(5000);
              },
            });
            return;
          }
          setBudgetInput(String(amount));
          handleRunBudgetAnalysis(amount);
        }}
        layoutMode={layoutMode}
        onToggleLayoutMode={setLayoutMode}
      />

      {/* Main Content Workspace */}
      {/* 1. Studio Split Deck (Signals on Left, Chart on Right) */}
      {layoutMode === 'STUDIO' && activeTab === 'signals' ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start animate-in fade-in duration-200">
          {/* Left Column: AI Signals Matrix */}
          <div className="lg:col-span-7 xl:col-span-7 space-y-4">
            <AiSignalsTab
              signals={signals}
              filteredSignals={filteredSignals}
              selectedSegment={selectedSegment}
              onSelectSegment={(seg) => {
                setSelectedSegment(seg);
                loadSignals(false, seg);
              }}
              filterAction={filterAction}
              onFilterChange={setFilterAction}
              buyCount={buyCount}
              sellCount={sellCount}
              lastScanTime={lastScanTime}
              isScanning={isScanning}
              scanError={scanError}
              onRetryScan={() => loadSignals(true)}
              fnoUnderlying={fnoUnderlying}
              setFnoUnderlying={setFnoUnderlying}
              fnoStrike={fnoStrike}
              setFnoStrike={setFnoStrike}
              fnoOptionType={fnoOptionType}
              setFnoOptionType={setFnoOptionType}
              isLookingUpOption={isLookingUpOption}
              onLookupOption={handleLookupOption}
              priceFlashes={priceFlashes}
              getLiveQuote={getLiveQuote}
              autoPilotMode={autoPilot.mode}
              onOpenChart={(sym) => {
                setSelectedChartSymbol(sym);
              }}
              onExecuteSignal={handleOpenExecuteModal}
              onOpenBudgetAdvisor={() => {
                setActiveTab('budget');
                if (!budgetAnalysis && !isAnalyzingBudget) {
                  handleRunBudgetAnalysis();
                }
              }}
            />
          </div>

          {/* Right Column: Live Chart Studio & Telemetry */}
          <div className="lg:col-span-5 xl:col-span-5 lg:sticky lg:top-4 space-y-4">
            <div className="rounded-2xl border border-gray-800 bg-gray-900/90 shadow-xl overflow-hidden p-1">
              <AiTradingChartTab
                selectedChartSymbol={selectedChartSymbol}
                onSelectChartSymbol={setSelectedChartSymbol}
                chartInterval={chartInterval}
                onChangeChartInterval={setChartInterval}
                signals={signals}
                priceFlashes={priceFlashes}
                getLiveQuote={getLiveQuote}
                onExecuteSignal={handleOpenExecuteModal}
              />
            </div>
          </div>
        </div>
      ) : (
        /* 2. Full Width Dedicated Views */
        <div className="animate-in fade-in duration-200">
          {/* Tab 1: AI Signals Matrix (Full Width) */}
          {activeTab === 'signals' && (
            <AiSignalsTab
              signals={signals}
              filteredSignals={filteredSignals}
              selectedSegment={selectedSegment}
              onSelectSegment={(seg) => {
                setSelectedSegment(seg);
                loadSignals(false, seg);
              }}
              filterAction={filterAction}
              onFilterChange={setFilterAction}
              buyCount={buyCount}
              sellCount={sellCount}
              lastScanTime={lastScanTime}
              isScanning={isScanning}
              scanError={scanError}
              onRetryScan={() => loadSignals(true)}
              fnoUnderlying={fnoUnderlying}
              setFnoUnderlying={setFnoUnderlying}
              fnoStrike={fnoStrike}
              setFnoStrike={setFnoStrike}
              fnoOptionType={fnoOptionType}
              setFnoOptionType={setFnoOptionType}
              isLookingUpOption={isLookingUpOption}
              onLookupOption={handleLookupOption}
              priceFlashes={priceFlashes}
              getLiveQuote={getLiveQuote}
              autoPilotMode={autoPilot.mode}
              onOpenChart={(sym) => {
                setSelectedChartSymbol(sym);
                setActiveTab('chart');
              }}
              onExecuteSignal={handleOpenExecuteModal}
              onOpenBudgetAdvisor={() => {
                setActiveTab('budget');
                if (!budgetAnalysis && !isAnalyzingBudget) {
                  handleRunBudgetAnalysis();
                }
              }}
            />
          )}

          {/* Tab 2: AI Budget Trade Advisor & Capital Allocator */}
          {activeTab === 'budget' && (
            <AiBudgetAllocatorTab
              budgetInput={budgetInput}
              setBudgetInput={setBudgetInput}
              budgetRiskProfile={budgetRiskProfile}
              setBudgetRiskProfile={setBudgetRiskProfile}
              budgetSegment={budgetSegment}
              setBudgetSegment={setBudgetSegment}
              budgetMaxTrades={budgetMaxTrades}
              setBudgetMaxTrades={setBudgetMaxTrades}
              budgetAnalysis={budgetAnalysis}
              isAnalyzingBudget={isAnalyzingBudget}
              budgetError={budgetError}
              brokerFunds={brokerFunds}
              isLoadingFunds={isLoadingFunds}
              onLoadBrokerFunds={loadBrokerFunds}
              onRunBudgetAnalysis={handleRunBudgetAnalysis}
              onAllocateVolatileOption={handleAllocateVolatileOption}
              fnoCallsList={(fnoMoversQuery.data?.calls as any[]) || []}
              fnoPutsList={(fnoMoversQuery.data?.puts as any[]) || []}
              volatileRadarTab={volatileRadarTab}
              setVolatileRadarTab={setVolatileRadarTab}
              onOpenChart={(sym) => {
                setSelectedChartSymbol(sym);
                setActiveTab('chart');
              }}
              onOpenExecuteModal={handleOpenExecuteModal}
              onOpenAutoPilotModal={(customBudget) => {
                if (customBudget) {
                  setAutoPilot((p) => ({ ...p, maxBudgetPerTrade: customBudget }));
                }
                setIsAutoPilotModalOpen(true);
              }}
            />
          )}

          {/* Tab 3: Option Chain Scanner */}
          {activeTab === 'option-chain' && (
            <AiOptionChainScannerTab
              onOpenExecuteModal={handleOpenExecuteModal}
            />
          )}

          {/* Tab 4: Interactive TradingView Chart (Full Width) */}
          {activeTab === 'chart' && (
            <AiTradingChartTab
              selectedChartSymbol={selectedChartSymbol}
              onSelectChartSymbol={setSelectedChartSymbol}
              chartInterval={chartInterval}
              onChangeChartInterval={setChartInterval}
              signals={signals}
              priceFlashes={priceFlashes}
              getLiveQuote={getLiveQuote}
              onExecuteSignal={handleOpenExecuteModal}
            />
          )}

          {/* Tab 4: Deep Scrip Analyzer */}
          {activeTab === 'analyzer' && (
            <AiScripAnalyzerTab
              selectedScrip={selectedScrip}
              onSelectScrip={setSelectedScrip}
              customSymbol={customSymbol}
              setCustomSymbol={setCustomSymbol}
              customToken={customToken}
              setCustomToken={setCustomToken}
              analyzedSignal={analyzedSignal}
              isAnalyzing={isAnalyzing}
              onAnalyzeScrip={handleAnalyzeScrip}
              priceFlashes={priceFlashes}
              getLiveQuote={getLiveQuote}
              onOpenExecuteModal={handleOpenExecuteModal}
            />
          )}

          {/* Tab 5: Order Execution Book */}
          {activeTab === 'orders' && (
            <AiOrderBookTab
              orders={orders}
              isLoadingOrders={isLoadingOrders}
              onRefreshOrders={loadOrders}
            />
          )}
        </div>
      )}

      {/* 1-Click Order Execution Modal */}
      <AiOrderExecutionModal
        executingSignal={executingSignal}
        onClose={() => setExecutingSignal(null)}
        execMode={execMode}
        setExecMode={setExecMode}
        execQuantity={execQuantity}
        setExecQuantity={setExecQuantity}
        execLots={execLots}
        setExecLots={setExecLots}
        execProductType={execProductType}
        setExecProductType={setExecProductType}
        execOrderType={execOrderType}
        setExecOrderType={setExecOrderType}
        execLimitPrice={execLimitPrice}
        setExecLimitPrice={setExecLimitPrice}
        isExecuting={isExecuting}
        onConfirmOrder={handleConfirmOrder}
      />

      {/* Auto-Pilot Settings Modal */}
      <AiAutoPilotModal
        isOpen={isAutoPilotModalOpen}
        onClose={() => setIsAutoPilotModalOpen(false)}
        config={autoPilot}
        onSave={handleSaveAutoPilot}
      />

      {/* Dynamic Scanning Universe Management Modal */}
      <AiUniverseModal
        isOpen={isUniverseModalOpen}
        onClose={() => setIsUniverseModalOpen(false)}
        universe={universe}
        isLoadingUniverse={isLoadingUniverse}
        universeSearchQuery={universeSearchQuery}
        onSearchQueryChange={handleUniverseSearch}
        universeSearchResults={universeSearchResults}
        isSearchingUniverse={isSearchingUniverse}
        universeFilter={universeFilter}
        setUniverseFilter={setUniverseFilter}
        onAddScrip={handleAddUniverseScrip}
        onRemoveScrip={handleRemoveUniverseScrip}
        onResetUniverse={handleResetUniverse}
        onReScanUniverse={() => loadSignals(true)}
      />

      {/* F&O Strategy Timetable & Database Logs Modal */}
      <AiStrategyScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        liveSuggestion={strategySuggestion}
        schedules={strategySchedules}
        historyLogs={strategyLogs}
        onArmStrategy={handleArmStrategy}
        isLoading={isLoadingSchedule}
      />
    </div>
  );
};

export default AiTradingScreen;
