import React, { useState, useEffect } from 'react';
import { Sliders, X } from 'lucide-react';
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
  const [localConfig, setLocalConfig] = useState<AutoPilotConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
      <div className="w-full max-w-md rounded-2xl bg-gray-900 border border-gray-700 shadow-2xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-800">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">AI Auto-Pilot Controls</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
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
              type="button"
              onClick={() => setLocalConfig((p) => ({ ...p, enabled: !p.enabled }))}
              className={`w-12 h-6 rounded-full p-1 transition-all ${
                localConfig.enabled ? 'bg-emerald-600' : 'bg-gray-700'
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full bg-white transition-all transform ${
                  localConfig.enabled ? 'translate-x-6' : 'translate-x-0'
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
              value={localConfig.mode}
              onChange={(e) => setLocalConfig((p) => ({ ...p, mode: e.target.value as any }))}
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
              <span className="text-blue-400 font-bold font-mono">{localConfig.minConfidence}%</span>
            </div>
            <input
              type="range"
              min="60"
              max="95"
              step="5"
              value={localConfig.minConfidence}
              onChange={(e) =>
                setLocalConfig((p) => ({ ...p, minConfidence: parseInt(e.target.value) || 75 }))
              }
              className="w-full accent-blue-500"
            />
          </div>

          {/* Quantity and Max Daily Trades */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-gray-300 font-semibold block mb-1">Default Quantity:</label>
              <input
                type="number"
                min="1"
                value={localConfig.defaultQuantity}
                onChange={(e) =>
                  setLocalConfig((p) => ({
                    ...p,
                    defaultQuantity: Math.max(1, parseInt(e.target.value) || 1),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="text-gray-300 font-semibold block mb-1">Max Daily Trades:</label>
              <input
                type="number"
                min="1"
                max="20"
                value={localConfig.maxDailyTrades}
                onChange={(e) =>
                  setLocalConfig((p) => ({
                    ...p,
                    maxDailyTrades: Math.max(1, parseInt(e.target.value) || 5),
                  }))
                }
                className="w-full px-3 py-2 rounded-xl bg-gray-950 border border-gray-700 text-white font-mono focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end space-x-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition-all"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => {
              onSave(localConfig);
              onClose();
            }}
            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
};
