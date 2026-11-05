import React, { useState, useEffect } from 'react';
import { Zap, X, Shield, Clock, Target, CheckCircle2 } from 'lucide-react';
import type { AutoPilotConfig } from '../../services/aiTradingService';

interface AiAutoPilotModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: AutoPilotConfig;
  onSave: (updated: AutoPilotConfig) => void;
}

export const AiAutoPilotModal: React.FC<AiAutoPilotModalProps> = ({
  isOpen,
  onClose,
  config,
  onSave,
}) => {
  const [localConfig, setLocalConfig] = useState<AutoPilotConfig>({
    ...config,
    strategy: config.strategy || 'GREEK_SNIPER',
    profitTargetPct: config.profitTargetPct || 50,
    stopLossPct: config.stopLossPct || 22,
    thetaTimeoutMinutes: config.thetaTimeoutMinutes || 45,
    enforceGoldenHours: config.enforceGoldenHours !== false,
  });

  useEffect(() => {
    setLocalConfig({
      ...config,
      strategy: config.strategy || 'GREEK_SNIPER',
      profitTargetPct: config.profitTargetPct || 50,
      stopLossPct: config.stopLossPct || 22,
      thetaTimeoutMinutes: config.thetaTimeoutMinutes || 45,
      enforceGoldenHours: config.enforceGoldenHours !== false,
    });
  }, [config]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-lg rounded-2xl bg-gray-900 border border-emerald-500/30 shadow-2xl shadow-emerald-500/10 p-6 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30">
              <Zap className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Greek Momentum Sniper</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                  AUTO-PILOT
                </span>
              </h3>
              <p className="text-[11px] text-gray-400">
                Disciplined options scalping with Greek filtering & 45-min theta protection
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4 text-xs">
          {/* Enable Toggle Banner */}
          <div className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${
            localConfig.enabled
              ? 'bg-emerald-950/40 border-emerald-500/40'
              : 'bg-gray-950 border-gray-800'
          }`}>
            <div>
              <div className="font-semibold text-white flex items-center space-x-2">
                <span>Auto-Pilot Execution:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  localConfig.enabled ? 'bg-emerald-500 text-black' : 'bg-gray-800 text-gray-400'
                }`}>
                  {localConfig.enabled ? 'ARMED & ACTIVE' : 'PAUSED'}
                </span>
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {localConfig.enabled
                  ? 'Actively scanning for Greek breakouts and auto-placing qualifying trades'
                  : 'Signals generate suggestions only; no automatic orders placed'}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocalConfig((p) => ({ ...p, enabled: !p.enabled }))}
              className={`w-14 h-7 rounded-full p-1 transition-all ${
                localConfig.enabled ? 'bg-emerald-500' : 'bg-gray-700'
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
            <label className="text-gray-300 font-semibold block mb-1.5">Active Strategy Pipeline:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setLocalConfig((p) => ({ ...p, strategy: 'GREEK_SNIPER' }))}
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.strategy === 'GREEK_SNIPER'
                    ? 'bg-emerald-950/40 border-emerald-500 text-white shadow-sm'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="font-bold flex items-center space-x-1.5 text-emerald-400 mb-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Greek Sniper ⭐</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Δ 0.30–0.50, Top Gamma, Θ/Premium &lt; 0.15, 45m exit
                </p>
              </button>

              <button
                type="button"
                onClick={() => setLocalConfig((p) => ({ ...p, strategy: 'STANDARD' }))}
                className={`p-3 rounded-xl border text-left transition-all ${
                  localConfig.strategy === 'STANDARD'
                    ? 'bg-blue-950/40 border-blue-500 text-white shadow-sm'
                    : 'bg-gray-950 border-gray-800 text-gray-400 hover:border-gray-700'
                }`}
              >
                <div className="font-bold flex items-center space-x-1.5 text-blue-400 mb-1">
                  <Target className="w-3.5 h-3.5" />
                  <span>Standard Scalper</span>
                </div>
                <p className="text-[10px] text-gray-400 leading-relaxed">
                  Basic EMA/VWAP momentum indicators
                </p>
              </button>
            </div>
          </div>

          {/* Execution Mode */}
          <div>
            <label className="text-gray-300 font-semibold block mb-1">Execution Mode:</label>
            <select
              value={localConfig.mode}
              onChange={(e) => setLocalConfig((p) => ({ ...p, mode: e.target.value as any }))}
              className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-medium focus:outline-none focus:border-emerald-500"
            >
              <option value="PAPER">🟢 Paper Simulation (Safe Virtual Capital - Recommended)</option>
              <option value="LIVE">🔴 Live SmartAPI Broker (Real Capital via Angel Broking)</option>
            </select>
          </div>

          {/* Auto-Exit Rules: Target & Stop-Loss */}
          <div className="p-3.5 rounded-xl bg-gray-950/70 border border-gray-800 space-y-3">
            <div className="font-semibold text-gray-300 flex items-center space-x-1.5">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Greek-Based Automated Exit Parameters</span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-gray-400 block mb-1">Profit Target (+%):</label>
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
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-emerald-400 font-bold font-mono focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 font-mono">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Auto market sell at target</span>
              </div>

              <div>
                <label className="text-gray-400 block mb-1">Hard Stop-Loss (-%):</label>
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
                    className="w-full px-3 py-2 rounded-xl bg-gray-900 border border-gray-700 text-rose-400 font-bold font-mono focus:outline-none focus:border-rose-500"
                  />
                  <span className="absolute right-3 top-2 text-gray-500 font-mono">%</span>
                </div>
                <span className="text-[10px] text-gray-500">Strict capital protection</span>
              </div>
            </div>

            {/* Theta Timeout */}
            <div>
              <div className="flex justify-between text-gray-400 mb-1">
                <span className="flex items-center space-x-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>Theta Timeout (Stagnant Position Auto-Exit):</span>
                </span>
                <span className="text-amber-400 font-bold font-mono">{localConfig.thetaTimeoutMinutes} mins</span>
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
          <div className="flex items-center justify-between p-3 rounded-xl bg-gray-950 border border-gray-800">
            <div>
              <div className="font-semibold text-white flex items-center space-x-1.5">
                <span>Golden Hours Filter (IST)</span>
                <span className="px-1.5 py-0.2 rounded text-[9px] bg-emerald-950 text-emerald-400 border border-emerald-800">
                  09:35–11:00 & 13:30–15:00
                </span>
              </div>
              <div className="text-[10px] text-gray-400 mt-0.5">
                Automatically skips 11:30–01:15 lunch chop where theta decay is highest
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLocalConfig((p) => ({ ...p, enforceGoldenHours: !p.enforceGoldenHours }))}
              className={`w-11 h-6 rounded-full p-1 transition-all ${
                localConfig.enforceGoldenHours ? 'bg-emerald-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                  localConfig.enforceGoldenHours ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Quantity & Daily Limits */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 font-semibold block mb-1">Lots per Trade:</label>
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
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-gray-300 font-semibold block mb-1">Max Daily Trades:</label>
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
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {/* Strategy Rules Reference */}
          <div className="p-3 rounded-xl bg-gray-950 border border-gray-800 text-[11px] text-gray-400 space-y-1">
            <div className="font-semibold text-gray-300 flex items-center space-x-1 mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Greek Momentum Sniper Rules Enforced:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              <div>• Strike Premium: ₹25 – ₹75</div>
              <div>• Delta: 0.30 – 0.50 (OTM/ATM)</div>
              <div>• Gamma: Top 3 Candidate Rank</div>
              <div>• Theta/Premium: &lt; 0.15</div>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2 border-t border-gray-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(localConfig);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/30 transition-all flex items-center space-x-1.5"
          >
            <Zap className="w-4 h-4" />
            <span>Apply Sniper Auto-Pilot</span>
          </button>
        </div>
      </div>
    </div>
  );
};
