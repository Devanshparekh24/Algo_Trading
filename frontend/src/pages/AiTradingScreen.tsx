import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, X } from 'lucide-react';
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
  type TradeSignal,
  type AutoPilotConfig,
  type OrderBookItem,
  type MarketSegment,
  type UniverseScrip,
  type BudgetAnalysisResult,
  type RiskProfile,
  type BudgetSegment,
  type VolatileOptionItem,
} from '../services/aiTradingService';
import { useFnoMovers } from '../hooks/useMarket';
import { getRMSLimit } from '../services/authService';
import { getSocket, requestAiPricesRefresh, type RealtimeTickData } from '../services/socketService';
import { AiTradingHeader } from '../components/aiTrading/AiTradingHeader';
import { AiTradingNavTabs, type AiTradingTab } from '../components/aiTrading/AiTradingNavTabs';
import { AiSignalsTab } from '../components/aiTrading/AiSignalsTab';
import { AiBudgetAllocatorTab } from '../components/aiTrading/AiBudgetAllocatorTab';
import { AiTradingChartTab } from '../components/aiTrading/AiTradingChartTab';
import { AiScripAnalyzerTab, POPULAR_SCRIPS } from '../components/aiTrading/AiScripAnalyzerTab';
import { AiOrderBookTab } from '../components/aiTrading/AiOrderBookTab';
import { AiOrderExecutionModal } from '../components/aiTrading/AiOrderExecutionModal';
import { AiAutoPilotModal } from '../components/aiTrading/AiAutoPilotModal';
import { AiUniverseModal } from '../components/aiTrading/AiUniverseModal';

export const AiTradingScreen: React.FC = () => {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<AiTradingTab>('signals');
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL' | 'HIGH_CONFIDENCE'>('ALL');

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
  const [isAutoPilotModalOpen, setIsAutoPilotModalOpen] = useState(false);

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
    type: 'success' | 'error';
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
    const amount = customBudget !== undefined ? customBudget : parseFloat(budgetInput.replace(/,/g, ''));
    if (!amount || isNaN(amount) || amount < 500) {
      setBudgetError('Please enter a budget of at least ₹500');
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
      setBudgetError(err?.message || 'Failed to generate budget suggestions');
    } finally {
      setIsAnalyzingBudget(false);
    }
  }, [budgetInput, budgetRiskProfile, budgetSegment, budgetMaxTrades]);

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
  }, [loadSignals, loadAutoPilot, loadOrders, loadUniverse, loadBrokerFunds]);

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
      setExecutionToast({
        type: 'success',
        message: `Auto-Pilot executed ${payload.signal?.action} order for ${payload.signal?.symbol} (${payload.mode} Mode)`,
      });
      loadOrders();
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
    setIsExecuting(true);
    try {
      const isFno = executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO' || executingSignal.symbol.endsWith('CE') || executingSignal.symbol.endsWith('PE');
      const lotSize = executingSignal.lotSize || 65;
      const finalQuantity = isFno ? execLots * lotSize : execQuantity;

      const res = await executeSignalOrder({
        signalId: executingSignal.id,
        quantity: finalQuantity,
        lots: isFno ? execLots : undefined,
        productType: execProductType,
        orderType: execOrderType,
        limitPrice: execOrderType === 'LIMIT' ? execLimitPrice : undefined,
        mode: execMode,
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
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Order execution failed',
      });
    } finally {
      setIsExecuting(false);
    }
  };

  // Save AutoPilot settings
  const handleSaveAutoPilot = async (updated: Partial<AutoPilotConfig>) => {
    try {
      const res = await updateAutoPilotConfig(updated);
      setAutoPilot(res);
      setExecutionToast({
        type: 'success',
        message: `Auto-Pilot updated: ${res.enabled ? 'ACTIVE' : 'PAUSED'} (${res.mode} Mode, ${res.minConfidence}% min confidence)`,
      });
      setIsAutoPilotModalOpen(false);
    } catch (err: any) {
      setExecutionToast({
        type: 'error',
        message: err?.message || 'Failed to update Auto-Pilot',
      });
    }
  };

  // Filtered Signals
  const filteredSignals = useMemo(() => {
    return signals.filter((s) => {
      if (filterAction === 'BUY') return s.action === 'BUY';
      if (filterAction === 'SELL') return s.action === 'SELL';
      if (filterAction === 'HIGH_CONFIDENCE') return s.confidence >= 80;
      return true;
    });
  }, [signals, filterAction]);

  // Statistics
  const buyCount = useMemo(() => signals.filter((s) => s.action === 'BUY').length, [signals]);
  const sellCount = useMemo(() => signals.filter((s) => s.action === 'SELL').length, [signals]);
  const holdCount = useMemo(() => signals.filter((s) => s.action === 'HOLD').length, [signals]);

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto px-4 sm:px-6">
      {/* Toast Notification */}
      {executionToast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl shadow-2xl border text-sm transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${
            executionToast.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-200 border-emerald-500/50 backdrop-blur-md'
              : 'bg-rose-950/90 text-rose-200 border-rose-500/50 backdrop-blur-md'
          }`}
        >
          {executionToast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
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

      {/* Top Header Card */}
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
      />

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
          setBudgetInput(String(amount));
          handleRunBudgetAnalysis(amount);
        }}
      />

      {/* Tab 1: AI Signals Matrix */}
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
          fnoCallsList={fnoMoversQuery.data?.calls as any[] || []}
          fnoPutsList={fnoMoversQuery.data?.puts as any[] || []}
          volatileRadarTab={volatileRadarTab}
          setVolatileRadarTab={setVolatileRadarTab}
          onOpenChart={(sym) => {
            setSelectedChartSymbol(sym);
            setActiveTab('chart');
          }}
          onOpenExecuteModal={handleOpenExecuteModal}
        />
      )}

      {/* Tab 3: Interactive TradingView Chart */}
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
    </div>
  );
};

export default AiTradingScreen;
