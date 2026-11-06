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
  Sun,
  BarChart3,
} from 'lucide-react';
import type { AutoPilotConfig, AutoPilotStrategy } from '../../services/aiTradingService';

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
    desc: 'Δ 0.30–0.50, Top Gamma, Θ/Prem < 0.18, 45m exit',
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
    profitTargetPct: config.profitTargetPct || 35,
    stopLossPct: config.stopLossPct || 18,
    thetaTimeoutMinutes: config.thetaTimeoutMinutes || 45,
    enforceGoldenHours: config.enforceGoldenHours !== false,
    maxBudgetPerTrade: config.maxBudgetPerTrade || 0,
  });

  useEffect(() => {
    setLocalConfig({
      ...config,
      strategy: config.strategy || 'GREEK_SNIPER',
      profitTargetPct: config.profitTargetPct || 35,
      stopLossPct: config.stopLossPct || 18,
      thetaTimeoutMinutes: config.thetaTimeoutMinutes || 45,
      enforceGoldenHours: config.enforceGoldenHours !== false,
      maxBudgetPerTrade: config.maxBudgetPerTrade || 0,
    });
    setPricingMode(config.maxBudgetPerTrade && config.maxBudgetPerTrade > 0 ? 'BUDGET_CAP' : 'DYNAMIC');
  }, [config]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-emerald-500/30 shadow-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto transition-colors">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center space-x-2">
                <span>Greek Momentum Sniper</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
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
            className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-1"
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
              <div className="font-semibold text-gray-900 dark:text-white flex items-center space-x-2">
                <span>Auto-Pilot Execution:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  localConfig.enabled ? 'bg-emerald-600 text-white' : 'bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-400'
                }`}>
                  {localConfig.enabled ? 'ARMED & ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <div className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
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

          {/* Strategy Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-gray-700 dark:text-gray-300 font-semibold block">Active Strategy Pipeline:</label>
              <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase">
                {localConfig.strategy.replace('_', ' ')} ACTIVE
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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
                    <div className="flex items-center justify-between mb-1">
                      <div className="font-bold flex items-center space-x-1.5 text-xs text-gray-900 dark:text-white">
                        <IconComponent className={`w-3.5 h-3.5 ${isSelected ? 'text-emerald-500' : 'text-gray-400'}`} />
                        <span>{strat.name}</span>
                      </div>
                      <span className="text-[9px] px-1.5 py-0.2 rounded font-medium bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300">
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
            <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">Execution Mode:</label>
            <select
              value={localConfig.mode}
              onChange={(e) => setLocalConfig((p) => ({ ...p, mode: e.target.value as any }))}
              className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="PAPER">🟢 Paper Simulation (Safe Virtual Capital - Recommended)</option>
              <option value="LIVE">🔴 Live SmartAPI Broker (Real Capital via Angel Broking)</option>
            </select>
          </div>

          {/* Auto-Exit Rules: Target & Stop-Loss */}
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950/70 border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="font-semibold text-gray-800 dark:text-gray-300 flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
              <span>Greek-Based Automated Exit Parameters</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-600 dark:text-gray-400 block mb-1">Profit Target (+%):</label>
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
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-emerald-600 dark:text-emerald-400 font-bold font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-gray-400 font-mono">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Auto market sell at target</span>
              </div>

              <div>
                <label className="text-gray-600 dark:text-gray-400 block mb-1">Hard Stop-Loss (-%):</label>
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
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-rose-600 dark:text-rose-400 font-bold font-mono focus:outline-none focus:border-rose-500"
                  />
                  <span className="absolute right-3 top-2 text-gray-400 font-mono">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Strict capital protection</span>
              </div>
            </div>

            {/* Theta Timeout */}
            <div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400 mb-1">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400" />
                  <span>Theta Timeout (Stagnant Position Auto-Exit):</span>
                </span>
                <span className="text-amber-600 dark:text-amber-400 font-bold font-mono">{localConfig.thetaTimeoutMinutes} mins</span>
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
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800">
            <div>
              <div className="font-semibold text-gray-900 dark:text-white flex items-center space-x-1.5">
                <span>Golden Hours Filter (IST)</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                  09:35–11:00 & 13:30–15:00
                </span>
              </div>
              <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-0.5">
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
          <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-950/70 border border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-gray-800 dark:text-gray-300 flex items-center space-x-1.5">
                <Wallet className="w-4 h-4 text-emerald-500 dark:text-emerald-400" />
                <span>Trade Sizing & Price Mode:</span>
              </div>
              <span className={`font-bold font-mono text-xs px-2 py-0.5 rounded-md ${
                pricingMode === 'DYNAMIC'
                  ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                  : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
              }`}>
                {pricingMode === 'DYNAMIC' ? 'Dynamic (No Fixed Cap)' : `Cap: ₹${(localConfig.maxBudgetPerTrade || 5000).toLocaleString('en-IN')}`}
              </span>
            </div>

            {/* Sizing Mode Tabs */}
            <div className="grid grid-cols-2 gap-2">
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
                  <span>Dynamic Market Sizing</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${pricingMode === 'DYNAMIC' ? 'text-blue-100' : 'text-gray-500'}`}>
                  No fixed price restriction. Buys optimal strike by lots.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPricingMode('BUDGET_CAP')}
                className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-left flex flex-col ${
                  pricingMode === 'BUDGET_CAP'
                    ? 'bg-emerald-600 text-white border-emerald-500 shadow-md shadow-emerald-600/20'
                    : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                }`}
              >
                <div className="flex items-center space-x-1.5">
                  <Wallet className="w-3.5 h-3.5" />
                  <span>Custom Budget Cap</span>
                </div>
                <span className={`text-[10px] mt-0.5 font-normal ${pricingMode === 'BUDGET_CAP' ? 'text-emerald-100' : 'text-gray-500'}`}>
                  Enforce an upper cost ceiling per trade.
                </span>
              </button>
            </div>

            {pricingMode === 'BUDGET_CAP' && (
              <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="500"
                    max="100000"
                    step="500"
                    value={localConfig.maxBudgetPerTrade || 5000}
                    onChange={(e) =>
                      setLocalConfig((p) => ({
                        ...p,
                        maxBudgetPerTrade: Math.max(500, parseInt(e.target.value) || 5000),
                      }))
                    }
                    className="w-full px-3 py-2 rounded-xl bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-mono font-bold focus:outline-none focus:border-emerald-500 text-xs"
                    placeholder="Enter maximum budget in INR"
                  />
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[2500, 5000, 10000, 25000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setLocalConfig((p) => ({ ...p, maxBudgetPerTrade: amt }))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                        (localConfig.maxBudgetPerTrade || 5000) === amt
                          ? 'bg-emerald-600 text-white border-emerald-500 shadow-xs'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-800 hover:border-gray-400'
                      }`}
                    >
                      ₹{amt.toLocaleString('en-IN')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <p className="text-[10px] text-gray-500 leading-relaxed">
              {pricingMode === 'DYNAMIC'
                ? '⭐ Strategy executes automatically based on Greeks & OI without skipping trades over arbitrary price ceilings.'
                : 'Auto-Pilot buys only options where 1-lot premium cost is within your specified cap.'}
            </p>
          </div>

          {/* Quantity & Daily Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">Lots per Trade:</label>
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
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-700 dark:text-gray-300 font-semibold block mb-1">Max Daily Trades:</label>
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
                className="w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Strategy Rules Reference */}
          <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 text-[11px] text-gray-600 dark:text-gray-400 space-y-1">
            <div className="font-semibold text-gray-800 dark:text-gray-300 flex items-center space-x-1 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 dark:text-emerald-400" />
              <span>{localConfig.strategy.replace('_', ' ')} Auto-Pilot Rules:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
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
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-200 dark:border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300 text-xs font-semibold transition-all border border-gray-200 dark:border-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave({
                ...localConfig,
                maxBudgetPerTrade: pricingMode === 'DYNAMIC' ? 0 : localConfig.maxBudgetPerTrade || 5000,
              });
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/30 transition-all flex items-center space-x-1.5"
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
