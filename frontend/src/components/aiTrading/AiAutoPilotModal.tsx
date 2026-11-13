import React, { useState, useEffect } from 'react';
import {
  Zap,
  X,
  Shield,
  Clock,
  Target,
  CheckCircle2,
  Wallet,
  Flame,
  TrendingDown,
  TrendingUp,
  Sun,
  BarChart3,
  AlertTriangle,
  Play,
  RotateCcw,
} from 'lucide-react';
import {
  type AutoPilotConfig,
  type AutoPilotStrategy,
  runStrategyBacktest,
  type BacktestResult,
} from '../../services/aiTradingService';

interface AiAutoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AutoPilotConfig;
  onSave: (updated: AutoPilotConfig) => void;
}

const STRATEGIES: Array<{
  id: AutoPilotStrategy;
  name: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}> = [
  {
    id: 'GREEK_SNIPER',
    name: 'Greek Sniper',
    badge: '⭐ Recommended',
    icon: Zap,
    desc: 'ATM Δ 0.35–0.55, ₹90–₹250 sweet spot, 25% target, 25m exit',
  },
  {
    id: 'GAMMA_BLAST',
    name: 'Expiry Gamma Blast',
    badge: '🚀 1:15–2:45 PM',
    icon: Flame,
    desc: 'Cheap ₹10–₹45 options, afternoon short-covering, 1:3+ payout',
  },
  {
    id: 'VWAP_TRAP',
    name: 'VWAP Fakeout Trap',
    badge: '🪤 Counter-Trend',
    icon: TrendingDown,
    desc: 'Catches failed breakout reversals & institutional traps',
  },
  {
    id: 'ORB_15M',
    name: '15-Min ORB',
    badge: '🌅 09:30–11:00 AM',
    icon: Sun,
    desc: 'Opening range breakout with volume confirmation',
  },
  {
    id: 'PCR_REVERSAL',
    name: 'PCR Reversal',
    badge: '📊 Contrarian',
    icon: BarChart3,
    desc: 'Sentiment extremes (PCR > 1.35 or < 0.70) mean reversion',
  },
  {
    id: 'STANDARD',
    name: 'Standard Scalper',
    badge: 'Classic',
    icon: Target,
    desc: 'EMA & VWAP trend momentum indicator scalper',
  },
  {
    id: 'EMA_9_21',
    name: 'NIFTY 9/21 EMA',
    badge: '📈 EMA Crossover',
    icon: TrendingUp,
    desc: '9/21 EMA crossover on intraday NIFTY 5m candles. BUY on golden cross, SELL on death cross.',
  },
];

