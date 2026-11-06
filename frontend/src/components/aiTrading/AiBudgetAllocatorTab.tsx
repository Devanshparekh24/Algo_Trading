import React from 'react';
import {
  Wallet,
  RefreshCw,
  Coins,
  Sparkles,
  ShieldCheck,
  Layers,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  AlertCircle,
  Bot,
  Target,
  Check,
  BarChart2,
  Play,
} from 'lucide-react';
import type {
  BudgetAnalysisResult,
  RiskProfile,
  BudgetSegment,
  VolatileOptionItem,
  TradeSignal,
} from '../../services/aiTradingService';
import { formatINR } from '../../utils/formatters';

interface AiBudgetAllocatorTabProps {
  budgetInput: string;
  setBudgetInput: (val: string) => void;
  budgetRiskProfile: RiskProfile;
  setBudgetRiskProfile: (p: RiskProfile) => void;
  budgetSegment: BudgetSegment;
  setBudgetSegment: (s: BudgetSegment) => void;
  budgetMaxTrades: number;
  setBudgetMaxTrades: (n: number) => void;
  budgetAnalysis: BudgetAnalysisResult | null;
  isAnalyzingBudget: boolean;
  budgetError: string | null;
  brokerFunds: { net: number; available: number } | null;
  isLoadingFunds: boolean;
  onLoadBrokerFunds: () => void;
  onRunBudgetAnalysis: (customBudget?: number, customSegment?: BudgetSegment) => void;
  onAllocateVolatileOption: (option: VolatileOptionItem) => void;
  fnoCallsList: any[];
  fnoPutsList: any[];
  volatileRadarTab: 'calls' | 'puts';
  setVolatileRadarTab: (tab: 'calls' | 'puts') => void;
  onOpenChart: (symbol: string) => void;
  onOpenExecuteModal: (signal: TradeSignal, customLots?: number, customQuantity?: number) => void;
  onOpenAutoPilotModal?: (customBudget?: number) => void;
}

const PRESET_BUDGETS = [
  { label: '₹2,000 (Micro)', val: 2000 },
  { label: '₹5,000', val: 5000 },
  { label: '₹10,000 (Popular)', val: 10000 },
  { label: '₹25,000', val: 25000 },
  { label: '₹50,000', val: 50000 },
  { label: '₹1,00,000 (Scale)', val: 100000 },
  { label: '₹2,50,000', val: 250000 },
];

const RISK_PROFILES: Array<{
  id: RiskProfile;
  title: string;
  badge: string;
  desc: string;
}> = [
  {
    id: 'CONSERVATIVE',
    title: 'Conservative',
    badge: '🛡️ Low Risk',
    desc: 'Max 2% risk/trade, 40% cap, 1-2 setups',
  },
  {
    id: 'MODERATE',
    title: 'Moderate',
    badge: '⚖️ Balanced',
    desc: 'Max 3.5% risk/trade, 55% cap, 2-3 setups',
  },
  {
    id: 'AGGRESSIVE',
    title: 'Aggressive',
    badge: '🚀 High Alpha',
    desc: 'Max 6% risk/trade, 75% cap, 3-4 setups',
  },
];

const TARGET_SEGMENTS: Array<{
  id: BudgetSegment;
  label: string;
  desc: string;
  icon: string;
}> = [
  { id: 'GREEK_SNIPER', label: '⚡ Greek Sniper', desc: 'Δ 0.3-0.5, Top Γ, 45m exit', icon: '🎯' },
  { id: 'ALL', label: 'All Markets', desc: 'Equity + F&O', icon: '🌐' },
  { id: 'EQUITY', label: 'Equities Only', desc: 'Cash stocks', icon: '📈' },
  { id: 'FNO', label: 'F&O Standard', desc: 'Options & Futures', icon: '⚡' },
  { id: 'VOLATILE_CALLS', label: 'Volatile Calls', desc: 'Top CE Movers', icon: '🚀' },
  { id: 'VOLATILE_PUTS', label: 'Volatile Puts', desc: 'Top PE Movers', icon: '💥' },
  { id: 'VOLATILE_OPTIONS', label: 'All Volatile F&O', desc: 'High Alpha CE & PE', icon: '🔥' },
];

