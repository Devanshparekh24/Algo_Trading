import React, { useState, useCallback } from 'react';
import { Scan, Search, RefreshCw, ShieldAlert, Monitor } from 'lucide-react';
import { scanOptionChain, type ScanOptionChainParams, type OptionChainScanResult, type TradeSignal } from '../../services/aiTradingService';

export interface AiOptionChainScannerTabProps {
  onOpenExecuteModal?: (signal: TradeSignal) => void;
}

export const AiOptionChainScannerTab: React.FC<AiOptionChainScannerTabProps> = ({
  onOpenExecuteModal,
}) => {
  const [underlying, setUnderlying] = useState('NIFTY');
  const [expiry, setExpiry] = useState<string>('');
  const [strikeCount, setStrikeCount] = useState(8);
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<OptionChainScanResult | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const underlyings = ['NIFTY', 'BANKNIFTY', 'FINNIFTY', 'MIDCPNIFTY'];

  const handleScan = useCallback(async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const params: ScanOptionChainParams = { underlying, strikeCount };
      if (expiry) params.expiry = expiry;
      const result = await scanOptionChain(params);
      setScanResult(result);
    } catch (err: any) {
      setScanError(err?.message || 'Failed to scan option chain');
    } finally {
      setIsScanning(false);
    }
  }, [underlying, expiry, strikeCount]);

  const actionColor = (action: string) => {
    if (action === 'BUY') return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
    if (action === 'SELL') return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
    return 'text-gray-400 border-gray-700/30 bg-gray-800/30';
  };
  const pcrSentimentColor = (sentiment: string) => {
    if (sentiment === 'BULLISH') return 'text-emerald-400';
    if (sentiment === 'BEARISH') return 'text-rose-400';
    return 'text-amber-400';
  };

  return (
    <div className="space-y-4">
      {/* Scan Controls */}
      <div className="bg-gray-950 rounded-2xl border border-gray-800 p-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div className="flex items-center space-x-2">
            <Scan className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-bold text-white">Option Chain Scanner</h3>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-800 text-gray-400 border border-gray-700">
              Live Signals
            </span>
          </div>
          <div className="flex items-center space-x-3 w-full sm:w-auto">
            <select
              value={underlying}
              onChange={(e) => setUnderlying(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {underlyings.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Expiry (e.g. 30JUL26)"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 w-32"
            />
            <select
              value={strikeCount}
              onChange={(e) => setStrikeCount(Number(e.target.value))}
              className="bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[4, 6, 8, 10, 12].map((n) => (
                <option key={n} value={n}>{n} strikes each side</option>
              ))}
            </select>
            <button
              onClick={handleScan}
              disabled={isScanning}
              className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 ${
                isScanning ? 'bg-gray-700 text-gray-400' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/30'
              }`}
            >
              {isScanning ? (
                <><RefreshCw className="w-4 h-4 animate-spin" /> Scanning...</>
              ) : (
                <><Search className="w-4 h-4" /> Scan Option Chain</>
              )}
            </button>
          </div>
        </div>

        {scanError && (
          <div className="mt-3 p-3 rounded-lg bg-rose-900/30 border border-rose-500/40 text-rose-300 text-sm">
            <ShieldAlert className="w-4 h-4 mr-2" /> {scanError}
          </div>
        )}
      </div>
      {/* Summary Cards */}
      {scanResult && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Underlying</div>
            <div className="text-xl font-mono font-bold text-white">{scanResult.underlying}</div>
          </div>
          <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Spot Price</div>
            <div className="text-xl font-mono font-bold text-emerald-400">₹{scanResult.spotPrice.toLocaleString()}</div>
          </div>
          <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">PCR</div>
            <div className={`text-xl font-mono font-bold ${pcrSentimentColor(scanResult.pcrSentiment)}`}>
              {scanResult.pcr.toFixed(2)}
            </div>
            <div className="text-xs mt-1 text-gray-500">{scanResult.pcrSentiment}</div>
          </div>
          <div className="bg-gray-950 rounded-xl border border-gray-800 p-4">
            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Max Pain</div>
            <div className="text-xl font-mono font-bold text-amber-400">₹{scanResult.maxPainStrike.toLocaleString()}</div>
          </div>
        </div>
      )}


      {/* Signals List */}
      {scanResult && scanResult.signals.length > 0 ? (
        <div className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden">
          <div className="bg-gray-900/50 border-b border-gray-800 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Scan className="w-4 h-4 text-amber-400" />
              <h4 className="font-bold text-sm text-white">Scanned Option Signals</h4>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-800 text-blue-400 border border-gray-600">
                {scanResult.signals.length} contracts
              </span>
            </div>
            <p className="text-xs text-gray-500">Ranked by actionability & confidence</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-900/50 border-b border-gray-800">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Strike</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Type</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Action</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">Confidence</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">LTP</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">% Chg</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">SL</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">T1</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">T2</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase">OI</th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-400 uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {scanResult.signals.map((sig) => (
                  <tr key={sig.id} className="hover:bg-gray-900/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-300">{sig.strike}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${
                        sig.contractType === 'CE'
                          ? 'bg-blue-900/30 text-blue-400 border border-blue-500/30'
                          : 'bg-rose-900/30 text-rose-400 border border-rose-500/30'
                      }`}>
                        {sig.contractType}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-bold ${actionColor(sig.action)}`}>
                        {sig.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-300">
                      <div className="w-full bg-gray-800 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full"
                          style={{ width: `${Math.min(sig.confidence, 100)}%` }}
                        />
                      </div>
                      <span className="text-[10px]">{sig.confidence}%</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-emerald-300">₹{sig.currentPrice.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono">
                      <span className={`text-xs font-bold ${sig.percentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {sig.percentChange >= 0 ? '+' : ''}{sig.percentChange.toFixed(2)}%
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-400">₹{sig.stopLoss.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300">₹{sig.target1.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-emerald-300">₹{sig.target2.toLocaleString()}</td>
                    <td className="px-4 py-3 font-mono text-gray-400">
                      {(sig.openInterest || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onOpenExecuteModal?.(sig)}
                        className="px-3 py-1.5 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-500 transition-colors"
                      >
                        Execute
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        scanResult && scanResult.signals.length === 0 && (
          <div className="bg-gray-950 rounded-2xl border border-gray-800 p-12 text-center">
            <Monitor className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <h4 className="text-lg font-bold text-gray-300 mb-2">No Actionable Signals</h4>
            <p className="text-gray-500 text-sm">
              Scan found no CE/PE contracts meeting BUY/SELL criteria for {scanResult?.underlying}.
            </p>
          </div>
        )
      )}
    </div>
  );
};

export default AiOptionChainScannerTab;

