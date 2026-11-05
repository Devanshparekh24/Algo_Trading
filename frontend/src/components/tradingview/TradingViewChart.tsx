import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
import { Maximize2, Minimize2, BarChart2, ExternalLink, Search, X } from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface TradingViewChartProps {
  symbol?: string; // e.g. "NSE:RELIANCE", "RELIANCE-EQ", "NSE:NIFTYBEES", "Nifty 50"
  exchange?: string; // "NSE" | "BSE"
  interval?: '1' | '5' | '15' | '30' | '60' | 'D' | 'W';
  theme?: 'dark' | 'light';
  height?: number | string;
  allowSymbolChange?: boolean;
  enableStudies?: boolean;
  showToolbar?: boolean;
  className?: string;
  livePrice?: number;
  liveNetChange?: number;
  livePercentChange?: number;
  underlyingPrice?: number;
  underlyingPercentChange?: number;
  onSymbolChange?: (newSymbol: string) => void;
}

export interface ResolvedSymbolInfo {
  tradingViewSymbol: string;
  isIndexMapped: boolean;
  isDerivativeMapped?: boolean;
  displayName: string;
  underlying?: string;
  contractType?: string;
  strike?: string;
  expiry?: string;
  rawIndexLink: string;
  mappedReason?: string;
}

/**
 * Resolves symbols for TradingView's free embed widget:
 * - Spot indices (e.g. NIFTY 50, BANKNIFTY) are restricted in external embeds by NSE licensing,
 *   so they are mapped to tick-by-tick mirror ETFs (NSE:NIFTYBEES & NSE:BANKBEES).
 * - Option contracts map to their chartable underlying asset.
 * - Cash equities (RELIANCE, TCS, etc.) chart directly as NSE:SYMBOL.
 */