export const AiBudgetAllocatorTab: React.FC<AiBudgetAllocatorTabProps> = ({
  budgetInput,
  setBudgetInput,
  budgetRiskProfile,
  setBudgetRiskProfile,
  budgetSegment,
  setBudgetSegment,
  budgetMaxTrades,
  setBudgetMaxTrades,
  budgetAnalysis,
  isAnalyzingBudget,
  budgetError,
  brokerFunds,
  isLoadingFunds,
  onLoadBrokerFunds,
  onRunBudgetAnalysis,
  onAllocateVolatileOption,
  fnoCallsList,
  fnoPutsList,
  volatileRadarTab,
  setVolatileRadarTab,
  onOpenChart,
  onOpenExecuteModal,
  onOpenAutoPilotModal,
}) => {
  const liveCalls = budgetAnalysis?.volatileCalls || fnoCallsList || [];
  const livePuts = budgetAnalysis?.volatilePuts || fnoPutsList || [];
  const activeVolatileList = volatileRadarTab === 'calls' ? liveCalls : livePuts;

  return (
    <div className="space-y-6">
      {/* Interactive Budget Configuration Panel */}
      <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-xs dark:shadow-xl space-y-6 transition-colors">
        {/* Panel Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-300 dark:border-emerald-500/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <span>AI Capital Allocator & Trade Advisor</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-500/40">
                  Live Position Sizing
                </span>
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-2xl leading-relaxed">
                Enter your trading capital or auto-sync your live broker cash. The AI scans active market setups across Equities and F&O, calculates exact share and lot quantities, and constructs a risk-disciplined portfolio tailored to your budget.
              </p>
            </div>
          </div>

          {/* Angel One Broker Live Cash Auto-Sync */}
          <div className="flex items-center space-x-2 bg-gray-50 dark:bg-gray-950 p-2.5 rounded-xl border border-gray-200 dark:border-gray-800 text-xs shrink-0 self-start md:self-auto transition-colors">
            <div className="flex flex-col">
              <span className="text-[10px] text-gray-500 dark:text-gray-400 uppercase tracking-wider">Angel One Margin:</span>
              <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                {brokerFunds ? `₹${brokerFunds.available.toLocaleString('en-IN')}` : 'Connecting...'}
              </span>
            </div>
            {brokerFunds && brokerFunds.available > 0 && (
              <button
                type="button"
                onClick={() => {
                  setBudgetInput(String(brokerFunds.available));
                  onRunBudgetAnalysis(brokerFunds.available);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-emerald-600/10 hover:bg-emerald-600 text-emerald-700 hover:text-white dark:bg-emerald-600/30 dark:hover:bg-emerald-600 dark:text-emerald-300 dark:hover:text-white border border-emerald-300 dark:border-emerald-500/40 font-semibold transition-all text-[11px]"
              >
                Use Funds
              </button>
            )}
            <button
              type="button"
              onClick={onLoadBrokerFunds}
              disabled={isLoadingFunds}
              className="p-1.5 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 transition-all shadow-2xs"
              title="Refresh Broker Funds"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFunds ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Budget Input & Preset Chips */}
        <div className="space-y-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
            <Coins className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
            <span>Trading Capital / Budget (₹ INR)</span>
          </label>

          <div className="flex flex-col sm:flex-row items-stretch gap-3">
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg font-mono">
                ₹
              </span>
              <input
                type="number"
                min="500"
                step="500"
                value={budgetInput}
                onChange={(e) => setBudgetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRunBudgetAnalysis();
                }}
                placeholder="e.g. 10000"
                className="w-full pl-9 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-bold text-lg font-mono focus:border-emerald-500 focus:outline-none transition-all shadow-2xs"
              />
            </div>

            <button
              type="button"
              onClick={() => onRunBudgetAnalysis()}
              disabled={isAnalyzingBudget}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
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
            <span className="text-[11px] text-gray-500 dark:text-gray-400 font-medium">Quick Presets:</span>
            {PRESET_BUDGETS.map((preset) => (
              <button
                key={preset.val}
                type="button"
                onClick={() => {
                  setBudgetInput(String(preset.val));
                  onRunBudgetAnalysis(preset.val);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all border ${
                  budgetInput === String(preset.val)
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-400 dark:bg-emerald-600/30 dark:text-emerald-300 dark:border-emerald-500/50 shadow-2xs'
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-200 dark:bg-gray-800/80 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-700'
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
            <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
              <span>Risk Profile Strategy</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              {RISK_PROFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setBudgetRiskProfile(p.id);
                    if (budgetAnalysis) {
                      setTimeout(() => onRunBudgetAnalysis(), 50);
                    }
                  }}
                  className={`p-3 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    budgetRiskProfile === p.id
                      ? 'bg-emerald-50 border-emerald-500 text-gray-900 dark:bg-emerald-950/40 dark:border-emerald-500 dark:text-white shadow-2xs'
                      : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-950/60 dark:border-gray-800 dark:hover:border-gray-700 dark:text-gray-400'
                  }`}
                >
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider block text-emerald-600 dark:text-emerald-400">
                      {p.badge}
                    </span>
                    <div className="font-bold text-gray-900 dark:text-white text-xs mt-0.5">{p.title}</div>
                  </div>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 leading-tight">{p.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Asset Segment & Max Trades */}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                <span>Target Market Universe</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {TARGET_SEGMENTS.map((seg) => (
                  <button
                    key={seg.id}
                    type="button"
                    onClick={() => {
                      setBudgetSegment(seg.id);
                      if (budgetAnalysis) {
                        setTimeout(() => onRunBudgetAnalysis(undefined, seg.id), 50);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-center transition-all ${
                      budgetSegment === seg.id
                        ? 'bg-blue-600 text-white border-blue-500 shadow-2xs'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-950/60 dark:border-gray-800 dark:text-gray-400 dark:hover:text-white'
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
              <span className="text-gray-500 dark:text-gray-400 font-medium">Max Concurrent Trades:</span>
              <div className="flex items-center space-x-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setBudgetMaxTrades(n);
                      if (budgetAnalysis) {
                        setTimeout(() => onRunBudgetAnalysis(), 50);
                      }
                    }}
                    className={`w-7 h-7 rounded-lg text-xs font-bold transition-all ${
                      budgetMaxTrades === n
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white'
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
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center space-x-2">
                <Flame className="w-4 h-4 text-amber-500 dark:text-amber-400 animate-pulse" />
                <h4 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider flex items-center gap-2">
                  <span>Most Volatile Call & Put Options</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30 normal-case font-semibold">
                    Live SmartAPI Stream
                  </span>
                </h4>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Highest swing derivatives with explosive delta momentum. Tap <strong>Allocate</strong> to size lots for your capital.
              </p>
            </div>

            {/* CE / PE Tabs Switcher */}
            <div className="flex items-center space-x-1.5 bg-gray-100 dark:bg-gray-950 p-1 rounded-xl border border-gray-200 dark:border-gray-800 text-xs shrink-0">
              <button
                type="button"
                onClick={() => setVolatileRadarTab('calls')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  volatileRadarTab === 'calls'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5" />
                <span>Volatile Calls (CE)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-black/40 font-mono">
                  {liveCalls.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setVolatileRadarTab('puts')}
                className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                  volatileRadarTab === 'puts'
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                }`}
              >
                <ArrowDownRight className="w-3.5 h-3.5" />
                <span>Volatile Puts (PE)</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-black/10 dark:bg-black/40 font-mono">
                  {livePuts.length}
                </span>
              </button>
            </div>
          </div>

          {/* Options Cards Grid */}
          {activeVolatileList.length === 0 ? (
            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-950/50 border border-gray-200 dark:border-gray-800/80 text-center text-xs text-gray-500 dark:text-gray-400">
              Loading volatile {volatileRadarTab === 'calls' ? 'Call (CE)' : 'Put (PE)'} contracts from live market...
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {activeVolatileList.slice(0, 4).map((item) => {
                const isCall = item.instrumentType === 'CE';
                const lotSize = item.tradingSymbol.startsWith('BANKNIFTY') ? 30 : 65;
                const lotCost = Math.round(item.ltp * lotSize);
                const isUp = item.percentChange >= 0;

                return (
                  <div
                    key={item.symbolToken || item.tradingSymbol}
                    className={`p-3.5 rounded-xl bg-white dark:bg-gray-950/90 border transition-all flex flex-col justify-between hover:shadow-md ${
                      isCall
                        ? 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-500/25 dark:hover:border-emerald-500/60'
                        : 'border-rose-200 hover:border-rose-400 dark:border-rose-500/25 dark:hover:border-rose-500/60'
                    }`}
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <span className="font-bold text-gray-900 dark:text-white text-xs truncate font-mono" title={item.tradingSymbol}>
                          {item.tradingSymbol}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold shrink-0 ${
                            isCall
                              ? 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-500/40'
                              : 'bg-rose-100 text-rose-700 border border-rose-200 dark:bg-rose-950 dark:text-rose-300 dark:border-rose-500/40'
                          }`}
                        >
                          {item.instrumentType}
                        </span>
                      </div>
                      <div className="text-[10px] text-gray-500 dark:text-gray-400">
                        Strike: <strong>₹{item.strike?.toLocaleString('en-IN') || '-'}</strong> • Exp: {item.expiry}
                      </div>
                    </div>

                    <div className="mt-3 pt-2 border-t border-gray-100 dark:border-gray-800/80 flex items-end justify-between">
                      <div>
                        <div className="text-[10px] text-gray-500 dark:text-gray-400">Live LTP</div>
                        <div className="text-sm font-bold text-gray-900 dark:text-white font-mono flex items-center gap-1.5">
                          {formatINR(item.ltp)}
                          <span
                            className={`text-[10px] font-bold px-1 py-0.2 rounded ${
                              isUp
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400'
                                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                            }`}
                          >
                            {isUp ? '+' : ''}{item.percentChange.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[9px] text-gray-500 dark:text-gray-400 font-mono mt-0.5">
                          1 Lot ({lotSize}u) = ₹{lotCost.toLocaleString('en-IN')}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => onAllocateVolatileOption(item)}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 shadow-2xs shrink-0 ${
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

        {/* Error Message */}
        {budgetError && (
          <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-500 dark:text-rose-400 shrink-0" />
              <span>{budgetError}</span>
            </div>
            <button
              type="button"
              onClick={() => onRunBudgetAnalysis()}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>

      {/* Loading State Animation */}
      {isAnalyzingBudget && (
        <div className="p-12 rounded-2xl bg-white dark:bg-gray-900/60 border border-gray-200 dark:border-gray-800 flex flex-col items-center justify-center space-y-3 shadow-sm dark:shadow-lg transition-colors">
          <div className="relative">
            <div className="w-14 h-14 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin" />
            <Bot className="w-6 h-6 text-emerald-500 dark:text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
          </div>
          <p className="text-gray-900 dark:text-white font-semibold text-sm">
            AI scanning market opportunities for ₹{parseFloat(budgetInput || '0').toLocaleString('en-IN')}...
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Evaluating {budgetRiskProfile} risk parameters, computing affordable share quantities & option lots.
          </p>
        </div>
      )}

      {/* Analysis Results View */}
      {!isAnalyzingBudget && budgetAnalysis && (
        <div className="space-y-6">
          {/* Capital Allocation & Health Overview Card */}
          <div className="p-5 md:p-6 rounded-2xl bg-white dark:bg-gray-900/90 border border-gray-200 dark:border-gray-800 backdrop-blur-xl shadow-xs dark:shadow-xl space-y-5 transition-colors">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  Portfolio Construction Complete
                </span>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mt-0.5">
                  Capital Deployment for ₹{budgetAnalysis.budget.toLocaleString('en-IN')} ({budgetAnalysis.riskProfile} Profile)
                </h3>
              </div>

              <div className="flex items-center space-x-2 flex-wrap gap-2">
                {onOpenAutoPilotModal && (
                  <button
                    type="button"
                    onClick={() => onOpenAutoPilotModal(budgetAnalysis.budget)}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-md shadow-emerald-600/25 flex items-center gap-1.5 transition-all"
                    title={`Arm Auto-Pilot with ₹${budgetAnalysis.budget.toLocaleString('en-IN')} max budget`}
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Arm Auto-Pilot (₹{budgetAnalysis.budget.toLocaleString('en-IN')})</span>
                  </button>
                )}
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Health:</span>
                  <span className="px-2.5 py-1 rounded-xl bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-300 dark:border-emerald-500/40 text-xs flex items-center gap-1 font-mono">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                    {budgetAnalysis.portfolioHealthScore}/100
                  </span>
                </div>
              </div>
            </div>

            {/* Capital Allocation Progress Bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs flex-wrap gap-2">
                <span className="text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                  Deployed: <strong className="font-mono text-gray-900 dark:text-white">₹{budgetAnalysis.totalCapitalAllocated.toLocaleString('en-IN')}</strong> (
                  {(100 - budgetAnalysis.bufferPercentage).toFixed(1)}%)
                </span>
                <span className="text-gray-700 dark:text-gray-300 font-semibold flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  Liquid Cash Buffer: <strong className="font-mono text-gray-900 dark:text-white">₹{budgetAnalysis.remainingCashBuffer.toLocaleString('en-IN')}</strong> (
                  {budgetAnalysis.bufferPercentage}%)
                </span>
              </div>
              <div className="w-full h-3 bg-gray-100 dark:bg-gray-950 rounded-full overflow-hidden flex border border-gray-200 dark:border-gray-800 p-0.5">
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
              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950/80 border border-gray-200 dark:border-gray-800">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Total Capital</div>
                <div className="text-base font-bold text-gray-900 dark:text-white mt-1 font-mono">
                  ₹{budgetAnalysis.budget.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">100% Base Budget</div>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950/80 border border-gray-200 dark:border-gray-800">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Deployed</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  ₹{budgetAnalysis.totalCapitalAllocated.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                  {budgetAnalysis.suggestions.length} Positions Sized
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950/80 border border-gray-200 dark:border-gray-800">
                <div className="text-[10px] text-gray-500 dark:text-gray-400 uppercase font-semibold">Cash Buffer</div>
                <div className="text-base font-bold text-blue-600 dark:text-blue-400 mt-1 font-mono">
                  ₹{budgetAnalysis.remainingCashBuffer.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400/80 mt-0.5">{budgetAnalysis.bufferPercentage}% Liquid Cushion</div>
              </div>

              <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-gray-950/80 border border-rose-200 dark:border-rose-500/20">
                <div className="text-[10px] text-rose-700 dark:text-rose-300 uppercase font-semibold">Max Combined Risk</div>
                <div className="text-base font-bold text-rose-600 dark:text-rose-400 mt-1 font-mono">
                  ₹{budgetAnalysis.totalMaxRisk.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-rose-600 dark:text-rose-400/80 mt-0.5">
                  {budgetAnalysis.totalMaxRiskPercentage}% Total Drawdown
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-gray-950/80 border border-emerald-200 dark:border-emerald-500/20">
                <div className="text-[10px] text-emerald-700 dark:text-emerald-300 uppercase font-semibold">Target 1 Upside</div>
                <div className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  +₹{budgetAnalysis.totalExpectedProfitT1.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400/80 mt-0.5">
                  +{((budgetAnalysis.totalExpectedProfitT1 / budgetAnalysis.budget) * 100).toFixed(1)}% Return
                </div>
              </div>

              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-gray-950/80 border border-purple-200 dark:border-purple-500/20">
                <div className="text-[10px] text-purple-700 dark:text-purple-300 uppercase font-semibold">Target 2 Upside</div>
                <div className="text-base font-bold text-purple-600 dark:text-purple-400 mt-1 font-mono">
                  +₹{budgetAnalysis.totalExpectedProfitT2.toLocaleString('en-IN')}
                </div>
                <div className="text-[10px] text-purple-600 dark:text-purple-400/80 mt-0.5">R:R {budgetAnalysis.overallRiskReward}</div>
              </div>
            </div>

            {/* AI Strategic Portfolio Thesis */}
            <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-gradient-to-r dark:from-blue-950/30 dark:to-purple-950/20 border border-blue-200 dark:border-blue-500/20 text-xs space-y-2 transition-colors">
              <div className="flex items-center space-x-2 text-blue-700 dark:text-blue-400 font-bold">
                <Sparkles className="w-4 h-4" />
                <span>AI Strategic Portfolio Thesis</span>
              </div>
              <p className="text-gray-800 dark:text-gray-200 leading-relaxed font-medium">
                {budgetAnalysis.aiSummary}
              </p>
              <ul className="space-y-1.5 pt-1 text-gray-700 dark:text-gray-300">
                {budgetAnalysis.strategicAdvice.map((rule, idx) => (
                  <li key={idx} className="flex items-start space-x-2 text-[11px]">
                    <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Unaffordable Highlights Warning (If any) */}
            {budgetAnalysis.unaffordableHighlights && budgetAnalysis.unaffordableHighlights.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-500/30 text-xs space-y-1 transition-colors">
                <div className="flex items-center space-x-2 text-amber-800 dark:text-amber-400 font-bold">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Capital Filter Notice (Intelligent Risk Filtering):</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 text-[11px]">
                  The AI automatically filtered out the following setups because minimum lot costs exceeded your budget:
                </p>
                <ul className="pl-4 list-disc space-y-0.5 text-amber-800 dark:text-amber-200/80 text-[11px]">
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
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Suggested Position Allocations ({budgetAnalysis.suggestions.length})</span>
              </h3>
              <span className="text-xs text-gray-500 dark:text-gray-400">
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
                    className={`p-5 rounded-2xl bg-white dark:bg-gray-900/80 border transition-all flex flex-col justify-between hover:shadow-md ${
                      isBuy
                        ? 'border-emerald-200 hover:border-emerald-400 dark:border-emerald-500/30 dark:hover:border-emerald-500/60'
                        : isSell
                        ? 'border-rose-200 hover:border-rose-400 dark:border-rose-500/30 dark:hover:border-rose-500/60'
                        : 'border-gray-200 dark:border-gray-800'
                    }`}
                  >
                    <div className="space-y-3.5">
                      {/* Card Header: Symbol & Action */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-gray-900 dark:text-white text-base">{sig.symbol}</span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                              isFno 
                                ? 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-500/40' 
                                : 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-500/40'
                            }`}>
                              {isFno ? 'F&O OPTION' : 'EQUITY'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            Underlying: <strong>{sig.underlying || sig.symbol}</strong>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span
                            className={`px-2.5 py-1 rounded-xl text-xs font-bold shadow-2xs ${
                              isBuy
                                ? 'bg-emerald-600 text-white'
                                : isSell
                                ? 'bg-rose-600 text-white'
                                : 'bg-blue-600 text-white'
                            }`}
                          >
                            {sig.action}
                          </span>
                        </div>
                      </div>

                      {/* Position Sizing Box */}
                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 font-medium">Recommended Size:</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm font-mono">
                            {isFno
                              ? `${item.recommendedLots} Lot${item.recommendedLots > 1 ? 's' : ''} (${item.recommendedQuantity} units)`
                              : `${item.recommendedQuantity} Shares`}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400 font-medium">Capital Required:</span>
                          <span className="font-bold text-gray-900 dark:text-white font-mono">
                            ₹{item.capitalRequired.toLocaleString('en-IN')}{' '}
                            <span className="text-xs text-emerald-600 dark:text-emerald-400 font-normal">
                              ({item.allocationPercentage}% of budget)
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* Trade Target & Stop Levels */}
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-950/60 border border-gray-200 dark:border-gray-800">
                          <span className="text-[10px] text-gray-500 dark:text-gray-400 block">Entry Price</span>
                          <span className="font-bold text-gray-900 dark:text-white font-mono">₹{sig.entryPrice}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-rose-50 dark:bg-gray-950/60 border border-rose-200 dark:border-rose-500/20">
                          <span className="text-[10px] text-rose-700 dark:text-rose-300 block">Stop Loss (Max Risk)</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">
                            ₹{sig.stopLoss}{' '}
                            <span className="text-[10px] font-normal">(-₹{item.maxLoss})</span>
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-gray-950/60 border border-emerald-200 dark:border-emerald-500/20">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block">Target 1</span>
                          <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                            ₹{sig.target1}{' '}
                            <span className="text-[10px] font-normal">(+₹{item.target1Profit})</span>
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-gray-950/60 border border-purple-200 dark:border-purple-500/20">
                          <span className="text-[10px] text-purple-700 dark:text-purple-300 block">Target 2 (Runner)</span>
                          <span className="font-bold text-purple-600 dark:text-purple-400 font-mono">
                            ₹{sig.target2}{' '}
                            <span className="text-[10px] font-normal">(+₹{item.target2Profit})</span>
                          </span>
                        </div>
                      </div>

                      {/* Greek Metrics Badge (if Option) */}
                      {sig.greeks && (
                        <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-gray-50 dark:bg-gray-950/90 border border-emerald-200 dark:border-emerald-500/20 text-center text-[10px]">
                          <div>
                            <span className="text-gray-500 block text-[9px]">Delta Δ</span>
                            <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">{sig.greeks.delta.toFixed(2)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px]">Gamma Γ</span>
                            <span className="font-bold text-blue-600 dark:text-blue-400 font-mono">{sig.greeks.gamma.toFixed(4)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px]">Theta Θ/d</span>
                            <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">-₹{sig.greeks.theta.toFixed(1)}</span>
                          </div>
                          <div>
                            <span className="text-gray-500 block text-[9px]">Θ/Prem</span>
                            <span className="font-bold text-amber-600 dark:text-amber-400 font-mono">{(sig.greeks.thetaPremiumRatio * 100).toFixed(1)}%</span>
                          </div>
                        </div>
                      )}

                      {/* Allocation Rationale */}
                      <div className="p-2.5 rounded-xl bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-500/20 text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
                        {item.allocationReason}
                      </div>
                    </div>

                    {/* Card Actions: 1-Click Execute & Chart */}
                    <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-800/80 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => onOpenChart(sig.symbol)}
                        className="flex items-center space-x-1 px-3 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 hover:text-gray-900 border border-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 dark:hover:text-white dark:border-gray-700 transition-all"
                        title="Inspect on TradingView"
                      >
                        <BarChart2 className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" />
                        <span>Chart</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          onOpenExecuteModal(
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
  );
};

export default AiBudgetAllocatorTab;