export const AiAutoPilotModal: React.FC<AiAutoPilotModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [pricingMode, setPricingMode] = useState<'DYNAMIC' | 'BUDGET_CAP'>(
    config.maxBudgetPerTrade && config.maxBudgetPerTrade > 0 ? 'BUDGET_CAP' : 'DYNAMIC'
  );

  const [localConfig, setLocalConfig] = useState<AutoPilotConfig>({
    ...config,
    strategy: config.strategy || 'GREEK_SNIPER',
    profitTargetPct: config.profitTargetPct || 25,
    stopLossPct: config.stopLossPct || 12,
    thetaTimeoutMinutes: config.thetaTimeoutMinutes || 25,
    enforceGoldenHours: config.enforceGoldenHours !== false,
    maxBudgetPerTrade: config.maxBudgetPerTrade !== undefined && config.maxBudgetPerTrade > 0 ? config.maxBudgetPerTrade : 15000,
    maxDailyLoss: config.maxDailyLoss || 3000,
    maxOpenPositions: config.maxOpenPositions || 3,
    confirmedLiveTrading: config.confirmedLiveTrading || false,
  });

  const [isRunningBacktest, setIsRunningBacktest] = useState(false);
  const [backtestResult, setBacktestResult] = useState<BacktestResult | null>(null);
  const [backtestError, setBacktestError] = useState<string | null>(null);

  const handleRunBacktest = async () => {
    setIsRunningBacktest(true);
    setBacktestError(null);
    setBacktestResult(null);
    try {
      const now = new Date();
      const toDate = now.toISOString().slice(0, 10) + ' 15:30';
      const past = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const fromDate = past.toISOString().slice(0, 10) + ' 09:15';

      const res = await runStrategyBacktest({
        strategy: localConfig.strategy,
        symbol: 'NIFTY',
        token: '99926000',
        exchange: 'NSE',
        fromDate,
        toDate,
        interval: 'FIVE_MINUTE',
        initialCapital: 100000,
        targetPct: localConfig.profitTargetPct,
        stopLossPct: localConfig.stopLossPct,
        lotSize: 25,
      });
      setBacktestResult(res);
    } catch (err: any) {
      setBacktestError(err?.message || 'Failed to complete historical backtest');
    } finally {
      setIsRunningBacktest(false);
    }
  };

  useEffect(() => {
    setLocalConfig({
      ...config,
      strategy: config.strategy || 'GREEK_SNIPER',
      profitTargetPct: config.profitTargetPct || 25,
      stopLossPct: config.stopLossPct || 12,
      thetaTimeoutMinutes: config.thetaTimeoutMinutes || 25,
      enforceGoldenHours: config.enforceGoldenHours !== false,
      maxBudgetPerTrade: config.maxBudgetPerTrade !== undefined && config.maxBudgetPerTrade > 0 ? config.maxBudgetPerTrade : 15000,
      maxDailyLoss: config.maxDailyLoss || 3000,
      maxOpenPositions: config.maxOpenPositions || 3,
      confirmedLiveTrading: config.confirmedLiveTrading || false,
    });
    setPricingMode(config.maxBudgetPerTrade && config.maxBudgetPerTrade > 0 ? 'BUDGET_CAP' : 'BUDGET_CAP');
  }, [config]);

  if (!isOpen) return null;

  return (
    <div className="z-50 fixed inset-0 flex justify-center items-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="space-y-5 bg-white dark:bg-gray-900 shadow-2xl p-6 border border-gray-200 dark:border-emerald-500/30 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto transition-colors">
        {/* Header */}
        <div className="flex justify-between items-center pb-3 border-gray-200 dark:border-gray-800 border-b">
          <div className="flex items-center space-x-2.5">
            <div className="bg-emerald-100 dark:bg-emerald-500/10 p-2 border border-emerald-300 dark:border-emerald-500/30 rounded-xl text-emerald-600 dark:text-emerald-400">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="flex items-center space-x-2 font-bold text-gray-900 dark:text-white text-base">
                <span>Greek Momentum Sniper</span>
                <span className="bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 border border-emerald-200 dark:border-emerald-800 rounded font-bold text-[10px] text-emerald-800 dark:text-emerald-400">
                  AUTO-PILOT
                </span>
              </h3>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Disciplined options scalping with Greek filtering & 45-min theta protection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Enable Toggle Banner */}
          <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
            localConfig.enabled
              ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-950/40 dark:border-emerald-500/40'
              : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800'
          }`}>
            <div>
              <div className="flex items-center space-x-2 font-semibold text-gray-900 dark:text-white">
                <span>Auto-Pilot Execution:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  localConfig.enabled ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                }`}>
                  {localConfig.enabled ? 'ARMED & ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                {localConfig.enabled
                  ? 'Actively scanning for Greek breakouts and auto-placing qualifying trades'
                  : 'Signals generate suggestions only; no automatic orders placed'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocalConfig((p) => ({ ...p, enabled: !p.enabled }))}
              className={`w-14 h-7 rounded-full p-1 transition-all ${
                localConfig.enabled ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full bg-white transition-all transform shadow-md ${
                  localConfig.enabled ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Kill-Switch Tripped Warning & Reset */}
          {localConfig.killSwitchTripped && (
            <div className="flex items-center justify-between p-3.5 rounded-xl border border-rose-300 dark:border-rose-500/50 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200">
              <div className="flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-rose-600 mt-0.5 shrink-0" />
                <div>
                  <div className="font-bold text-xs">Kill-Switch Tripped</div>
                  <div className="text-[11px] text-rose-700 dark:text-rose-300 mt-0.5">
                    {localConfig.killSwitchReason || "Auto-pilot was halted because daily loss exceeded threshold."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLocalConfig((p) => ({ ...p, killSwitchTripped: false, killSwitchReason: undefined, enabled: true }))}
                className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shrink-0 shadow-sm transition-all"
              >
                Reset &amp; Arm
              </button>
            </div>
          )}

          {/* Strategy Selection */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block font-semibold text-gray-700 dark:text-gray-300">Active Strategy Pipeline:</label>
              <span className="font-bold text-[10px] text-emerald-600 dark:text-emerald-400 uppercase">
                {localConfig.strategy.replace('_', ' ')} ACTIVE
              </span>
            </div>
            <div className="gap-2 grid grid-cols-1 sm:grid-cols-2">
              {STRATEGIES.map((strat) => {
                const IconComponent = strat.icon;
                const isSelected = localConfig.strategy === strat.id;
                return (
                  <button
                    key={strat.id}
                    type="button"
                    onClick={() => setLocalConfig((p) => ({ ...p, strategy: strat.id }))}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-500 dark:bg-emerald-950/40 dark:border-emerald-500 text-gray-900 dark:text-white shadow-2xs ring-1 ring-emerald-500/40'
                        : 'bg-gray-50 dark:bg-gray-950 border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-700'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1">
                      <div className="flex items-center space-x-1.5 font-bold text-gray-900 dark:text-white text-xs">
                        <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-500' : 'text-gray-400'}`} />
                        <span>{strat.name}</span>
                      </div>
                      <span className="bg-gray-200 dark:bg-gray-800 px-1.5 py-0.2 rounded font-medium text-[9px] text-gray-700 dark:text-gray-300">
                        {strat.badge}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                      {strat.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Execution Mode */}
          <div>
            <label className="block mb-1 font-semibold text-gray-700 dark:text-gray-300">Execution Mode:</label>
            <select
              value={localConfig.mode}
              onChange={(e) => setLocalConfig((p) => ({ ...p, mode: e.target.value as 'PAPER' | 'LIVE' }))}
              className="bg-gray-50 dark:bg-gray-950 px-3 py-2 border border-gray-300 focus:border-emerald-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-medium text-gray-900 dark:text-white"
            >
              <option value="PAPER">🟢 Paper Trading (Safe Virtual Capital - Recommended)</option>
              <option value="LIVE">🔴 Live Trading (Real Capital via Angel One SmartAPI)</option>
            </select>

            {localConfig.mode === 'LIVE' && (
              <div className="space-y-2 bg-rose-50 dark:bg-rose-950/70 mt-2.5 p-3 border border-rose-300 dark:border-rose-500/60 rounded-xl text-xs animate-in fade-in">
                <div className="flex items-start space-x-2 text-rose-800 dark:text-rose-200">
                  <AlertTriangle className="mt-0.5 w-4 h-4 text-rose-600 shrink-0" />
                  <div>
                    <div className="font-bold text-xs">⚠️ REAL MONEY TRADING SAFETY GATE</div>
                    <p className="mt-0.5 text-[11px] text-rose-700 dark:text-rose-300 leading-relaxed">
                      Live SmartAPI broker orders will place real financial transactions on Angel One with your live trading balance.
                    </p>
                  </div>
                </div>
                <label className="flex items-center space-x-2 pt-1 border-rose-200 dark:border-rose-900 border-t cursor-pointer">
                  <input
                    type="checkbox"
                    checked={localConfig.confirmedLiveTrading === true}
                    onChange={(e) => setLocalConfig((p) => ({ ...p, confirmedLiveTrading: e.target.checked }))}
                    className="rounded focus:ring-rose-500 w-4 h-4 text-rose-600"
                  />
                  <span className="font-semibold text-[11px] text-rose-900 dark:text-rose-100">
                    I confirm that I accept full financial risk and authorize live automated orders.
                  </span>
                </label>
              </div>
            )}
          </div>

          {/* Auto-Exit Rules: Target & Stop-Loss */}
          <div className="space-y-3 bg-gray-50 dark:bg-gray-950/70 p-3.5 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div className="flex items-center space-x-1.5 font-semibold text-gray-800 dark:text-gray-300">
              <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Greek-Based Automated Exit Parameters</span>
            </div>

            <div className="gap-3 grid grid-cols-2">
              <div>
                <label className="block mb-1 text-gray-600 dark:text-gray-400">Profit Target (+%):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="30"
                    max="100"
                    step="5"
                    value={localConfig.profitTargetPct}
                    onChange={(e) =>
                      setLocalConfig((p) => ({
                        ...p,
                        profitTargetPct: Math.max(20, parseInt(e.target.value) || 50),
                      }))
                    }
                    className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-300 focus:border-emerald-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono font-bold text-emerald-600 dark:text-emerald-400"
                  />
                  <span className="top-2 right-3 absolute font-mono text-gray-400">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Auto market sell at target</span>
              </div>

              <div>
                <label className="block mb-1 text-gray-600 dark:text-gray-400">Hard Stop-Loss (-%):</label>
                <div className="relative">
                  <input
                    type="number"
                    min="15"
                    max="40"
                    step="1"
                    value={localConfig.stopLossPct}
                    onChange={(e) =>
                      setLocalConfig((p) => ({
                        ...p,
                        stopLossPct: Math.max(10, parseInt(e.target.value) || 22),
                      }))
                    }
                    className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-300 focus:border-rose-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono font-bold text-rose-600 dark:text-rose-400"
                  />
                  <span className="top-2 right-3 absolute font-mono text-gray-400">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Strict capital protection</span>
              </div>
            </div>

            {/* Theta Timeout */}
            <div>
              <div className="flex justify-between mb-1 text-gray-600 dark:text-gray-400">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Theta Timeout (Stagnant Position Auto-Exit):</span>
                </span>
                <span className="font-mono font-bold text-amber-600 dark:text-amber-400">{localConfig.thetaTimeoutMinutes} mins</span>
              </div>
              <input
                type="range"
                min="20"
                max="90"
                step="5"
                value={localConfig.thetaTimeoutMinutes}
                onChange={(e) =>
                  setLocalConfig((p) => ({
                    ...p,
                    thetaTimeoutMinutes: parseInt(e.target.value) || 45,
                  }))
                }
                className="w-full accent-amber-500"
              />
              <div className="text-[10px] text-gray-500">
                If position is held &gt; {localConfig.thetaTimeoutMinutes}m with zero momentum, auto-exits to eliminate time decay.
              </div>
            </div>
          </div>

          {/* Golden Hours Enforcement */}
          <div className="flex justify-between items-center bg-gray-50 dark:bg-gray-950 p-3 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div>
              <div className="flex items-center space-x-1.5 font-semibold text-gray-900 dark:text-white">
                <span>Golden Hours Filter (IST)</span>
                <span className="bg-emerald-100 dark:bg-emerald-950 px-1.5 py-0.2 border border-emerald-200 dark:border-emerald-800 rounded text-[9px] text-emerald-800 dark:text-emerald-400">
                  09:35–11:00 & 13:30–15:00
                </span>
              </div>
              <div className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
                Automatically skips 11:30–01:15 lunch chop where theta decay is highest
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocalConfig((p) => ({ ...p, enforceGoldenHours: !p.enforceGoldenHours }))}
              className={`w-11 h-6 rounded-full p-1 transition-all ${
                localConfig.enforceGoldenHours ? 'bg-emerald-600' : 'bg-gray-300 dark:bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-all transform shadow-xs ${
                  localConfig.enforceGoldenHours ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Sizing & Budget Policy */}
          {/* Sizing & Budget Policy */}
          <div className="space-y-3 bg-gray-50 dark:bg-gray-950/70 p-3.5 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-1.5 font-semibold text-gray-800 dark:text-gray-300">
                <Wallet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Trade Sizing & Investment Slab:</span>
              </div>
              <span className={`font-bold font-mono text-xs px-2.5 py-0.5 rounded-md ${
                pricingMode === 'DYNAMIC'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {pricingMode === 'DYNAMIC' ? 'Dynamic Lots (No Cap)' : `Slab: ₹${(localConfig.maxBudgetPerTrade || 5000).toLocaleString('en-IN')}`}
              </span>
            </div>

            {/* Sizing Mode Tabs */}
            <div className="gap-2 grid grid-cols-2">
              <button
                type="button"
                onClick={() => {
                  setPricingMode('BUDGET_CAP');
                  if (!localConfig.maxBudgetPerTrade || localConfig.maxBudgetPerTrade === 0) {
                    setLocalConfig((p) => ({ ...p, maxBudgetPerTrade: 5000 }));
                  }
                }}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col ${
                  pricingMode === 'BUDGET_CAP'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Investment Slab (Cap)</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${pricingMode === 'BUDGET_CAP' ? 'text-emerald-100' : 'text-gray-500'}`}>
                  Limit risk: e.g. ₹5,000, ₹10,000, or manual slab.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPricingMode('DYNAMIC')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col ${
                  pricingMode === 'DYNAMIC'
                    ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/20'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-300" />
                  <span>Dynamic Market Lots</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${pricingMode === 'DYNAMIC' ? 'text-blue-100' : 'text-gray-500'}`}>
                  No price ceiling. Buys standard lot at market price.
                </span>
              </button>
            </div>

            {pricingMode === 'BUDGET_CAP' && (
              <div className="space-y-3 pt-1 animate-in duration-150 fade-in bg-white dark:bg-gray-900 p-3 rounded-xl border border-emerald-500/20">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Manual Investment Slab Amount (INR):
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold font-mono text-xs text-gray-400">₹</span>
                    <input
                      type="number"
                      min="500"
                      max="500000"
                      step="500"
                      value={localConfig.maxBudgetPerTrade || ''}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setLocalConfig((p) => ({
                          ...p,
                          maxBudgetPerTrade: isNaN(val) ? 0 : Math.max(0, val),
                        }));
                      }}
                      className="bg-gray-50 dark:bg-gray-950 pl-7 pr-3 py-2 border border-gray-300 focus:border-emerald-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono font-bold text-gray-900 dark:text-white text-xs"
                      placeholder="Type manual amount (e.g. 5000, 10000)"
                    />
                  </div>
                </div>

                <div>
                  <span className="block text-[10px] font-medium text-gray-500 dark:text-gray-400 mb-1.5">
                    Quick Preset Slabs:
                  </span>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {[2500, 5000, 10000, 25000, 50000].map((amt) => {
                      const isSelected = localConfig.maxBudgetPerTrade === amt;
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setLocalConfig((p) => ({ ...p, maxBudgetPerTrade: amt }))}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold font-mono border transition-all ${
                            isSelected
                              ? 'bg-emerald-600 text-white border-emerald-500 shadow-sm'
                              : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-emerald-500'
                          }`}
                        >
                          ₹{amt.toLocaleString('en-IN')}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="p-2.5 rounded-lg bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/40 text-[11px] text-emerald-800 dark:text-emerald-300 leading-relaxed">
                  💡 <strong>Slab Rule:</strong> Auto-Pilot sizes orders up to <strong>₹{(localConfig.maxBudgetPerTrade || 5000).toLocaleString('en-IN')}</strong> per trade. If 1 lot of an option exceeds this slab, the trade is safely skipped and logged.
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-500 leading-relaxed">
              {pricingMode === 'DYNAMIC'
                ? '⭐ Strategy executes automatically based on Greeks & OI without skipping trades over arbitrary price ceilings.'
                : 'Auto-Pilot enforces strict capital allocation, ensuring no single trade uses more than your specified slab.'}
            </p>
          </div>

          {/* Quantity & Daily Limits */}
          <div className="gap-3 grid grid-cols-2">
            <div>
              <label className="block mb-1 font-semibold text-gray-700 dark:text-gray-300">Lots per Trade:</label>
              <input
                type="number"
                min="1"
                max="10"
                value={localConfig.defaultQuantity}
                onChange={(e) =>
                  setLocalConfig((p) => ({
                    ...p,
                    defaultQuantity: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="bg-gray-50 dark:bg-gray-950 px-3 py-2 border border-gray-300 focus:border-emerald-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block mb-1 font-semibold text-gray-700 dark:text-gray-300">Max Daily Trades:</label>
              <input
                type="number"
                min="1"
                max="15"
                value={localConfig.maxDailyTrades}
                onChange={(e) =>
                  setLocalConfig((p) => ({
                    ...p,
                    maxDailyTrades: Math.max(1, parseInt(e.target.value) || 5),
                  }))
                }
                className="bg-gray-50 dark:bg-gray-950 px-3 py-2 border border-gray-300 focus:border-emerald-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* Global Risk Management Safeguards */}
          <div className="space-y-3 bg-gray-50 dark:bg-gray-950/70 p-3.5 border border-gray-200 dark:border-gray-800 rounded-xl">
            <div className="flex items-center space-x-1.5 font-semibold text-gray-800 dark:text-gray-300">
              <Shield className="w-4 h-4 text-rose-500" />
              <span>Global Risk Safeguards & Kill Switches</span>
            </div>

            <div className="gap-3 grid grid-cols-2">
              <div>
                <label className="block mb-1 text-gray-600 dark:text-gray-400">Daily Loss Kill-Switch (₹):</label>
                <input
                  type="number"
                  min="1000"
                  max="100000"
                  step="500"
                  value={localConfig.maxDailyLoss || 5000}
                  onChange={(e) =>
                    setLocalConfig((p) => ({
                      ...p,
                      maxDailyLoss: Math.max(500, parseInt(e.target.value) || 5000),
                    }))
                  }
                  className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-300 focus:border-rose-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono font-bold text-rose-600 dark:text-rose-400 text-xs"
                />
                <span className="text-[10px] text-gray-500">Auto-halts bot if loss breaches limit</span>
              </div>

              <div>
                <label className="block mb-1 text-gray-600 dark:text-gray-400">Max Open Positions Cap:</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={localConfig.maxOpenPositions || 3}
                  onChange={(e) =>
                    setLocalConfig((p) => ({
                      ...p,
                      maxOpenPositions: Math.max(1, parseInt(e.target.value) || 3),
                    }))
                  }
                  className="bg-white dark:bg-gray-900 px-3 py-2 border border-gray-300 focus:border-emerald-500 dark:border-gray-700 rounded-xl focus:outline-none w-full font-mono font-bold text-gray-900 dark:text-white text-xs"
                />
                <span className="text-[10px] text-gray-500">Max concurrent open trades</span>
              </div>
            </div>
          </div>

          {/* Strategy Rules Reference */}
          <div className="space-y-1 bg-gray-50 dark:bg-gray-950 p-3 border border-gray-200 dark:border-gray-800 rounded-xl text-[11px] text-gray-600 dark:text-gray-400">
            <div className="flex items-center space-x-1 mb-1 font-semibold text-gray-800 dark:text-gray-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>{localConfig.strategy.replace('_', ' ')} Auto-Pilot Rules:</span>
            </div>
            <div className="gap-1 grid grid-cols-2 text-[10px]">
              {localConfig.strategy === 'GAMMA_BLAST' && (
                <>
                  <div>• Time Window: 01:15 – 02:45 PM</div>
                  <div>• Strike Premium: ₹10 – ₹55</div>
                  <div>• Target: +75% to +100% (1:3+ Payout)</div>
                  <div>• Stop-Loss: -30% (Strict capital cap)</div>
                </>
              )}
              {localConfig.strategy === 'VWAP_TRAP' && (
                <>
                  <div>• Trigger: Day High/Low Fakeout Trap</div>
                  <div>• Filter: Counter-Trend VWAP Reclaim</div>
                  <div>• Target: +40% (Reversal Swing)</div>
                  <div>• Stop-Loss: -18% (Swing high/low)</div>
                </>
              )}
              {localConfig.strategy === 'ORB_15M' && (
                <>
                  <div>• Time Window: 09:30 – 11:00 AM</div>
                  <div>• Trigger: 15m High/Low Breakout</div>
                  <div>• Volume: &gt; 1.2x 20-SMA Volume</div>
                  <div>• Auto-Exit: 11:00 AM before lunch</div>
                </>
              )}
              {localConfig.strategy === 'PCR_REVERSAL' && (
                <>
                  <div>• Trigger: PCR &gt; 1.35 (PE) or &lt; 0.70 (CE)</div>
                  <div>• Filter: RSI Overbought/Oversold</div>
                  <div>• Target: +35% (Mean Reversion)</div>
                  <div>• Stop-Loss: -15% (Tight Risk)</div>
                </>
              )}
              {localConfig.strategy === 'GREEK_SNIPER' && (
                <>
                  <div>• Strike Premium: Affordable &le; Budget</div>
                  <div>• Delta: 0.30 – 0.50 (OTM/ATM)</div>
                  <div>• Gamma: Top Rank Sensitivity</div>
                  <div>• Theta/Premium: &lt; 0.18 (45m Timeout)</div>
                </>
              )}
              {localConfig.strategy === 'STANDARD' && (
                <>
                  <div>• Indicators: 9/21 EMA + VWAP Trend</div>
                  <div>• Target: +30%</div>
                  <div>• Stop-Loss: -18%</div>
                  <div>• Quantity: Configured Lots</div>
                </>
              )}
              {localConfig.strategy === 'EMA_9_21' && (
                <>
                  <div>• Indicators: EMA 9 / EMA 21 Crossover</div>
                  <div>• Underlying: NIFTY (Intraday 5m)</div>
                  <div>• Buy: EMA9 &gt; EMA21 &amp; Price &gt; EMA9</div>
                  <div>• Sell: EMA9 &lt; EMA21 &amp; Price &lt; EMA9</div>
                  <div>• Target: +25% | Stop-Loss: -12%</div>
                  <div>• Auto-Exit: 90 min theta timeout</div>
                </>
              )}
            </div>
          </div>

          {/* Pre-Arming Strategy Historical Backtest with Realistic Indian Fees */}
          <div className="space-y-2.5 bg-purple-50/60 dark:bg-purple-950/20 p-3.5 border border-purple-200 dark:border-purple-800/60 rounded-xl transition-colors">
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-1.5 font-semibold text-gray-800 dark:text-gray-200 text-xs">
                <BarChart3 className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Pre-Arming Backtest ({localConfig.strategy.replace('_', ' ')})</span>
              </div>
              <button
                type="button"
                onClick={handleRunBacktest}
                disabled={isRunningBacktest}
                className="flex items-center space-x-1 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 shadow-xs px-3 py-1.5 rounded-lg font-bold text-white text-xs transition-all"
              >
                {isRunningBacktest ? (
                  <>
                    <RotateCcw className="w-3.5 h-3.5 animate-spin" />
                    <span>Testing...</span>
                  </>
                ) : (
                  <>
                    <Play className="fill-current w-3.5 h-3.5" />
                    <span>Run Backtest</span>
                  </>
                )}
              </button>
            </div>
            <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
              Simulates over historical 5m candles with realistic Indian costs (₹20/order brokerage, STT 0.1%, GST 18%, exchange fees, and 0.15% slippage).
            </p>

            {backtestError && (
              <div className="bg-rose-50 dark:bg-rose-950/50 p-2 border border-rose-200 dark:border-rose-900 rounded-lg text-[11px] text-rose-700 dark:text-rose-300">
                {backtestError}
              </div>
            )}

            {backtestResult && (
              <div className="space-y-2 bg-white dark:bg-gray-900 p-2.5 border border-purple-200 dark:border-purple-800/80 rounded-xl text-xs animate-in fade-in">
                <div className="gap-2 grid grid-cols-3 text-center">
                  <div className="bg-gray-50 dark:bg-gray-950 p-1.5 rounded-lg">
                    <span className="block text-[10px] text-gray-500">Win Rate</span>
                    <span className={`font-bold font-mono text-xs ${backtestResult.winRate >= 50 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {backtestResult.winRate}% ({backtestResult.winningTrades}/{backtestResult.totalTrades})
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-950 p-1.5 rounded-lg">
                    <span className="block text-[10px] text-gray-500">Net P&L (After Costs)</span>
                    <span className={`font-bold font-mono text-xs ${backtestResult.netPnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {backtestResult.netPnl >= 0 ? '+' : ''}₹{backtestResult.netPnl.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="bg-gray-50 dark:bg-gray-950 p-1.5 rounded-lg">
                    <span className="block text-[10px] text-gray-500">Max Drawdown</span>
                    <span className="font-mono font-bold text-rose-500 text-xs">
                      -{backtestResult.maxDrawdownPercent}%
                    </span>
                  </div>
                </div>

                <div className="flex justify-between items-center px-1 pt-1.5 border-gray-100 dark:border-gray-800 border-t text-[10px] text-gray-500 dark:text-gray-400">
                  <span>Gross: ₹{backtestResult.grossPnl}</span>
                  <span>Taxes &amp; Slippage: ₹{(backtestResult.totalTaxesAndCharges + backtestResult.totalSlippage).toFixed(1)}</span>
                  <span>Profit Factor: {backtestResult.profitFactor}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end items-center space-x-3 pt-2 border-gray-200 dark:border-gray-800 border-t">
          <button
            type="button"
            onClick={onClose}
            className="bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-gray-700 dark:text-gray-300 text-xs transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={localConfig.mode === 'LIVE' && !localConfig.confirmedLiveTrading}
            onClick={() => {
              if (localConfig.mode === 'LIVE' && !localConfig.confirmedLiveTrading) {
                alert('Please check the safety confirmation box before enabling LIVE trading.');
                return;
              }
              onSave({
                ...localConfig,
                maxBudgetPerTrade: pricingMode === 'DYNAMIC' ? 0 : localConfig.maxBudgetPerTrade || 5000,
              });
              onClose();
            }}
            className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 shadow-emerald-600/30 shadow-md px-5 py-2.5 rounded-xl font-bold text-white text-xs transition-all disabled:cursor-not-allowed"
          >
            <Zap className="w-4 h-4" />
            <span>Apply Sniper Auto-Pilot</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default AiAutoPilotModal;