export function resolveTradingViewSymbolInfo(symbol: string, exchange = 'NSE'): ResolvedSymbolInfo {
  if (!symbol) {
    return {
      tradingViewSymbol: 'NSE:NIFTYBEES',
      isIndexMapped: true,
      displayName: 'NIFTY 50',
      underlying: 'NIFTY 50',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY',
      mappedReason: 'NSE index restricted in external widgets. Showing benchmark ETF (NIFTYBEES).',
    };
  }

  let clean = symbol.trim().toUpperCase();
  let exg = exchange.toUpperCase();

  if (clean.includes(':')) {
    const parts = clean.split(':');
    exg = parts[0] || 'NSE';
    clean = parts[1] || '';
  }

  // Strip broker suffixes like -EQ, -BE, -BL
  clean = clean.replace(/-EQ$/, '').replace(/-BE$/, '').replace(/-BL$/, '').trim();

  // 1. Detect Option contracts (e.g. NIFTY01DEC2624900CE or NIFTY 25000 PE)
  const optMatch =
    clean.match(/^([A-Z]+?)(\d{2})([A-Z]{3}|\d{2})(\d+)(CE|PE)$/) ||
    clean.match(/^([A-Z\-]+)\s+(\d+(?:\.\d+)?)\s*(CE|PE)$/i);

  if (optMatch) {
    const under = optMatch[1] || 'NIFTY';
    const optType = (optMatch[5] || optMatch[3] || 'CE').toUpperCase();
    const strike = optMatch[4] || optMatch[2] || '';

    let tvSym = `NSE:${under}`;
    let mappedUnder = under;
    const norm = under.replace(/[^A-Z]/g, '');

    if (norm === 'NIFTY' || norm.startsWith('NIFTY50')) {
      tvSym = 'NSE:NIFTYBEES';
      mappedUnder = 'NIFTY 50';
    } else if (norm.startsWith('BANKNIFTY')) {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
    } else if (norm.startsWith('FINNIFTY')) {
      tvSym = 'NSE:HDFCBANK';
      mappedUnder = 'FIN NIFTY';
    } else if (norm.startsWith('MIDCPNIFTY')) {
      tvSym = 'NSE:MID150BEES';
      mappedUnder = 'MIDCAP NIFTY';
    }

    return {
      tradingViewSymbol: tvSym,
      isIndexMapped: true,
      isDerivativeMapped: true,
      displayName: `${clean}`,
      underlying: mappedUnder,
      contractType: optType,
      strike,
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      mappedReason: `Option strike charted via underlying asset (${mappedUnder}).`,
    };
  }

  // 2. Direct Index mapping
  const norm = clean.replace(/[^A-Z]/g, '');
  if (norm === 'NIFTY' || norm === 'NIFTY50' || norm === 'CNXNIFTY') {
    return {
      tradingViewSymbol: 'NSE:NIFTYBEES',
      isIndexMapped: true,
      displayName: 'NIFTY 50',
      underlying: 'NIFTY 50',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY',
    };
  }
  if (norm.startsWith('BANKNIFTY') || norm === 'NIFTYBANK') {
    return {
      tradingViewSymbol: 'NSE:BANKBEES',
      isIndexMapped: true,
      displayName: 'BANK NIFTY',
      underlying: 'BANK NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ABANKNIFTY',
    };
  }
  if (norm.startsWith('FINNIFTY')) {
    return {
      tradingViewSymbol: 'NSE:HDFCBANK',
      isIndexMapped: true,
      displayName: 'FIN NIFTY',
      underlying: 'FIN NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3AFINNIFTY',
    };
  }

  // 3. Standard Cash Equities
  return {
    tradingViewSymbol: `${exg}:${clean}`,
    isIndexMapped: false,
    isDerivativeMapped: false,
    displayName: `${exg}:${clean}`,
    underlying: clean,
    rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`${exg}:${clean}`)}`,
  };
}

export const TradingViewChart: React.FC<TradingViewChartProps> = memo(({
  symbol = 'NSE:RELIANCE',
  exchange = 'NSE',
  interval = '15',
  theme = 'dark',
  height = 540,
  allowSymbolChange = true,
  enableStudies = true,
  className = '',
  livePrice,
  liveNetChange,
  livePercentChange,
  underlyingPrice,
  underlyingPercentChange,
  onSymbolChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    setCurrentSymbol(symbol);
  }, [symbol]);

  const symbolInfo = useMemo(
    () => resolveTradingViewSymbolInfo(currentSymbol, exchange),
    [currentSymbol, exchange]
  );

  const activeTvSymbol = symbolInfo.tradingViewSymbol;

  const handleSelectNewSymbol = (sym: string) => {
    setCurrentSymbol(sym);
    setIsSearchOpen(false);
    setSearchInput('');
    if (onSymbolChange) {
      onSymbolChange(sym);
    }
  };

  const handleCustomSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchInput.trim()) return;
    let s = searchInput.trim().toUpperCase();
    if (!s.includes(':')) {
      s = `NSE:${s}`;
    }
    handleSelectNewSymbol(s);
  };

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = '';

    const widgetDiv = document.createElement('div');
    widgetDiv.className = 'tradingview-widget-container__widget';
    widgetDiv.style.height = '100%';
    widgetDiv.style.width = '100%';
    containerRef.current.appendChild(widgetDiv);

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    const intervalMap: Record<string, string> = {
      '1': '1',
      '5': '5',
      '15': '15',
      '30': '30',
      '60': '60',
      D: 'D',
      W: 'W',
    };

    const config = {
      autosize: true,
      symbol: activeTvSymbol,
      interval: intervalMap[interval] || '15',
      timezone: 'Asia/Kolkata',
      theme: theme === 'dark' ? 'dark' : 'light',
      style: '1',
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: false,
      hide_legend: false,
      save_image: true,
      calendar: false,
      studies: enableStudies
        ? [
            'STD;RSI',
            'STD;MACD',
            'STD;EMA@tv-basicstudies',
            'STD;Bollinger_Bands',
          ]
        : [],
      support_host: 'https://www.tradingview.com',
    };

    script.innerHTML = JSON.stringify(config);
    containerRef.current.appendChild(script);

    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [activeTvSymbol, interval, theme, enableStudies]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const popularSymbols = [
    { label: 'Nifty 50', sym: 'NSE:NIFTYBEES' },
    { label: 'Bank Nifty', sym: 'NSE:BANKBEES' },
    { label: 'Reliance', sym: 'NSE:RELIANCE' },
    { label: 'HDFC Bank', sym: 'NSE:HDFCBANK' },
    { label: 'TCS', sym: 'NSE:TCS' },
    { label: 'ITC', sym: 'NSE:ITC' },
  ];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 shadow-2xl transition-all duration-300 flex flex-col ${
        isFullscreen
          ? 'fixed inset-4 z-50 h-[calc(100vh-2rem)] shadow-2xl ring-1 ring-blue-500/50'
          : ''
      } ${className}`}
      style={{ height: isFullscreen ? 'calc(100vh - 2rem)' : height }}
    >
      {/* Top Header Bar */}
      <div className="flex flex-wrap items-center justify-between px-4 py-2.5 bg-gray-900/90 border-b border-gray-800 text-xs shrink-0 gap-2">
        <div className="flex items-center space-x-2">
          <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
            <BarChart2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-white tracking-wide">
            {symbolInfo.displayName}
          </span>
          <span className="text-[11px] px-2 py-0.5 rounded-md font-mono font-bold bg-gray-800 text-gray-400">
            {activeTvSymbol} • {interval === 'D' ? '1D' : `${interval}m`}
          </span>

          {/* Live Price */}
          {typeof livePrice === 'number' && livePrice > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-gray-950/90 border border-gray-700 font-mono text-[11px] ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400 font-sans">
                {symbolInfo.isDerivativeMapped ? 'Option LTP:' : 'Live:'}
              </span>
              <strong className="text-white font-bold">{formatINR(livePrice)}</strong>
              {typeof livePercentChange === 'number' && (
                <span
                  className={`font-semibold ${
                    livePercentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {livePercentChange >= 0 ? '+' : ''}
                  {livePercentChange}%
                  {typeof liveNetChange === 'number' && (
                    <span className="text-[10px] ml-1 font-normal opacity-80">
                      ({liveNetChange >= 0 ? '+' : ''}{formatINR(liveNetChange)})
                    </span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Underlying Share Live Price */}
          {symbolInfo.isDerivativeMapped && typeof underlyingPrice === 'number' && underlyingPrice > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-blue-950/60 border border-blue-500/40 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span className="text-blue-300 font-sans">
                {symbolInfo.underlying || 'Share'}:
              </span>
              <strong className="text-white font-bold">{formatINR(underlyingPrice)}</strong>
              {typeof underlyingPercentChange === 'number' && (
                <span
                  className={`font-semibold ${
                    underlyingPercentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {underlyingPercentChange >= 0 ? '+' : ''}
                  {underlyingPercentChange}%
                </span>
              )}
            </div>
          )}

          {/* Switch Symbol Button */}
          {allowSymbolChange && (
            <button
              type="button"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 font-medium transition-all text-[11px] ml-1"
            >
              <Search className="w-3 h-3 text-blue-400" />
              <span>Switch Symbol</span>
            </button>
          )}
        </div>

        {/* Right Controls */}
        <div className="flex items-center space-x-2">
          <a
            href={symbolInfo.rawIndexLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors bg-blue-950/60 border-blue-500/40 text-blue-300 hover:text-white"
            title={`Open ${activeTvSymbol} directly on TradingView.com`}
          >
            <span>Open on TV</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Symbol Search Overlay */}
      {isSearchOpen && (
        <div className="absolute top-12 left-4 z-40 w-80 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 animate-in fade-in duration-150">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs font-bold text-gray-300">Switch Chart Symbol</span>
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <form onSubmit={handleCustomSearchSubmit} className="mb-3">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="e.g. RELIANCE, SBIN, TCS"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg py-1.5 pl-3 pr-8 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-2 top-1.5 text-gray-400 hover:text-white"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-gray-500 tracking-wider mb-1">
              Popular Stocks & Indices
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {popularSymbols.map((item) => (
                <button
                  key={item.sym}
                  type="button"
                  onClick={() => handleSelectNewSymbol(item.sym)}
                  className="text-left px-2 py-1.5 rounded-lg bg-gray-800/80 hover:bg-blue-600/30 hover:border-blue-500/50 border border-gray-700/60 text-xs text-gray-300 hover:text-white transition-all flex flex-col"
                >
                  <span className="font-semibold">{item.label}</span>
                  <span className="text-[10px] text-gray-500 font-mono">{item.sym}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main TradingView Embed Widget */}
      <div
        ref={containerRef}
        className="w-full flex-1 bg-gray-950"
        style={{ minHeight: '350px' }}
      />
    </div>
  );
});

export default TradingViewChart;
