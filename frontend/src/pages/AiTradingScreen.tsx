import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot,
  Zap,
  RefreshCw,
  Play,
  Sliders,
  CheckCircle2,
  AlertCircle,
  Radio,
  ArrowUpRight,
  ArrowDownRight,
  Search,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  Clock,
  History,
  X,
  BarChart2,
  Flame,
  Layers,
  Target,
  Plus,
  Trash2,
  Briefcase,
  Wallet,
  Coins,
  ShieldCheck,
  Check,
} from 'lucide-react';
import TradingViewChart from '../components/tradingview/TradingViewChart';
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
import { formatINR } from '../utils/formatters';

const POPULAR_SCRIPS = [
  { symbol: 'RELIANCE-EQ', token: '2885', exchange: 'NSE', name: 'Reliance' },
  { symbol: 'TATASTEEL-EQ', token: '3499', exchange: 'NSE', name: 'Tata Steel' },
  { symbol: 'SBIN-EQ', token: '3045', exchange: 'NSE', name: 'SBI' },
  { symbol: 'HDFCBANK-EQ', token: '1333', exchange: 'NSE', name: 'HDFC Bank' },
  { symbol: 'INFY-EQ', token: '1594', exchange: 'NSE', name: 'Infosys' },
  { symbol: 'ICICIBANK-EQ', token: '4963', exchange: 'NSE', name: 'ICICI Bank' },
  { symbol: 'TCS-EQ', token: '11536', exchange: 'NSE', name: 'TCS' },
  { symbol: 'ITC-EQ', token: '1660', exchange: 'NSE', name: 'ITC' },
];

export const AiTradingScreen: React.FC = () => {
  // Navigation / View Tabs
  const [activeTab, setActiveTab] = useState<'signals' | 'budget' | 'chart' | 'analyzer' | 'orders'>('signals');
  const [filterAction, setFilterAction] = useState<'ALL' | 'BUY' | 'SELL' | 'HIGH_CONFIDENCE'>('ALL');

  // Segment State: EQUITY (Cash) vs FNO (Futures & Options)
  const [selectedSegment, setSelectedSegment] = useState<MarketSegment>('EQUITY');

  // Realtime WebSocket Live Prices & Ticks
  const [livePrices, setLivePrices] = useState<Record<string, RealtimeTickData>>({});
  const [priceFlashes, setPriceFlashes] = useState<Record<string, 'up' | 'down'>>({});
  const [lastTickAt, setLastTickAt] = useState<string | null>(null);
  const [totalTicksReceived, setTotalTicksReceived] = useState<number>(0);
  const flashTimers = React.useRef<Record<string, ReturnType<typeof setTimeout>>>({});

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

  // Query live volatile F&O options
  const fnoMoversQuery = useFnoMovers();

  // F&O Strike Quick Selector & Lookup State
  const [fnoUnderlying, setFnoUnderlying] = useState<string>('NIFTY');
  const [fnoStrike, setFnoStrike] = useState<number>(25000);
  const [fnoOptionType, setFnoOptionType] = useState<'CE' | 'PE'>('PE');
  const [isLookingUpOption, setIsLookingUpOption] = useState<boolean>(false);

  // TradingView Chart State
  const [selectedChartSymbol, setSelectedChartSymbol] = useState<string>('NSE:RELIANCE');
  const [chartInterval, setChartInterval] = useState<'1' | '5' | '15' | '60' | 'D'>('15');

  // Signals State
  const [signals, setSignals] = useState<TradeSignal[]>([]);
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanError, setScanError] = useState<string | null>(null);

  // Auto-Pilot State
  const [autoPilot, setAutoPilot] = useState<AutoPilotConfig>({
    enabled: false,
    mode: 'PAPER',
    minConfidence: 75,
    defaultQuantity: 1,
    productType: 'INTRADAY',
    maxDailyTrades: 5,
    executedToday: 0,
  });
  const [isAutoPilotModalOpen, setIsAutoPilotModalOpen] = useState(false);

  // Dynamic Scanning Universe State
  const [ universe, setUniverse] = useState<UniverseScrip[]>([]);
  const [isUniverseModalOpen, setIsUniverseModalOpen] = useState(false);
  const [isLoadingUniverse, setIsLoadingUniverse] = useState(false);
  const [universeSearchQuery, setUniverseSearchQuery] = useState('');
  const [universeSearchResults, setUniverseSearchResults] = useState<any[]>([]);
  const [isSearchingUniverse, setIsSearchingUniverse] = useState(false);
  const [universeFilter, setUniverseFilter] = useState<'ALL' | 'CUSTOM' | 'HOLDING' | 'MARKET_MOVER' | 'CORE'>('ALL');

  // On-Demand Analyzer State
  const [selectedScrip, setSelectedScrip] = useState(POPULAR_SCRIPS[0]);
  const [customSymbol, setCustomSymbol] = useState('');
  const [customToken, setCustomToken] = useState('');
  const [analyzedSignal, setAnalyzedSignal] = useState<TradeSignal | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Order Execution Modal State
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

  // WebSocket Live Updates
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

  // Whenever selectedChartSymbol changes, request immediate live quotes from WebSocket for this share
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

    const handleSignalExecuted = () => {
      loadOrders();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('ai_signals_update', handleAiSignalsUpdate);
    socket.on('ai_auto_trade_executed', handleAiAutoTradeExecuted);
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
      const isFno = executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO';
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
            onClick={() => setExecutionToast(null)}
            className="text-gray-400 hover:text-white ml-2"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-900/40 via-purple-900/30 to-indigo-950/40 border border-blue-500/30 p-6 backdrop-blur-xl shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
                <Bot className="w-6 h-6 animate-pulse" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                AI Trading Terminal
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-semibold border border-blue-400/30 uppercase tracking-wider">
                  v2.0 SmartAPI
                </span>
              </h1>
            </div>
            <p className="text-sm text-gray-300">
              Autonomous multi-factor technical analysis, high-probability trade signals, and 1-click Angel One order execution.
            </p>
          </div>

          {/* Quick Actions & Live Badge */}
          <div className="flex flex-wrap items-center gap-3">
            <div
              className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl border text-xs font-medium ${
                isLiveConnected
                  ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300'
                  : 'bg-amber-950/50 border-amber-500/40 text-amber-300'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isLiveConnected ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
                }`}
              />
              <span>
                {isLiveConnected
                  ? `Live WebSocket Active (${totalTicksReceived} ticks${lastTickAt ? ` • ${lastTickAt}` : ''})`
                  : 'Connecting WebSocket...'}
              </span>
              {isLiveConnected && (
                <button
                  type="button"
                  onClick={() => requestAiPricesRefresh()}
                  title="Force refresh live quotes over WebSocket"
                  className="p-1 rounded-md text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all ml-1"
                >
                  <RefreshCw className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Trading Mode Switcher */}
            <div className="flex items-center bg-gray-900/80 p-1 rounded-xl border border-gray-700/80">
              <button
                onClick={() => handleSaveAutoPilot({ mode: 'PAPER' })}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  autoPilot.mode === 'PAPER'
                    ? 'bg-amber-500/30 text-amber-300 border border-amber-400/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Paper Mode
              </button>
              <button
                onClick={() => handleSaveAutoPilot({ mode: 'LIVE' })}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  autoPilot.mode === 'LIVE'
                    ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/40'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                Live Broker
              </button>
            </div>

            {/* Auto-Pilot Trigger Button */}
            <button
              onClick={() => setIsAutoPilotModalOpen(true)}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all border shadow-sm ${
                autoPilot.enabled
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 animate-pulse'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200 border-gray-600'
              }`}
            >
              <Sliders className="w-4 h-4" />
              <span>Auto-Pilot: {autoPilot.enabled ? 'ACTIVE' : 'OFF'}</span>
            </button>

            {/* Dynamic Scanning Universe Button */}
            <button
              onClick={() => {
                setIsUniverseModalOpen(true);
                loadUniverse();
              }}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-purple-900/40 hover:bg-purple-800/60 text-purple-200 border border-purple-500/40 text-xs font-semibold transition-all shadow-sm"
              title="Manage Dynamic AI Scanning Universe"
            >
              <Layers className="w-4 h-4 text-purple-400" />
              <span>AI Universe ({universe.length > 0 ? universe.length : 'Dynamic'})</span>
            </button>

            {/* Scan Button */}
            <button
              onClick={() => loadSignals(true)}
              disabled={isScanning}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold transition-all shadow-md disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isScanning ? 'animate-spin' : ''}`} />
              <span>{isScanning ? 'Scanning...' : 'Scan Market'}</span>
            </button>
          </div>
        </div>

        {/* Live Auto-Pilot Glowing Indicator Banner if Enabled */}
        {autoPilot.enabled && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span>
                <strong>Auto-Pilot Engaged:</strong> Auto-executing signals with confidence &ge; {autoPilot.minConfidence}% in <strong>{autoPilot.mode}</strong> mode ({autoPilot.executedToday}/{autoPilot.maxDailyTrades} trades filled today).
              </span>
            </div>
            <button
              onClick={() => handleSaveAutoPilot({ enabled: false })}
              className="text-xs text-rose-300 hover:underline font-medium"
            >
              Pause Auto-Pilot
            </button>
          </div>
        )}
      </div>

      {/* Navigation View Tabs */}
      <div className="flex items-center justify-between border-b border-gray-700/60 pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab('signals')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'signals'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Zap className="w-4 h-4" />
            <span>AI Signals ({signals.length})</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('budget');
              if (!budgetAnalysis && !isAnalyzingBudget) {
                handleRunBudgetAnalysis();
              }
            }}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'budget'
                ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/30'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Wallet className="w-4 h-4 text-emerald-400" />
            <span>AI Budget Advisor</span>
            <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
              Smart Sizing
            </span>
          </button>
          <button
            onClick={() => setActiveTab('chart')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'chart'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>TradingView Chart</span>
          </button>
          <button
            onClick={() => setActiveTab('analyzer')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'analyzer'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            <span>Deep Scrip Analyzer</span>
          </button>
          <button
            onClick={() => setActiveTab('orders')}
            className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
              activeTab === 'orders'
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'text-gray-400 hover:text-white hover:bg-gray-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Execution Book ({orders.length})</span>
          </button>
        </div>

        {/* Signal Counts Pills / Broker Cash Pill */}
        {activeTab === 'signals' && (
          <div className="hidden sm:flex items-center space-x-3 text-xs">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
              BUY: {buyCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-rose-950/60 text-rose-300 border border-rose-500/30">
              SELL: {sellCount}
            </span>
            <span className="px-2.5 py-1 rounded-lg bg-amber-950/60 text-amber-300 border border-amber-500/30">
              HOLD: {holdCount}
            </span>
          </div>
        )}
        {activeTab === 'budget' && brokerFunds && (
          <div className="hidden sm:flex items-center space-x-2 text-xs">
            <span className="px-3 py-1.5 rounded-xl bg-gray-900 border border-gray-800 text-gray-300 flex items-center gap-1.5 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Broker Cash: <strong className="text-emerald-400">₹{brokerFunds.available.toLocaleString('en-IN')}</strong>
            </span>
            <button
              onClick={() => {
                setBudgetInput(String(brokerFunds.available));
                handleRunBudgetAnalysis(brokerFunds.available);
              }}
              className="text-xs text-blue-400 hover:text-blue-300 underline font-medium"
            >
              Use Funds
            </button>
          </div>
        )}
      </div>

      {/* Quick Callout on Signals Tab */}
      {activeTab === 'signals' && (
        <div className="bg-gradient-to-r from-emerald-950/40 via-blue-950/30 to-purple-950/40 border border-emerald-500/30 rounded-2xl p-4 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white flex items-center gap-2">
                <span>AI Budget Trade Advisor</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40">
                  Custom Capital Sizing
                </span>
              </h4>
              <p className="text-xs text-gray-300 mt-0.5">
                Have a specific capital (e.g. ₹5,000, ₹10,000, ₹50,000)? Let AI calculate affordable share quantities and option lots with strict stop-loss allocation.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setActiveTab('budget');
              if (!budgetAnalysis && !isAnalyzingBudget) {
                handleRunBudgetAnalysis();
              }
            }}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 flex items-center space-x-1.5 whitespace-nowrap transition-all"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Open Budget Advisor</span>
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: AI SIGNALS MATRIX */}
      {/* ========================================================================= */}
      {activeTab === 'signals' && (
        <div className="space-y-4">
          {/* Segment Selector: EQUITY vs F&O */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl bg-gray-900/90 border border-gray-800">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-gray-400 uppercase mr-1">Trading Segment:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedSegment('EQUITY');
                  loadSignals(false, 'EQUITY');
                }}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedSegment === 'EQUITY'
                    ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Equity Cash Stocks</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSegment('FNO');
                  loadSignals(false, 'FNO');
                }}
                className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                  selectedSegment === 'FNO'
                    ? 'bg-gradient-to-r from-purple-600 to-rose-600 text-white border-rose-400 shadow-md shadow-rose-500/20'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-white'
                }`}
              >
                <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                <span>Futures & Options (F&O)</span>
              </button>
            </div>

            {selectedSegment === 'FNO' && (
              <span className="text-[11px] text-purple-300 bg-purple-950/60 border border-purple-500/30 px-3 py-1 rounded-xl">
                Real-time NFO Options & Futures with dynamic lot sizes & OI tracking
              </span>
            )}
          </div>

          {/* F&O Option Strike Quick Selector & Custom Builder (When F&O is active) */}
          {selectedSegment === 'FNO' && (
            <div className="p-4 rounded-2xl bg-gradient-to-r from-purple-950/40 via-gray-900 to-indigo-950/30 border border-purple-500/30 space-y-3 shadow-xl">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Target className="w-4 h-4 text-rose-400" />
                  Quick Option Strikes:
                </span>
                <span className="text-[11px] text-gray-400">
                  Click any strike to generate instant live AI Option Signal
                </span>
              </div>

              {/* Quick Option Strike Chips */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'NIFTY 25000 PE', under: 'NIFTY', strike: 25000, type: 'PE' as const },
                  { label: 'NIFTY 25000 CE', under: 'NIFTY', strike: 25000, type: 'CE' as const },
                  { label: 'NIFTY 24500 PE', under: 'NIFTY', strike: 24500, type: 'PE' as const },
                  { label: 'NIFTY 24500 CE', under: 'NIFTY', strike: 24500, type: 'CE' as const },
                  { label: 'NIFTY 25200 PE', under: 'NIFTY', strike: 25200, type: 'PE' as const },
                  { label: 'NIFTY 25200 CE', under: 'NIFTY', strike: 25200, type: 'CE' as const },
                  { label: 'BANKNIFTY 53400 PE', under: 'BANKNIFTY', strike: 53400, type: 'PE' as const },
                  { label: 'BANKNIFTY 53100 CE', under: 'BANKNIFTY', strike: 53100, type: 'CE' as const },
                ].map((item) => (
                  <button
                    key={`${item.under}_${item.strike}_${item.type}`}
                    type="button"
                    onClick={() => {
                      setFnoUnderlying(item.under);
                      setFnoStrike(item.strike);
                      setFnoOptionType(item.type);
                      handleLookupOption(item.under, item.strike, item.type);
                    }}
                    disabled={isLookingUpOption}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                      item.type === 'PE'
                        ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border-rose-500/40 hover:border-rose-400'
                        : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border-emerald-500/40 hover:border-emerald-400'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Custom Strike Option Builder */}
              <div className="pt-3 border-t border-purple-500/20 flex flex-col sm:flex-row items-center gap-2">
                <select
                  value={fnoUnderlying}
                  onChange={(e) => setFnoUnderlying(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs font-semibold focus:outline-none focus:border-purple-500"
                >
                  <option value="NIFTY">NIFTY</option>
                  <option value="BANKNIFTY">BANKNIFTY</option>
                  <option value="FINNIFTY">FINNIFTY</option>
                  <option value="RELIANCE">RELIANCE</option>
                </select>

                <input
                  type="number"
                  placeholder="Strike Price (e.g. 25000)"
                  value={fnoStrike}
                  onChange={(e) => setFnoStrike(parseInt(e.target.value) || 0)}
                  className="w-full sm:w-44 px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs font-mono focus:outline-none focus:border-purple-500"
                />

                <div className="flex items-center bg-gray-950 p-1 rounded-xl border border-gray-700">
                  <button
                    type="button"
                    onClick={() => setFnoOptionType('CE')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      fnoOptionType === 'CE'
                        ? 'bg-emerald-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    CALL (CE)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFnoOptionType('PE')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                      fnoOptionType === 'PE'
                        ? 'bg-rose-600 text-white'
                        : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    PUT (PE)
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleLookupOption(fnoUnderlying, fnoStrike, fnoOptionType)}
                  disabled={isLookingUpOption || !fnoStrike}
                  className="w-full sm:w-auto px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isLookingUpOption ? 'Scanning Strike...' : 'Get AI Option Signal'}</span>
                </button>
              </div>
            </div>
          )}
          {/* Filter Pills */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/60 p-2 rounded-xl border border-gray-800">
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setFilterAction('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterAction === 'ALL'
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:text-gray-200'
                }`}
              >
                All Signals ({signals.length})
              </button>
              <button
                onClick={() => setFilterAction('HIGH_CONFIDENCE')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterAction === 'HIGH_CONFIDENCE'
                    ? 'bg-purple-600 text-white'
                    : 'text-gray-400 hover:text-purple-300'
                }`}
              >
                High Confidence &ge; 80%
              </button>
              <button
                onClick={() => setFilterAction('BUY')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterAction === 'BUY'
                    ? 'bg-emerald-600 text-white'
                    : 'text-gray-400 hover:text-emerald-300'
                }`}
              >
                BUY ({buyCount})
              </button>
              <button
                onClick={() => setFilterAction('SELL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterAction === 'SELL'
                    ? 'bg-rose-600 text-white'
                    : 'text-gray-400 hover:text-rose-300'
                }`}
              >
                SELL ({sellCount})
              </button>
            </div>

            {lastScanTime && (
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                Scanned: {new Date(lastScanTime).toLocaleTimeString('en-IN')}
              </span>
            )}
          </div>

          {/* Error Banner */}
          {scanError && (
            <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-500/40 text-rose-300 text-sm flex items-center justify-between">
              <span>{scanError}</span>
              <button
                onClick={() => loadSignals(true)}
                className="underline text-xs font-semibold"
              >
                Retry
              </button>
            </div>
          )}

          {/* Empty State */}
          {filteredSignals.length === 0 && !isScanning && (
            <div className="text-center py-12 bg-gray-900/40 rounded-2xl border border-gray-800">
              <Bot className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-300">No signals match current filter</h3>
              <p className="text-sm text-gray-500 mt-1">Try switching to 'All Signals' or run a fresh market scan.</p>
            </div>
          )}

          {/* Signals Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredSignals.map((sig) => {
              const isBuy = sig.action === 'BUY';
              const isSell = sig.action === 'SELL';

              return (
                <div
                  key={sig.id}
                  className={`relative rounded-2xl p-5 border transition-all duration-300 backdrop-blur-md shadow-lg ${
                    isBuy
                      ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-emerald-950/20 border-emerald-500/30 hover:border-emerald-500/60'
                      : isSell
                      ? 'bg-gradient-to-br from-gray-900 via-gray-900 to-rose-950/20 border-rose-500/30 hover:border-rose-500/60'
                      : 'bg-gray-900/80 border-gray-800 hover:border-gray-700'
                  }`}
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-lg text-white tracking-wide">
                          {sig.symbol}
                        </span>
                        {sig.contractType && sig.contractType !== 'EQ' ? (
                          <span
                            className={`text-xs px-2.5 py-0.5 rounded-md font-extrabold uppercase ${
                              sig.contractType === 'PE'
                                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                            }`}
                          >
                            {sig.strike ? `${sig.strike} ${sig.contractType}` : sig.contractType}
                          </span>
                        ) : null}
                        <span className="text-xs px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 font-mono">
                          {sig.exchange} • {sig.token}
                        </span>
                        {sig.status === 'EXECUTED' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium border border-blue-400/30">
                            EXECUTED
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-400">
                        {sig.lotSize && (
                          <span className="text-purple-300 font-medium">
                            Lot: <strong>{sig.lotSize}</strong> ({formatINR(sig.currentPrice * sig.lotSize)}/lot)
                          </span>
                        )}
                        {sig.oiBuildup && (
                          <span className="px-2 py-0.5 rounded bg-indigo-950/80 border border-indigo-500/30 text-indigo-300 font-medium text-[11px]">
                            {sig.oiBuildup.replace('_', ' ')}
                          </span>
                        )}
                        <span>{sig.timeframe}</span>
                        <span>•</span>
                        <span>R:R {sig.riskReward}</span>
                      </div>
                    </div>

                    {/* Action & Confidence Pill */}
                    <div className="flex flex-col items-end gap-1">
                      <span
                        className={`flex items-center space-x-1 px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider shadow-sm ${
                          isBuy
                            ? 'bg-emerald-500 text-gray-950 shadow-emerald-500/20'
                            : isSell
                            ? 'bg-rose-500 text-white shadow-rose-500/20'
                            : 'bg-amber-500 text-gray-950 shadow-amber-500/20'
                        }`}
                      >
                        {isBuy ? (
                          <ArrowUpRight className="w-3.5 h-3.5 stroke-[3]" />
                        ) : isSell ? (
                          <ArrowDownRight className="w-3.5 h-3.5 stroke-[3]" />
                        ) : (
                          <Radio className="w-3.5 h-3.5" />
                        )}
                        <span>{sig.action}</span>
                      </span>

                      {/* Confidence Meter */}
                      <div className="flex items-center space-x-1.5 text-xs text-gray-400">
                        <span>Confidence:</span>
                        <span className="font-bold text-white">{sig.confidence}%</span>
                      </div>
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div className="w-full bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        sig.confidence >= 80
                          ? 'bg-gradient-to-r from-purple-500 to-emerald-400'
                          : sig.confidence >= 65
                          ? 'bg-emerald-500'
                          : 'bg-amber-500'
                      }`}
                      style={{ width: `${sig.confidence}%` }}
                    />
                  </div>

                  {/* Price & Levels Grid */}
                  {(() => {
                    const flash =
                      priceFlashes[sig.token] ||
                      priceFlashes[sig.symbol] ||
                      priceFlashes[sig.symbol.replace(/-EQ$/, '')];
                    return (
                      <div className="grid grid-cols-4 gap-2 mt-4 p-3 rounded-xl bg-gray-950/70 border border-gray-800/80 text-center">
                        <div
                          className={`rounded-lg p-1 transition-all duration-300 ${
                            flash === 'up'
                              ? 'bg-emerald-500/25 ring-1 ring-emerald-500 scale-105'
                              : flash === 'down'
                              ? 'bg-rose-500/25 ring-1 ring-rose-500 scale-105'
                              : ''
                          }`}
                        >
                          <div className="text-[11px] text-gray-400 flex items-center justify-center gap-1">
                            <span>LTP</span>
                            <span
                              className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"
                              title="Live WebSocket Price"
                            />
                          </div>
                          <div
                            className={`text-sm font-bold mt-0.5 transition-colors font-mono ${
                              flash === 'up'
                                ? 'text-emerald-300'
                                : flash === 'down'
                                ? 'text-rose-300'
                                : 'text-white'
                            }`}
                          >
                            {formatINR(sig.currentPrice)}
                            {flash === 'up' && (
                              <span className="text-[10px] ml-1 text-emerald-400">▲</span>
                            )}
                            {flash === 'down' && (
                              <span className="text-[10px] ml-1 text-rose-400">▼</span>
                            )}
                          </div>
                          <div
                            className={`text-[10px] font-medium ${
                              sig.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {sig.netChange >= 0 ? '+' : ''}
                            {sig.percentChange}%
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-gray-400">Target 1</div>
                          <div className="text-sm font-semibold text-emerald-400 mt-0.5">
                            {formatINR(sig.target1)}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {formatINR(Math.abs(sig.target1 - sig.currentPrice))} gain
                          </div>
                        </div>

                        <div>
                          <div className="text-[11px] text-gray-400">Target 2</div>
                          <div className="text-sm font-semibold text-emerald-300 mt-0.5">
                            {formatINR(sig.target2)}
                          </div>
                          <div className="text-[10px] text-gray-500">Extended</div>
                        </div>

                        <div>
                          <div className="text-[11px] text-gray-400">Stop Loss</div>
                          <div className="text-sm font-semibold text-rose-400 mt-0.5">
                            {formatINR(sig.stopLoss)}
                          </div>
                          <div className="text-[10px] text-gray-500">
                            {formatINR(Math.abs(sig.currentPrice - sig.stopLoss))} risk
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* For F&O Option Contracts: Display Live Price of THAT SHARE (Underlying Asset) */}
                  {(() => {
                    if (sig.segment !== 'FNO' && !sig.underlying) return null;
                    const underName =
                      sig.underlying ||
                      (sig.symbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');
                    const underToken =
                      underName === 'BANKNIFTY'
                        ? '99926009'
                        : underName === 'NIFTY'
                        ? '99926000'
                        : undefined;
                    const underQuote =
                      (underToken ? getLiveQuote(underToken) : undefined) ||
                      getLiveQuote(underName);
                    if (!underQuote || typeof underQuote.ltp !== 'number')
                      return null;

                    return (
                      <div className="mt-2.5 p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs">
                        <span className="text-blue-300 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                          Underlying {underName} Live Price:
                        </span>
                        <span className="font-bold text-white font-mono">
                          {formatINR(underQuote.ltp)}
                          {typeof underQuote.percentChange === 'number' && (
                            <span
                              className={`ml-1.5 text-[11px] font-semibold ${
                                underQuote.percentChange >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              ({underQuote.percentChange >= 0 ? '+' : ''}
                              {underQuote.percentChange}%)
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Technical Indicators Pill Tags */}
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-800/90 text-gray-300 border border-gray-700">
                      RSI: <strong>{sig.indicators.rsi}</strong> ({sig.indicators.rsiSignal})
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-800/90 text-gray-300 border border-gray-700">
                      EMA: <strong>{sig.indicators.emaTrend}</strong>
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-800/90 text-gray-300 border border-gray-700">
                      MACD: <strong>{sig.indicators.macd.histogram}</strong> ({sig.indicators.macd.trend})
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-md bg-gray-800/90 text-gray-300 border border-gray-700">
                      Depth: <strong>{sig.indicators.orderBookImbalance}% Buyers</strong>
                    </span>
                  </div>

                  {/* AI Thesis Summary & Bullets */}
                  <div className="mt-3.5 p-3 rounded-xl bg-blue-950/20 border border-blue-500/20 text-xs space-y-1.5">
                    <p className="text-gray-200 font-medium leading-relaxed">
                      {sig.aiThesis.summary}
                    </p>
                    {sig.aiThesis.rationale && sig.aiThesis.rationale.length > 0 && (
                      <ul className="space-y-1 text-gray-400 pl-4 list-disc text-[11px]">
                        {sig.aiThesis.rationale.slice(0, 2).map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* 1-Click Execution Button */}
                  <div className="mt-4 flex items-center justify-between pt-2 border-t border-gray-800/80">
                    <span className="text-xs text-gray-400">
                      Mode:{' '}
                      <strong className={autoPilot.mode === 'LIVE' ? 'text-emerald-400' : 'text-amber-400'}>
                        {autoPilot.mode === 'LIVE' ? 'Angel One Broker' : 'Paper Trade'}
                      </strong>
                    </span>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedChartSymbol(sig.symbol);
                          setActiveTab('chart');
                        }}
                        className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all border border-gray-700"
                        title="View TradingView Chart"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                        <span>Chart</span>
                      </button>

                      <button
                        onClick={() => handleOpenExecuteModal(sig)}
                        className={`flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                          isBuy
                            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                            : isSell
                            ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                            : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                        }`}
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        <span>Execute {sig.action}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB: AI BUDGET TRADE ADVISOR & CAPITAL ALLOCATOR */}
      {/* ========================================================================= */}
      {activeTab === 'budget' && (
        <div className="space-y-6">
          {/* Interactive Budget Configuration Panel */}
          <div className="p-6 rounded-2xl bg-gray-900/90 border border-gray-800 backdrop-blur-xl shadow-xl space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start space-x-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0">
                  <Wallet className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <span>AI Capital Allocator & Trade Advisor</span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/40">
                      Live Position Sizing
                    </span>
                  </h2>
                  <p className="text-xs text-gray-400 mt-1 max-w-2xl leading-relaxed">
                    Write your trading capital or pull your live broker funds. The AI scans active market setups across Equities and F&O, calculates exact share and lot quantities, and constructs a risk-disciplined portfolio tailored to your budget.
                  </p>
                </div>
              </div>

              {/* Angel One Broker Live Cash Auto-Sync */}
              <div className="flex items-center space-x-2 bg-gray-950 p-2.5 rounded-xl border border-gray-800 text-xs shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase tracking-wider">Angel One Margin:</span>
                  <span className="font-bold text-emerald-400">
                    {brokerFunds ? `₹${brokerFunds.available.toLocaleString('en-IN')}` : 'Connecting...'}
                  </span>
                </div>
                {brokerFunds && brokerFunds.available > 0 && (
                  <button
                    onClick={() => {
                      setBudgetInput(String(brokerFunds.available));
                      handleRunBudgetAnalysis(brokerFunds.available);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/40 font-semibold transition-all text-[11px]"
                  >
                    Use Funds
                  </button>
                )}
                <button
                  onClick={loadBrokerFunds}
                  disabled={isLoadingFunds}
                  className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-all"
                  title="Refresh Broker Funds"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFunds ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Budget Input & Preset Chips */}
            <div className="space-y-3 pt-2 border-t border-gray-800">
              <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-emerald-400" />
                <span>Trading Capital / Budget (₹ INR)</span>
              </label>

              <div className="flex flex-col sm:flex-row items-stretch gap-3">
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">
                    ₹
                  </span>
                  <input
                    type="number"
                    min="500"
                    step="500"
                    value={budgetInput}
                    onChange={(e) => setBudgetInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRunBudgetAnalysis();
                    }}
                    placeholder="e.g. 10000"
                    className="w-full pl-9 pr-4 py-3 rounded-xl bg-gray-950 border border-gray-700 text-white font-bold text-lg focus:border-emerald-500 focus:outline-none transition-all"
                  />
                </div>

                <button
                  onClick={() => handleRunBudgetAnalysis()}
                  disabled={isAnalyzingBudget}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                >
                  {isAnalyzingBudget ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Analyzing Market...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Allocate Capital</span>
                    </>
                  )}
                </button>
              </div>

              {/* Quick Preset Budget Chips */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="text-[11px] text-gray-400 font-medium">Quick Presets:</span>
                {[
                  { label: '₹2,000 (Micro)', val: 2000 },
                  { label: '₹5,000', val: 5000 },
                  { label: '₹10,000 (Popular)', val: 10000 },
                  { label: '₹25,000', val: 25000 },
                  { label: '₹50,000', val: 50000 },
                  { label: '₹1,00,000 (Scale)', val: 100000 },
                  { label: '₹2,50,000', val: 250000 },
                ].map((preset) => (
                  <button
                    key={preset.val}
                    type="button"
                    onClick={() => {
                      setBudgetInput(String(preset.val));
                      handleRunBudgetAnalysis(preset.val);
                    }}
                    className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border ${
                      budgetInput === String(preset.val)
                        ? 'bg-emerald-600/30 text-emerald-300 border-emerald-500/50 shadow-sm'
                        : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Risk Profile & Target Segment Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              {/* Risk Profile Selection Cards */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                  <span>Risk Profile Strategy</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    {
                      id: 'CONSERVATIVE' as const,
                      title: 'Conservative',
                      badge: '🛡️ Low Risk',
                      desc: 'Max 2% risk/trade, 40% cap, 1-2 setups',
                    },
                    {
                      id: 'MODERATE' as const,
                      title: 'Moderate',
                      badge: '⚖️ Balanced',
                      desc: 'Max 3.5% risk/trade, 55% cap, 2-3 setups',
                    },
                    {
                      id: 'AGGRESSIVE' as const,
                      title: 'Aggressive',
                      badge: '🚀 High Alpha',
                      desc: 'Max 6% risk/trade, 75% cap, 3-4 setups',
                    },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setBudgetRiskProfile(p.id);
                        if (budgetAnalysis) {
                          setTimeout(() => handleRunBudgetAnalysis(), 50);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                        budgetRiskProfile === p.id
                          ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-500/10'
                          : 'bg-gray-950/60 border-gray-800 hover:border-gray-700 text-gray-400'
                      }`}
                    >
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-400">
                          {p.badge}
                        </span>
                        <div className="font-bold text-white text-xs mt-0.5">{p.title}</div>
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1 leading-tight">{p.desc}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Asset Segment & Max Trades */}
              <div className="space-y-3">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-purple-400" />
                    <span>Target Market Universe</span>
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { id: 'ALL' as const, label: 'All Markets', desc: 'Equity + F&O', icon: '🌐' },
                      { id: 'EQUITY' as const, label: 'Equities Only', desc: 'Cash stocks', icon: '📈' },
                      { id: 'FNO' as const, label: 'F&O Standard', desc: 'Options & Futures', icon: '⚡' },
                      { id: 'VOLATILE_CALLS' as const, label: 'Volatile Calls', desc: 'Top CE Movers', icon: '🚀' },
                      { id: 'VOLATILE_PUTS' as const, label: 'Volatile Puts', desc: 'Top PE Movers', icon: '💥' },
                      { id: 'VOLATILE_OPTIONS' as const, label: 'All Volatile F&O', desc: 'High Alpha CE & PE', icon: '🔥' },
                    ].map((seg) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => {
                          setBudgetSegment(seg.id);
                          if (budgetAnalysis) {
                            setTimeout(() => handleRunBudgetAnalysis(undefined, seg.id), 50);
                          }
                        }}
                        className={`p-2.5 rounded-xl border text-center transition-all ${
                          budgetSegment === seg.id
                            ? 'bg-blue-600 text-white border-blue-400 shadow-sm'
                            : 'bg-gray-950/60 border-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        <div className="text-xs font-bold flex items-center justify-center gap-1">
                          <span>{seg.icon}</span>
                          <span>{seg.label}</span>
                        </div>
                        <div className="text-[10px] opacity-80">{seg.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Max Concurrent Trades */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-gray-400 font-medium">Max Concurrent Trades:</span>
                  <div className="flex items-center space-x-1.5">
                    {[1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => {
                          setBudgetMaxTrades(n);
                          if (budgetAnalysis) {
                            setTimeout(() => handleRunBudgetAnalysis(), 50);
                          }
                        }}
                        className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                          budgetMaxTrades === n
                            ? 'bg-emerald-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:text-white'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Live Most Volatile Options Radar (Calls & Puts) */}
            {(() => {
              const liveCalls = budgetAnalysis?.volatileCalls || (fnoMoversQuery.data?.calls as any[]) || [];
              const livePuts = budgetAnalysis?.volatilePuts || (fnoMoversQuery.data?.puts as any[]) || [];
              const activeList = volatileRadarTab === 'calls' ? liveCalls : livePuts;

              return (
                <div className="pt-4 border-t border-gray-800 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center space-x-2">
                        <Flame className="w-4 h-4 text-amber-400 animate-pulse" />
                        <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                          <span>Most Volatile Call & Put Options</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 normal-case font-semibold">
                            Live SmartAPI Stream
                          </span>
                        </h4>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">
                        Highest swing derivatives with explosive delta momentum. Tap <strong>Allocate</strong> to size lots for your capital.
                      </p>
                    </div>

                    {/* CE / PE Tabs Switcher */}
                    <div className="flex items-center space-x-1.5 bg-gray-950 p-1 rounded-xl border border-gray-800 text-xs shrink-0">
                      <button
                        type="button"
                        onClick={() => setVolatileRadarTab('calls')}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                          volatileRadarTab === 'calls'
                            ? 'bg-emerald-600 text-white shadow-md shadow-emerald-500/20'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <ArrowUpRight className="w-3.5 h-3.5 text-emerald-300" />
                        <span>Volatile Calls (CE)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                          {liveCalls.length}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setVolatileRadarTab('puts')}
                        className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                          volatileRadarTab === 'puts'
                            ? 'bg-rose-600 text-white shadow-md shadow-rose-500/20'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <ArrowDownRight className="w-3.5 h-3.5 text-rose-300" />
                        <span>Volatile Puts (PE)</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/40 font-mono">
                          {livePuts.length}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Options Cards Grid */}
                  {activeList.length === 0 ? (
                    <div className="p-4 rounded-xl bg-gray-950/50 border border-gray-800/80 text-center text-xs text-gray-400">
                      Loading volatile {volatileRadarTab === 'calls' ? 'Call (CE)' : 'Put (PE)'} contracts from live market...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {activeList.slice(0, 4).map((item) => {
                        const isCall = item.instrumentType === 'CE';
                        const lotSize = item.tradingSymbol.startsWith('BANKNIFTY') ? 30 : 65;
                        const lotCost = Math.round(item.ltp * lotSize);
                        const isUp = item.percentChange >= 0;

                        return (
                          <div
                            key={item.symbolToken || item.tradingSymbol}
                            className={`p-3.5 rounded-xl bg-gray-950/90 border transition-all flex flex-col justify-between hover:shadow-lg ${
                              isCall
                                ? 'border-emerald-500/25 hover:border-emerald-500/60'
                                : 'border-rose-500/25 hover:border-rose-500/60'
                            }`}
                          >
                            <div className="space-y-1.5">
                              <div className="flex items-start justify-between gap-1">
                                <span className="font-bold text-white text-xs truncate font-mono" title={item.tradingSymbol}>
                                  {item.tradingSymbol}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                                    isCall
                                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                                      : 'bg-rose-950 text-rose-300 border border-rose-500/40'
                                  }`}
                                >
                                  {item.instrumentType}
                                </span>
                              </div>
                              <div className="text-[10px] text-gray-400">
                                Strike: <strong>₹{item.strike?.toLocaleString('en-IN') || '-'}</strong> • Exp: {item.expiry}
                              </div>
                            </div>

                            <div className="mt-3 pt-2 border-t border-gray-800/80 flex items-end justify-between">
                              <div>
                                <div className="text-[10px] text-gray-400">Live LTP</div>
                                <div className="text-sm font-bold text-white font-mono flex items-center gap-1.5">
                                  {formatINR(item.ltp)}
                                  <span
                                    className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                                      isUp
                                        ? 'bg-emerald-500/20 text-emerald-400'
                                        : 'bg-rose-500/20 text-rose-400'
                                    }`}
                                  >
                                    {isUp ? '+' : ''}{item.percentChange.toFixed(1)}%
                                  </span>
                                </div>
                                <div className="text-[9px] text-gray-400 font-mono mt-0.5">
                                  1 Lot ({lotSize}u) = ₹{lotCost.toLocaleString('en-IN')}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleAllocateVolatileOption(item)}
                                className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-sm shrink-0 ${
                                  isCall
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                                    : 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20'
                                }`}
                                title="Size lots and allocate capital to this option"
                              >
                                <Zap className="w-3 h-3 fill-current" />
                                <span>Allocate</span>
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Error Message */}
            {budgetError && (
              <div className="p-3.5 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{budgetError}</span>
                </div>
                <button
                  onClick={() => handleRunBudgetAnalysis()}
                  className="px-3 py-1 rounded-lg bg-rose-600/30 hover:bg-rose-600 text-white font-semibold text-xs"
                >
                  Retry
                </button>
              </div>
            )}
          </div>

          {/* Loading State Animation */}
          {isAnalyzingBudget && (
            <div className="p-12 rounded-2xl bg-gray-900/60 border border-gray-800 flex flex-col items-center justify-center space-y-3">
              <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin"></div>
                <Bot className="w-6 h-6 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="text-white font-semibold text-sm">
                AI scanning market opportunities for ₹{parseFloat(budgetInput).toLocaleString('en-IN')}...
              </p>
              <p className="text-xs text-gray-400">
                Evaluating {budgetRiskProfile} risk parameters, computing affordable share quantities & option lots.
              </p>
            </div>
          )}

          {/* Analysis Results View */}
          {!isAnalyzingBudget && budgetAnalysis && (
            <div className="space-y-6">
              {/* Capital Allocation & Health Overview Card */}
              <div className="p-6 rounded-2xl bg-gray-900/90 border border-gray-800 backdrop-blur-xl shadow-xl space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                      Portfolio Construction Complete
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">
                      Capital Deployment for ₹{budgetAnalysis.budget.toLocaleString('en-IN')} ({budgetAnalysis.riskProfile} Profile)
                    </h3>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="text-xs text-gray-400">Health Score:</span>
                    <span className="px-3 py-1 rounded-xl bg-emerald-950/60 text-emerald-300 font-bold border border-emerald-500/40 text-xs flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                      {budgetAnalysis.portfolioHealthScore}/100
                    </span>
                  </div>
                </div>

                {/* Capital Allocation Progress Bar */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                      Deployed: <strong>₹{budgetAnalysis.totalCapitalAllocated.toLocaleString('en-IN')}</strong> (
                      {(100 - budgetAnalysis.bufferPercentage).toFixed(1)}%)
                    </span>
                    <span className="text-gray-300 font-semibold flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                      Liquid Cash Buffer: <strong>₹{budgetAnalysis.remainingCashBuffer.toLocaleString('en-IN')}</strong> (
                      {budgetAnalysis.bufferPercentage}%)
                    </span>
                  </div>
                  <div className="w-full h-3 bg-gray-950 rounded-full overflow-hidden flex border border-gray-800 p-0.5">
                    <div
                      className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(5, 100 - budgetAnalysis.bufferPercentage))}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-500 ml-0.5"
                      style={{ width: `${Math.min(100, Math.max(5, budgetAnalysis.bufferPercentage))}%` }}
                    />
                  </div>
                </div>

                {/* Key Portfolio Metric Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Total Capital</div>
                    <div className="text-base font-bold text-white mt-1">
                      ₹{budgetAnalysis.budget.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-gray-400 mt-0.5">100% Base Budget</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Deployed</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      ₹{budgetAnalysis.totalCapitalAllocated.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-emerald-400/80 mt-0.5">
                      {budgetAnalysis.suggestions.length} Positions Sized
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-gray-800">
                    <div className="text-[10px] text-gray-400 uppercase font-semibold">Cash Buffer</div>
                    <div className="text-base font-bold text-blue-400 mt-1">
                      ₹{budgetAnalysis.remainingCashBuffer.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-blue-400/80 mt-0.5">{budgetAnalysis.bufferPercentage}% Liquid Cushion</div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-rose-500/20 bg-rose-950/10">
                    <div className="text-[10px] text-rose-300 uppercase font-semibold">Max Combined Risk</div>
                    <div className="text-base font-bold text-rose-400 mt-1">
                      ₹{budgetAnalysis.totalMaxRisk.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-rose-400/80 mt-0.5">
                      {budgetAnalysis.totalMaxRiskPercentage}% Total Drawdown
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-emerald-500/20 bg-emerald-950/10">
                    <div className="text-[10px] text-emerald-300 uppercase font-semibold">Target 1 Upside</div>
                    <div className="text-base font-bold text-emerald-400 mt-1">
                      +₹{budgetAnalysis.totalExpectedProfitT1.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-emerald-400/80 mt-0.5">
                      +{((budgetAnalysis.totalExpectedProfitT1 / budgetAnalysis.budget) * 100).toFixed(1)}% Return
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-gray-950/80 border border-purple-500/20 bg-purple-950/10">
                    <div className="text-[10px] text-purple-300 uppercase font-semibold">Target 2 Upside</div>
                    <div className="text-base font-bold text-purple-400 mt-1">
                      +₹{budgetAnalysis.totalExpectedProfitT2.toLocaleString('en-IN')}
                    </div>
                    <div className="text-[10px] text-purple-400/80 mt-0.5">R:R {budgetAnalysis.overallRiskReward}</div>
                  </div>
                </div>

                {/* AI Executive Strategy & Risk Thesis */}
                <div className="p-4 rounded-xl bg-gradient-to-r from-blue-950/30 to-purple-950/20 border border-blue-500/20 text-xs space-y-2">
                  <div className="flex items-center space-x-2 text-blue-400 font-bold">
                    <Sparkles className="w-4 h-4" />
                    <span>AI Strategic Portfolio Thesis</span>
                  </div>
                  <p className="text-gray-200 leading-relaxed font-medium">
                    {budgetAnalysis.aiSummary}
                  </p>
                  <ul className="space-y-1.5 pt-1 text-gray-300">
                    {budgetAnalysis.strategicAdvice.map((rule, idx) => (
                      <li key={idx} className="flex items-start space-x-2 text-[11px]">
                        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                        <span>{rule}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Unaffordable Highlights Warning (If any) */}
                {budgetAnalysis.unaffordableHighlights && budgetAnalysis.unaffordableHighlights.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/30 text-xs space-y-1">
                    <div className="flex items-center space-x-2 text-amber-400 font-bold">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>Capital Filter Notice (Intelligent Risk Filtering):</span>
                    </div>
                    <p className="text-gray-300 text-[11px]">
                      The AI automatically filtered out the following setups because minimum lot costs exceeded your budget:
                    </p>
                    <ul className="pl-4 list-disc space-y-0.5 text-amber-200/80 text-[11px]">
                      {budgetAnalysis.unaffordableHighlights.map((u, i) => (
                        <li key={i}>
                          <strong>{u.symbol}</strong> ({u.action}): {u.reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Recommended Trade Allocation Cards Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <Target className="w-4 h-4 text-emerald-400" />
                    <span>Suggested Position Allocations ({budgetAnalysis.suggestions.length})</span>
                  </h3>
                  <span className="text-xs text-gray-400">
                    1-Click Execute with Pre-Calculated Quantities
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {budgetAnalysis.suggestions.map((item, idx) => {
                    const sig = item.signal;
                    const isBuy = sig.action === 'BUY';
                    const isSell = sig.action === 'SELL';
                    const isFno = item.recommendedLots > 0 || sig.segment === 'FNO' || sig.symbol.endsWith('CE') || sig.symbol.endsWith('PE');

                    return (
                      <div
                        key={idx}
                        className={`p-5 rounded-2xl bg-gray-900/80 border transition-all flex flex-col justify-between hover:shadow-xl ${
                          isBuy
                            ? 'border-emerald-500/30 hover:border-emerald-500/60'
                            : isSell
                            ? 'border-rose-500/30 hover:border-rose-500/60'
                            : 'border-gray-800'
                        }`}
                      >
                        <div className="space-y-3.5">
                          {/* Card Header: Symbol & Action */}
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="font-bold text-white text-base">{sig.symbol}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                                  isFno 
                                    ? 'bg-purple-950/60 text-purple-300 border-purple-500/40' 
                                    : 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                                }`}>
                                  {isFno ? 'F&O OPTION' : 'EQUITY'}
                                </span>
                              </div>
                              <div className="text-xs text-gray-400 mt-0.5">
                                Underlying: <strong>{sig.underlying || sig.symbol}</strong>
                              </div>
                            </div>

                            <div className="flex flex-col items-end">
                              <span
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold shadow-sm ${
                                  isBuy
                                    ? 'bg-emerald-600 text-white'
                                    : isSell
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-blue-600 text-white'
                                }`}
                              >
                                {sig.action}
                              </span>
                              <span className="text-[10px] text-gray-400 mt-1 font-semibold">
                                {sig.confidence}% Confidence
                              </span>
                            </div>
                          </div>

                          {/* Position Sizing Box */}
                          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-medium">Recommended Size:</span>
                              <span className="font-bold text-emerald-400 text-sm">
                                {isFno
                                  ? `${item.recommendedLots} Lot${item.recommendedLots > 1 ? 's' : ''} (${item.recommendedQuantity} units)`
                                  : `${item.recommendedQuantity} Shares`}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-400 font-medium">Capital Required:</span>
                              <span className="font-bold text-white">
                                ₹{item.capitalRequired.toLocaleString('en-IN')}{' '}
                                <span className="text-xs text-emerald-400 font-normal">
                                  ({item.allocationPercentage}% of budget)
                                </span>
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-xs pt-1 border-t border-gray-800/60">
                              <span className="text-gray-400 font-medium flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                Live Price (LTP):
                              </span>
                              <span className="font-bold text-white font-mono">
                                {formatINR(sig.currentPrice)}
                                <span
                                  className={`text-[10px] ml-1.5 font-medium ${
                                    sig.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                                  }`}
                                >
                                  {sig.netChange >= 0 ? '+' : ''}
                                  {sig.percentChange}%
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Price Levels Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-gray-950/60 border border-gray-800">
                              <span className="text-[10px] text-gray-400 block">Entry Price</span>
                              <span className="font-bold text-white">₹{sig.entryPrice}</span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-950/60 border border-rose-500/20 bg-rose-950/10">
                              <span className="text-[10px] text-rose-300 block">Stop Loss (Max Risk)</span>
                              <span className="font-bold text-rose-400">
                                ₹{sig.stopLoss}{' '}
                                <span className="text-[10px] font-normal">(-₹{item.maxLoss})</span>
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-950/60 border border-emerald-500/20 bg-emerald-950/10">
                              <span className="text-[10px] text-emerald-300 block">Target 1</span>
                              <span className="font-bold text-emerald-400">
                                ₹{sig.target1}{' '}
                                <span className="text-[10px] font-normal">(+₹{item.target1Profit})</span>
                              </span>
                            </div>
                            <div className="p-2 rounded-lg bg-gray-950/60 border border-purple-500/20 bg-purple-950/10">
                              <span className="text-[10px] text-purple-300 block">Target 2 (Runner)</span>
                              <span className="font-bold text-purple-400">
                                ₹{sig.target2}{' '}
                                <span className="text-[10px] font-normal">(+₹{item.target2Profit})</span>
                              </span>
                            </div>
                          </div>

                          {/* Allocation Rationale */}
                          <div className="p-2.5 rounded-xl bg-blue-950/20 border border-blue-500/20 text-[11px] text-gray-300 leading-relaxed">
                            {item.allocationReason}
                          </div>
                        </div>

                        {/* Card Actions: 1-Click Execute & Chart */}
                        <div className="mt-4 pt-3 border-t border-gray-800/80 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedChartSymbol(sig.symbol);
                              setActiveTab('chart');
                            }}
                            className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-all border border-gray-700"
                            title="Inspect on TradingView"
                          >
                            <BarChart2 className="w-3.5 h-3.5 text-blue-400" />
                            <span>Chart</span>
                          </button>

                          <button
                            onClick={() =>
                              handleOpenExecuteModal(
                                sig,
                                item.recommendedLots > 0 ? item.recommendedLots : undefined,
                                item.recommendedQuantity
                              )
                            }
                            className={`flex-1 flex items-center justify-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md ${
                              isBuy
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                                : isSell
                                ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                                : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                            }`}
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>
                              Execute {sig.action} (
                              {isFno
                                ? `${item.recommendedLots} Lot${item.recommendedLots > 1 ? 's' : ''}`
                                : `${item.recommendedQuantity} Qty`}
                              )
                            </span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {activeTab === 'chart' && (
        <div className="space-y-4">
          {/* Quick Stock Switcher & Timeframe Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gray-900/80 p-3 rounded-2xl border border-gray-800">
            {/* Quick Watchlist Chips with Real-Time Live Share Prices */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-semibold text-gray-400 uppercase mr-1">
                Indices & Equities:
              </span>
              {[
                { label: 'Nifty 50', sym: 'NSE:NIFTYBEES', lookup: '99926000' },
                { label: 'Bank Nifty', sym: 'NSE:BANKBEES', lookup: '99926009' },
                { label: 'Reliance', sym: 'NSE:RELIANCE', lookup: '2885' },
                { label: 'Tata Steel', sym: 'NSE:TATASTEEL', lookup: '3499' },
                { label: 'SBI', sym: 'NSE:SBIN', lookup: '3045' },
                { label: 'HDFC Bank', sym: 'NSE:HDFCBANK', lookup: '1333' },
                { label: 'Infosys', sym: 'NSE:INFY', lookup: '1594' },
                { label: 'ICICI Bank', sym: 'NSE:ICICIBANK', lookup: '4963' },
                { label: 'TCS', sym: 'NSE:TCS', lookup: '11536' },
                { label: 'ITC', sym: 'NSE:ITC', lookup: '1660' },
              ].map((item) => {
                const quote =
                  getLiveQuote(item.lookup) ||
                  getLiveQuote(item.sym) ||
                  getLiveQuote(item.label);
                const flash =
                  priceFlashes[item.lookup] || priceFlashes[item.sym];
                const isSelected =
                  selectedChartSymbol.toUpperCase() === item.sym.toUpperCase();
                return (
                  <button
                    key={item.sym}
                    onClick={() => setSelectedChartSymbol(item.sym)}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                        : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                    } ${
                      flash === 'up'
                        ? 'ring-1 ring-emerald-400 bg-emerald-950/40 text-emerald-200'
                        : flash === 'down'
                        ? 'ring-1 ring-rose-400 bg-rose-950/40 text-rose-200'
                        : ''
                    }`}
                  >
                    <span>{item.label}</span>
                    {quote && typeof quote.ltp === 'number' && quote.ltp > 0 && (
                      <span className="font-mono text-[11px] font-bold text-white bg-black/40 px-1.5 py-0.5 rounded">
                        {formatINR(quote.ltp)}
                        {typeof quote.percentChange === 'number' && (
                          <span
                            className={`ml-1 text-[10px] ${
                              quote.percentChange >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {quote.percentChange >= 0 ? '+' : ''}
                            {quote.percentChange}%
                          </span>
                        )}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center space-x-1 bg-gray-950 p-1 rounded-xl border border-gray-800">
              {(['1', '5', '15', '60', 'D'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setChartInterval(tf)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    chartInterval === tf
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tf === 'D' ? '1D' : tf === '60' ? '1H' : `${tf}m`}
                </button>
              ))}
            </div>
          </div>

          {/* Real-Time Live Share Market Quote Strip */}
          {(() => {
            const chartClean = selectedChartSymbol
              .replace(/^NSE:/, '')
              .replace(/^BSE:/, '')
              .replace(/^NFO:/, '')
              .toUpperCase();
            const currentQuote =
              getLiveQuote(selectedChartSymbol) || getLiveQuote(chartClean);

            const matchingSignal = signals.find((s) => {
              const symClean = s.symbol.replace(/-EQ$/, '').toUpperCase();
              return (
                s.symbol.toUpperCase() === selectedChartSymbol.toUpperCase() ||
                symClean === chartClean ||
                (s.underlying &&
                  chartClean.startsWith(s.underlying.toUpperCase()))
              );
            });

            const isOption =
              matchingSignal?.segment === 'FNO' ||
              matchingSignal?.underlying ||
              selectedChartSymbol.endsWith('CE') ||
              selectedChartSymbol.endsWith('PE');
            const underlyingName =
              matchingSignal?.underlying ||
              (selectedChartSymbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');
            const underlyingToken =
              underlyingName === 'BANKNIFTY'
                ? '99926009'
                : underlyingName === 'NIFTY'
                ? '99926000'
                : undefined;
            const underlyingQuote =
              (underlyingToken ? getLiveQuote(underlyingToken) : undefined) ||
              getLiveQuote(underlyingName);

            const displayLtp = currentQuote?.ltp ?? matchingSignal?.currentPrice;
            const displayChange =
              currentQuote?.change ?? matchingSignal?.netChange;
            const displayPercent =
              currentQuote?.percentChange ?? matchingSignal?.percentChange;

            return (
              <div className="p-3.5 rounded-2xl bg-gradient-to-r from-gray-900 via-gray-900 to-blue-950/40 border border-gray-800 shadow-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                {/* Left: Main Chart Instrument Info */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-400/30">
                    <BarChart2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap">
                      <span className="font-bold text-white text-sm">
                        {selectedChartSymbol}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-gray-800 text-gray-400 text-[10px] font-mono">
                        {isOption ? 'DERIVATIVE CONTRACT' : 'CASH SHARE'}
                      </span>
                      <span className="flex items-center space-x-1 text-[11px] text-emerald-400 font-medium">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        <span>Live Feed</span>
                      </span>
                    </div>

                    <div className="flex items-center space-x-3 mt-1 text-gray-300">
                      {typeof displayLtp === 'number' && displayLtp > 0 && (
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-[11px] text-gray-400">
                            {isOption ? 'Option LTP:' : 'Live Share Price:'}
                          </span>
                          <span className="text-base font-extrabold text-white font-mono">
                            {formatINR(displayLtp)}
                          </span>
                          {typeof displayPercent === 'number' && (
                            <span
                              className={`font-semibold text-xs ${
                                displayPercent >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              ({displayPercent >= 0 ? '+' : ''}
                              {displayPercent}%{' '}
                              {displayChange !== undefined
                                ? `• ${
                                    displayChange >= 0 ? '+' : ''
                                  }${formatINR(displayChange)}`
                                : ''}
                              )
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: If Option, Show Underlying Share Live Price & OHLC */}
                <div className="flex items-center space-x-3 flex-wrap">
                  {isOption &&
                    underlyingQuote &&
                    typeof underlyingQuote.ltp === 'number' && (
                      <div className="px-3 py-1.5 rounded-xl bg-blue-950/60 border border-blue-500/40 text-xs">
                        <div className="text-[10px] text-blue-300 uppercase font-semibold flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                          Underlying {underlyingName} Share Price:
                        </div>
                        <div className="font-bold text-white font-mono text-sm mt-0.5">
                          {formatINR(underlyingQuote.ltp)}
                          {typeof underlyingQuote.percentChange === 'number' && (
                            <span
                              className={`text-xs ml-1.5 font-semibold ${
                                underlyingQuote.percentChange >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {underlyingQuote.percentChange >= 0 ? '+' : ''}
                              {underlyingQuote.percentChange}%
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                  {/* OHLC Badges if available */}
                  {currentQuote && (
                    <div className="hidden lg:flex items-center space-x-3 text-[11px] font-mono text-gray-400 bg-gray-950/80 px-3 py-1.5 rounded-xl border border-gray-800">
                      <div>
                        O:{' '}
                        <span className="text-white">
                          {currentQuote.open
                            ? formatINR(currentQuote.open)
                            : '--'}
                        </span>
                      </div>
                      <div>
                        H:{' '}
                        <span className="text-emerald-400">
                          {currentQuote.high
                            ? formatINR(currentQuote.high)
                            : '--'}
                        </span>
                      </div>
                      <div>
                        L:{' '}
                        <span className="text-rose-400">
                          {currentQuote.low
                            ? formatINR(currentQuote.low)
                            : '--'}
                        </span>
                      </div>
                      <div>
                        C:{' '}
                        <span className="text-gray-300">
                          {currentQuote.close
                            ? formatINR(currentQuote.close)
                            : '--'}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Interactive TradingView Chart Component */}
          {(() => {
            const chartClean = selectedChartSymbol
              .replace(/^NSE:/, '')
              .replace(/^BSE:/, '')
              .replace(/^NFO:/, '')
              .toUpperCase();
            const currentQuote =
              getLiveQuote(selectedChartSymbol) || getLiveQuote(chartClean);
            const matchingSignal = signals.find((s) => {
              const symClean = s.symbol.replace(/-EQ$/, '').toUpperCase();
              return (
                s.symbol.toUpperCase() === selectedChartSymbol.toUpperCase() ||
                symClean === chartClean ||
                (s.underlying &&
                  chartClean.startsWith(s.underlying.toUpperCase()))
              );
            });
            const underlyingName =
              matchingSignal?.underlying ||
              (selectedChartSymbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');
            const underlyingToken =
              underlyingName === 'BANKNIFTY'
                ? '99926009'
                : underlyingName === 'NIFTY'
                ? '99926000'
                : undefined;
            const underlyingQuote =
              (underlyingToken ? getLiveQuote(underlyingToken) : undefined) ||
              getLiveQuote(underlyingName);

            return (
              <TradingViewChart
                symbol={selectedChartSymbol}
                interval={chartInterval}
                height={620}
                theme="dark"
                enableStudies={true}
                allowSymbolChange={true}
                showToolbar={true}
                livePrice={currentQuote?.ltp ?? matchingSignal?.currentPrice}
                liveNetChange={currentQuote?.change ?? matchingSignal?.netChange}
                livePercentChange={
                  currentQuote?.percentChange ?? matchingSignal?.percentChange
                }
                underlyingPrice={underlyingQuote?.ltp}
                underlyingPercentChange={underlyingQuote?.percentChange}
                onSymbolChange={setSelectedChartSymbol}
                onIntervalChange={(tf) => setChartInterval(tf as any)}
              />
            );
          })()}

          {/* Connected AI Signal & Execution Overlay for this Symbol */}
          {(() => {
            const chartClean = selectedChartSymbol
              .replace(/^NSE:/, '')
              .replace(/^BSE:/, '')
              .replace(/^NFO:/, '')
              .toUpperCase();
            const matchingSignal = signals.find((s) => {
              const symClean = s.symbol.replace(/-EQ$/, '').toUpperCase();
              return (
                s.symbol.toUpperCase() === selectedChartSymbol.toUpperCase() ||
                symClean === chartClean ||
                (s.underlying &&
                  chartClean.startsWith(s.underlying.toUpperCase()))
              );
            });

            if (!matchingSignal) return null;

            const isBuy = matchingSignal.action === 'BUY';
            const isSell = matchingSignal.action === 'SELL';
            const isFno =
              matchingSignal.segment === 'FNO' || !!matchingSignal.underlying;
            const underlyingName =
              matchingSignal.underlying ||
              (selectedChartSymbol.includes('BANK') ? 'BANKNIFTY' : 'NIFTY');
            const underlyingToken =
              underlyingName === 'BANKNIFTY'
                ? '99926009'
                : underlyingName === 'NIFTY'
                ? '99926000'
                : undefined;
            const underlyingQuote =
              (underlyingToken ? getLiveQuote(underlyingToken) : undefined) ||
              getLiveQuote(underlyingName);

            return (
              <div className="p-4 rounded-2xl bg-gray-900/90 border border-gray-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3 flex-wrap gap-y-2">
                  <span
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase ${
                      isBuy
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : isSell
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                        : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    }`}
                  >
                    AI Signal: {matchingSignal.action} ({matchingSignal.confidence}%)
                  </span>

                  <div className="text-xs text-gray-300 flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      {isFno ? 'Option LTP:' : 'Live Share LTP:'}
                    </span>
                    <strong className="text-white font-mono">
                      {formatINR(matchingSignal.currentPrice)}
                    </strong>

                    {/* If FNO Option, also show the live price of that underlying share */}
                    {isFno && underlyingQuote && typeof underlyingQuote.ltp === 'number' && (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-950/70 border border-blue-500/40 text-blue-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                        <span>Underlying {underlyingName}:</span>
                        <strong className="text-white font-mono">
                          {formatINR(underlyingQuote.ltp)}
                        </strong>
                        {typeof underlyingQuote.percentChange === 'number' && (
                          <span
                            className={`text-[10px] ${
                              underlyingQuote.percentChange >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            ({underlyingQuote.percentChange >= 0 ? '+' : ''}
                            {underlyingQuote.percentChange}%)
                          </span>
                        )}
                      </span>
                    )}

                    <span className="text-gray-600">|</span>
                    <span>SL:</span>{' '}
                    <strong className="text-rose-400 font-mono">
                      {formatINR(matchingSignal.stopLoss)}
                    </strong>
                    <span className="text-gray-600">|</span>
                    <span>TP1:</span>{' '}
                    <strong className="text-emerald-400 font-mono">
                      {formatINR(matchingSignal.target1)}
                    </strong>
                  </div>
                </div>

                <div className="flex items-center space-x-3">
                  <button
                    onClick={() => handleOpenExecuteModal(matchingSignal)}
                    className={`flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold transition-all shadow-lg ${
                      isBuy
                        ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30'
                        : isSell
                        ? 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/30'
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/30'
                    }`}
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>Execute {matchingSignal.action} Now</span>
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: DEEP SCRIP ANALYZER */}
      {/* ========================================================================= */}
      {activeTab === 'analyzer' && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-gray-900/80 border border-gray-800 backdrop-blur-xl shadow-xl space-y-5">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-blue-400" />
                Deep Multi-Factor Technical Analyzer
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Select any equity or enter custom symbol token to compute live multi-timeframe indicators, momentum confluence, and high-probability order levels.
              </p>
            </div>

            {/* Quick Pick Watchlist */}
            <div className="space-y-2">
              <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">
                Select from Core Universe:
              </span>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SCRIPS.map((scrip) => (
                  <button
                    key={scrip.token}
                    onClick={() => {
                      setSelectedScrip(scrip);
                      handleAnalyzeScrip(scrip.symbol, scrip.token, scrip.exchange);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${
                      selectedScrip.token === scrip.token
                        ? 'bg-blue-600 text-white border-blue-400 shadow-md shadow-blue-500/20'
                        : 'bg-gray-800/80 text-gray-300 border-gray-700 hover:bg-gray-700'
                    }`}
                  >
                    {scrip.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Input */}
            <div className="flex flex-col sm:flex-row items-center gap-3 pt-3 border-t border-gray-800">
              <input
                type="text"
                placeholder="Or custom Symbol (e.g. PARAGMILK-EQ)"
                value={customSymbol}
                onChange={(e) => setCustomSymbol(e.target.value)}
                className="w-full sm:w-1/2 px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <input
                type="text"
                placeholder="Token (e.g. 17130)"
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
                className="w-full sm:w-1/3 px-4 py-2.5 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs placeholder-gray-500 focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={() => {
                  if (customSymbol && customToken) {
                    handleAnalyzeScrip(customSymbol.toUpperCase(), customToken, 'NSE');
                  }
                }}
                disabled={isAnalyzing || !customSymbol || !customToken}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5 shrink-0"
              >
                <Search className="w-4 h-4" />
                <span>{isAnalyzing ? 'Analyzing...' : 'Deep Analyze'}</span>
              </button>
            </div>
          </div>

          {/* Deep Analysis Result Card */}
          {analyzedSignal && (
            <div className="p-6 rounded-2xl bg-gradient-to-br from-gray-900 via-gray-900 to-blue-950/30 border border-blue-500/40 backdrop-blur-xl shadow-2xl space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-800">
                <div>
                  <div className="flex items-center space-x-3">
                    <h3 className="text-2xl font-bold text-white">{analyzedSignal.symbol}</h3>
                    <span className="text-xs px-2.5 py-1 rounded-md bg-gray-800 text-gray-300 font-mono">
                      {analyzedSignal.exchange} • {analyzedSignal.token}
                    </span>
                    <span
                      className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${
                        analyzedSignal.action === 'BUY'
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : analyzedSignal.action === 'SELL'
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      }`}
                    >
                      AI Verdict: {analyzedSignal.action}
                    </span>
                  </div>
                  {(() => {
                    const flash =
                      priceFlashes[analyzedSignal.token] ||
                      priceFlashes[analyzedSignal.symbol] ||
                      priceFlashes[analyzedSignal.symbol.replace(/-EQ$/, '')];
                    return (
                      <div className="mt-1 text-sm text-gray-400 flex items-center gap-1.5 flex-wrap">
                        <span
                          className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"
                          title="Streaming Live via WebSocket"
                        />
                        <span>Live LTP:</span>
                        <strong
                          className={`font-mono transition-colors ${
                            flash === 'up'
                              ? 'text-emerald-300'
                              : flash === 'down'
                              ? 'text-rose-300'
                              : 'text-white'
                          }`}
                        >
                          {formatINR(analyzedSignal.currentPrice)}
                          {flash === 'up' && <span className="text-xs ml-1 text-emerald-400">▲</span>}
                          {flash === 'down' && <span className="text-xs ml-1 text-rose-400">▼</span>}
                        </strong>
                        <span
                          className={`font-semibold ${
                            analyzedSignal.netChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          ({analyzedSignal.netChange >= 0 ? '+' : ''}
                          {analyzedSignal.percentChange}%)
                        </span>
                      </div>
                    );
                  })()}

                  {/* For F&O Option Contracts in Deep Analyzer: Display Live Price of THAT SHARE */}
                  {(() => {
                    if (
                      analyzedSignal.segment !== 'FNO' &&
                      !analyzedSignal.underlying
                    )
                      return null;
                    const underName =
                      analyzedSignal.underlying ||
                      (analyzedSignal.symbol.includes('BANK')
                        ? 'BANKNIFTY'
                        : 'NIFTY');
                    const underToken =
                      underName === 'BANKNIFTY'
                        ? '99926009'
                        : underName === 'NIFTY'
                        ? '99926000'
                        : undefined;
                    const underQuote =
                      (underToken ? getLiveQuote(underToken) : undefined) ||
                      getLiveQuote(underName);
                    if (!underQuote || typeof underQuote.ltp !== 'number')
                      return null;

                    return (
                      <div className="mt-2.5 p-2 rounded-xl bg-blue-950/40 border border-blue-500/30 flex items-center justify-between text-xs">
                        <span className="text-blue-300 font-medium flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                          Underlying {underName} Live Price:
                        </span>
                        <span className="font-bold text-white font-mono">
                          {formatINR(underQuote.ltp)}
                          {typeof underQuote.percentChange === 'number' && (
                            <span
                              className={`ml-1.5 text-[11px] font-semibold ${
                                underQuote.percentChange >= 0
                                  ? 'text-emerald-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              ({underQuote.percentChange >= 0 ? '+' : ''}
                              {underQuote.percentChange}%)
                            </span>
                          )}
                        </span>
                      </div>
                    );
                  })()}
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="text-xs text-gray-400">Confidence Score</div>
                    <div className="text-2xl font-extrabold text-white">
                      {analyzedSignal.confidence}%
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenExecuteModal(analyzedSignal)}
                    className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 flex items-center gap-2"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    <span>Execute Order</span>
                  </button>
                </div>
              </div>

              {/* Technical Indicator Gauges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="text-xs text-gray-400">RSI (14)</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analyzedSignal.indicators.rsi}
                  </div>
                  <div className="text-xs text-blue-400 mt-0.5">
                    {analyzedSignal.indicators.rsiSignal}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="text-xs text-gray-400">EMA Trend</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analyzedSignal.indicators.emaTrend}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    EMA9: ₹{analyzedSignal.indicators.ema9} | EMA21: ₹{analyzedSignal.indicators.ema21}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="text-xs text-gray-400">MACD Histogram</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analyzedSignal.indicators.macd.histogram}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {analyzedSignal.indicators.macd.trend}
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-gray-950/80 border border-gray-800">
                  <div className="text-xs text-gray-400">Order Depth</div>
                  <div className="text-xl font-bold text-white mt-1">
                    {analyzedSignal.indicators.orderBookImbalance}%
                  </div>
                  <div className="text-xs text-emerald-400 mt-0.5">Buyers in Queue</div>
                </div>
              </div>

              {/* Execution Price Levels */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-gray-950/80 border border-gray-800 text-center">
                <div>
                  <div className="text-xs text-gray-400">Optimal Entry</div>
                  <div className="text-base font-bold text-white mt-0.5">
                    {formatINR(analyzedSignal.entryPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Target 1 (Primary)</div>
                  <div className="text-base font-bold text-emerald-400 mt-0.5">
                    {formatINR(analyzedSignal.target1)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Target 2 (Runner)</div>
                  <div className="text-base font-bold text-emerald-300 mt-0.5">
                    {formatINR(analyzedSignal.target2)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-400">Stop Loss (ATR)</div>
                  <div className="text-base font-bold text-rose-400 mt-0.5">
                    {formatINR(analyzedSignal.stopLoss)}
                  </div>
                </div>
              </div>

              {/* Full AI Thesis */}
              <div className="p-4 rounded-xl bg-blue-950/30 border border-blue-500/30 space-y-2">
                <h4 className="text-xs font-bold text-blue-300 uppercase tracking-wider">
                  AI Investment Thesis & Confluence:
                </h4>
                <p className="text-sm text-gray-200 leading-relaxed font-medium">
                  {analyzedSignal.aiThesis.summary}
                </p>
                <div className="space-y-1.5 pt-2">
                  {analyzedSignal.aiThesis.rationale.map((r, i) => (
                    <div key={i} className="flex items-start space-x-2 text-xs text-gray-300">
                      <ChevronRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Live TradingView Candlestick Chart for Analyzed Scrip */}
              <div className="pt-2">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Live Technical Candlestick Chart:
                </h4>
                <TradingViewChart
                  symbol={analyzedSignal.symbol}
                  interval="15"
                  height={480}
                  theme="dark"
                  enableStudies={true}
                  allowSymbolChange={true}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ORDER BOOK & EXECUTION HISTORY */}
      {/* ========================================================================= */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <History className="w-5 h-5 text-blue-400" />
              Order Execution Book ({orders.length})
            </h2>
            <button
              onClick={loadOrders}
              disabled={isLoadingOrders}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingOrders ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {orders.length === 0 ? (
            <div className="text-center py-12 bg-gray-900/40 rounded-2xl border border-gray-800">
              <History className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-gray-300">No Orders in Book</h3>
              <p className="text-sm text-gray-500 mt-1">
                Execute a trade signal or let Auto-Pilot place simulated/live orders.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-gray-800 bg-gray-900/80 shadow-xl">
              <table className="w-full text-left text-xs text-gray-300">
                <thead className="bg-gray-950 text-gray-400 uppercase text-[11px] font-semibold border-b border-gray-800">
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
                <tbody className="divide-y divide-gray-800/80 font-mono">
                  {orders.map((o) => {
                    const isBuy = o.transactiontype === 'BUY';
                    const isPaper = o.orderid.startsWith('PAPER_');

                    return (
                      <tr key={o.orderid} className="hover:bg-gray-800/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-white">{o.orderid}</div>
                          <div className="text-[10px] text-gray-500">{o.updatetime}</div>
                        </td>
                        <td className="px-4 py-3 font-sans font-semibold text-white">
                          {o.tradingsymbol}
                          <span className="text-[10px] text-gray-500 ml-1 font-mono">
                            {o.exchange}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                              isBuy
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                            }`}
                          >
                            {o.transactiontype}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-400">{o.producttype}</td>
                        <td className="px-4 py-3 text-right font-bold text-white">{o.quantity}</td>
                        <td className="px-4 py-3 text-right font-bold text-white">
                          {o.price > 0 ? formatINR(o.price) : 'MARKET'}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              o.status === 'complete' || o.orderstatus === 'complete'
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : 'bg-amber-500/20 text-amber-300'
                            }`}
                          >
                            {o.status || o.orderstatus || 'SUBMITTED'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              isPaper
                                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
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

      {/* ========================================================================= */}
      {/* 1-CLICK ORDER EXECUTION MODAL */}
      {/* ========================================================================= */}
      {executingSignal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6 space-y-5">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <Play className="w-5 h-5 text-blue-400 fill-current" />
                <h3 className="text-lg font-bold text-white">
                  Confirm AI Trade Execution
                </h3>
              </div>
              <button
                onClick={() => setExecutingSignal(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Signal Snapshot */}
            <div className="p-3.5 rounded-xl bg-gray-950 border border-gray-800 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="font-bold text-base text-white">
                    {executingSignal.symbol}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">
                    {executingSignal.exchange} • {executingSignal.token}
                  </span>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold uppercase ${
                    executingSignal.action === 'BUY'
                      ? 'bg-emerald-500 text-gray-950'
                      : 'bg-rose-500 text-white'
                  }`}
                >
                  {executingSignal.action}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-gray-800/60">
                <div>
                  <div className="text-gray-500 text-[10px]">LTP</div>
                  <div className="font-bold text-white">
                    {formatINR(executingSignal.currentPrice)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-[10px]">Target 1</div>
                  <div className="font-bold text-emerald-400">
                    {formatINR(executingSignal.target1)}
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 text-[10px]">Stop Loss</div>
                  <div className="font-bold text-rose-400">
                    {formatINR(executingSignal.stopLoss)}
                  </div>
                </div>
              </div>
            </div>

            {/* Execution Form Controls */}
            <div className="space-y-4 text-xs">
              {/* Mode Selection */}
              <div>
                <label className="text-gray-300 font-semibold block mb-1.5">
                  Execution Destination:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setExecMode('PAPER')}
                    className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 ${
                      execMode === 'PAPER'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 text-amber-400" />
                    <span>Paper Simulation</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setExecMode('LIVE')}
                    className={`py-2 px-3 rounded-xl border font-semibold flex items-center justify-center gap-1.5 ${
                      execMode === 'LIVE'
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50'
                        : 'bg-gray-800 text-gray-400 border-gray-700'
                    }`}
                  >
                    <Zap className="w-4 h-4 text-emerald-400" />
                    <span>Live SmartAPI Broker</span>
                  </button>
                </div>
              </div>

              {/* Quantity / Lots */}
              {executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO' ? (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-gray-300 font-semibold">Lots to Trade:</label>
                    <span className="text-purple-400 font-mono">
                      {execLots} {execLots === 1 ? 'Lot' : 'Lots'} = {execLots * (executingSignal.lotSize || 65)} shares
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {[1, 2, 3, 5, 10].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setExecLots(num)}
                        className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          execLots === num
                            ? 'bg-purple-600 text-white border-purple-400'
                            : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700'
                        }`}
                      >
                        {num}x
                      </button>
                    ))}
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={execLots}
                      onChange={(e) => setExecLots(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 px-2 py-1.5 rounded-lg bg-gray-950 border border-gray-700 text-white text-center font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">
                    Quantity (Shares):
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={execQuantity}
                    onChange={(e) => setExecQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}

              {/* Product Type & Order Type */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Product Type:</label>
                  <select
                    value={execProductType}
                    onChange={(e) => setExecProductType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  >
                    {executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO' ? (
                      <>
                        <option value="CARRYFORWARD">CARRYFORWARD (NRML)</option>
                        <option value="INTRADAY">INTRADAY (MIS)</option>
                      </>
                    ) : (
                      <>
                        <option value="INTRADAY">INTRADAY (MIS)</option>
                        <option value="DELIVERY">DELIVERY (CNC)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Order Type:</label>
                  <select
                    value={execOrderType}
                    onChange={(e) => setExecOrderType(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </div>
              </div>

              {/* Limit Price if LIMIT */}
              {execOrderType === 'LIMIT' && (
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Limit Price (₹):</label>
                  <input
                    type="number"
                    step="0.05"
                    value={execLimitPrice}
                    onChange={(e) => setExecLimitPrice(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              )}
            </div>

            {/* Total Estimated Cost */}
            <div className="p-3 rounded-xl bg-gray-950 text-xs flex items-center justify-between border border-gray-800">
              <span className="text-gray-400">
                {executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO'
                  ? 'Total Premium Required:'
                  : 'Total Order Value:'}
              </span>
              <span className="text-base font-bold text-white font-mono">
                {formatINR(
                  (executingSignal.exchange === 'NFO' || executingSignal.segment === 'FNO'
                    ? execLots * (executingSignal.lotSize || 65)
                    : execQuantity) * executingSignal.currentPrice
                )}
              </span>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setExecutingSignal(null)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmOrder}
                disabled={isExecuting}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white shadow-lg transition-all flex items-center gap-2 ${
                  executingSignal.action === 'BUY'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/30'
                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-600/30'
                } disabled:opacity-50`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>{isExecuting ? 'Transmitting Order...' : `Confirm ${executingSignal.action} Order`}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUTO-PILOT SETTINGS MODAL */}
      {/* ========================================================================= */}
      {isAutoPilotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
          <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-800">
              <div className="flex items-center space-x-2">
                <Sliders className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">AI Auto-Pilot Controls</h3>
              </div>
              <button
                onClick={() => setIsAutoPilotModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Enable Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-gray-950 border border-gray-800">
                <div>
                  <div className="font-semibold text-white">Auto-Pilot Status</div>
                  <div className="text-[11px] text-gray-400">
                    Automatically executes qualifying signals
                  </div>
                </div>
                <button
                  onClick={() => setAutoPilot((p) => ({ ...p, enabled: !p.enabled }))}
                  className={`w-12 h-6 rounded-full p-1 transition-all ${
                    autoPilot.enabled ? 'bg-emerald-600' : 'bg-gray-700'
                  }`}
                >
                  <div
                    className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                      autoPilot.enabled ? 'translate-x-6' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Mode */}
              <div>
                <label className="text-gray-300 font-semibold block mb-1">
                  Execution Mode:
                </label>
                <select
                  value={autoPilot.mode}
                  onChange={(e) => setAutoPilot((p) => ({ ...p, mode: e.target.value as any }))}
                  className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                >
                  <option value="PAPER">Simulated Paper Trading (Safe)</option>
                  <option value="LIVE">Live SmartAPI Broker (Real Capital)</option>
                </select>
              </div>

              {/* Confidence Threshold */}
              <div>
                <div className="flex justify-between text-gray-300 font-semibold mb-1">
                  <span>Minimum Signal Confidence:</span>
                  <span className="text-blue-400 font-bold">{autoPilot.minConfidence}%</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="95"
                  step="5"
                  value={autoPilot.minConfidence}
                  onChange={(e) =>
                    setAutoPilot((p) => ({ ...p, minConfidence: parseInt(e.target.value) || 75 }))
                  }
                  className="w-full accent-blue-500"
                />
              </div>

              {/* Quantity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Default Quantity:</label>
                  <input
                    type="number"
                    min="1"
                    value={autoPilot.defaultQuantity}
                    onChange={(e) =>
                      setAutoPilot((p) => ({
                        ...p,
                        defaultQuantity: Math.max(1, parseInt(e.target.value) || 1),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label className="text-gray-300 font-semibold block mb-1">Max Daily Trades:</label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={autoPilot.maxDailyTrades}
                    onChange={(e) =>
                      setAutoPilot((p) => ({
                        ...p,
                        maxDailyTrades: Math.max(1, parseInt(e.target.value) || 5),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsAutoPilotModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => handleSaveAutoPilot(autoPilot)}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30"
              >
                Save Settings
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Scanning Universe Management Modal */}
      {isUniverseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-gray-900 border border-purple-500/30 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 pb-4">
              <div className="flex items-center space-x-3">
                <span className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-400/30">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    Dynamic AI Scanner Universe
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-400/30">
                      {universe.length} Scrips
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    AI continuously analyzes these assets. Add custom stocks, Demat holdings, or market movers.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsUniverseModalOpen(false)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Source Breakdown Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
              <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                  Core Index
                </span>
                <span className="font-bold text-white">
                  {universe.filter((u) => u.source === 'CORE' || !u.source).length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-emerald-400" />
                  Holdings
                </span>
                <span className="font-bold text-emerald-400">
                  {universe.filter((u) => u.source === 'HOLDING').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-amber-400" />
                  Movers
                </span>
                <span className="font-bold text-amber-400">
                  {universe.filter((u) => u.source === 'MARKET_MOVER').length}
                </span>
              </div>
              <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800 flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-purple-400" />
                  Custom
                </span>
                <span className="font-bold text-purple-400">
                  {universe.filter((u) => u.source === 'CUSTOM').length}
                </span>
              </div>
            </div>

            {/* Search and Add to Universe */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-300 flex items-center gap-1.5">
                <Search className="w-3.5 h-3.5 text-purple-400" />
                Search & Add Stock or F&O Strike to Scanner
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. ZOMATO, TATAMOTORS, NIFTY 25000 PE, INFY..."
                  value={universeSearchQuery}
                  onChange={(e) => handleUniverseSearch(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-gray-950 border border-gray-700 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                />
                {isSearchingUniverse && (
                  <RefreshCw className="w-4 h-4 text-purple-400 animate-spin absolute right-3 top-2.5" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {universeSearchResults.length > 0 && (
                <div className="max-h-48 overflow-y-auto rounded-xl bg-gray-950 border border-gray-800 p-2 space-y-1.5 divide-y divide-gray-800/60 shadow-xl">
                  {universeSearchResults.map((item) => (
                    <div
                      key={item.token}
                      className="pt-1.5 first:pt-0 flex items-center justify-between hover:bg-gray-900/60 p-2 rounded-lg transition-all"
                    >
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-white flex items-center gap-2">
                          <span>{item.symbol}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                            {item.exch_seg || 'NSE'}
                          </span>
                        </div>
                        <div className="text-[11px] text-gray-400 truncate max-w-xs">
                          {item.name || item.symbol} &bull; Token: {item.token}
                        </div>
                      </div>
                      <button
                        onClick={() => handleAddUniverseScrip(item)}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-sm transition-all"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center space-x-2 border-b border-gray-800 pb-2 text-xs">
              {(['ALL', 'CUSTOM', 'HOLDING', 'MARKET_MOVER', 'CORE'] as const).map((tab) => {
                const count =
                  tab === 'ALL'
                    ? universe.length
                    : tab === 'CORE'
                    ? universe.filter((u) => u.source === 'CORE' || !u.source).length
                    : universe.filter((u) => u.source === tab).length;
                return (
                  <button
                    key={tab}
                    onClick={() => setUniverseFilter(tab)}
                    className={`px-3 py-1 rounded-lg font-medium transition-all ${
                      universeFilter === tab
                        ? 'bg-purple-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    {tab.replace('_', ' ')} ({count})
                  </button>
                );
              })}
            </div>

            {/* Active Universe List */}
            <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[160px] max-h-72">
              {isLoadingUniverse ? (
                <div className="flex items-center justify-center py-8 text-gray-400 space-x-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                  <span className="text-xs">Loading active dynamic universe...</span>
                </div>
              ) : universe.length === 0 ? (
                <div className="text-center py-8 text-gray-400 text-xs">
                  No scrips in universe. Click Reset or add a custom scrip above.
                </div>
              ) : (
                universe
                  .filter((item) => {
                    if (universeFilter === 'ALL') return true;
                    if (universeFilter === 'CORE') return item.source === 'CORE' || !item.source;
                    return item.source === universeFilter;
                  })
                  .map((item) => {
                    const isCustom = item.source === 'CUSTOM';
                    const isHolding = item.source === 'HOLDING';
                    const isMover = item.source === 'MARKET_MOVER';

                    return (
                      <div
                        key={`${item.exchange}_${item.token}`}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950/80 border border-gray-800/80 hover:border-gray-700 transition-all text-xs"
                      >
                        <div className="flex items-center space-x-3">
                          <span
                            className={`p-1.5 rounded-lg ${
                              isCustom
                                ? 'bg-purple-500/20 text-purple-300'
                                : isHolding
                                ? 'bg-emerald-500/20 text-emerald-300'
                                : isMover
                                ? 'bg-amber-500/20 text-amber-300'
                                : 'bg-blue-500/20 text-blue-300'
                            }`}
                          >
                            {isCustom ? (
                              <Plus className="w-3.5 h-3.5" />
                            ) : isHolding ? (
                              <Briefcase className="w-3.5 h-3.5" />
                            ) : isMover ? (
                              <Flame className="w-3.5 h-3.5" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5" />
                            )}
                          </span>
                          <div>
                            <div className="font-bold text-white flex items-center gap-1.5">
                              <span>{item.symbol}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300">
                                {item.exchange}
                              </span>
                              {item.segment && (
                                <span className="text-[9px] px-1 py-0.2 rounded bg-gray-800 text-gray-400">
                                  {item.segment}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400">
                              {item.name || item.symbol} &bull; Token: {item.token}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          <span
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isCustom
                                ? 'bg-purple-950/60 text-purple-300 border-purple-500/40'
                                : isHolding
                                ? 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40'
                                : isMover
                                ? 'bg-amber-950/60 text-amber-300 border-amber-500/40'
                                : 'bg-blue-950/60 text-blue-300 border-blue-500/40'
                            }`}
                          >
                            {isCustom
                              ? 'Custom'
                              : isHolding
                              ? 'Demat Holding'
                              : isMover
                              ? 'Market Mover'
                              : 'Core Index'}
                          </span>

                          {isCustom && (
                            <button
                              onClick={() => handleRemoveUniverseScrip(item.token, item.symbol)}
                              className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/20 hover:text-rose-300 transition-all"
                              title="Remove from universe"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
              )}
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-between border-t border-gray-800 pt-3 text-xs">
              <button
                type="button"
                onClick={handleResetUniverse}
                className="text-gray-400 hover:text-rose-300 transition-all"
              >
                Reset to Dynamic Baseline
              </button>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setIsUniverseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 font-semibold"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsUniverseModalOpen(false);
                    loadSignals(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold shadow-md shadow-purple-600/30"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Re-Scan Universe Now</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AiTradingScreen;
