import React, { useEffect, useState, useMemo, memo } from 'react';
import {
  Maximize2,
  Minimize2,
  BarChart2,
  ExternalLink,
  Search,
  X,
  RefreshCw,
  Layers,
  TrendingUp,
  AlertCircle,
} from 'lucide-react';
import { formatINR } from '../../utils/formatters';

export interface TradingViewChartProps {
  symbol?: string; // e.g. "NSE:RELIANCE", "RELIANCE-EQ", "NSE:NIFTYBEES", "Nifty 50", "99926000"
  exchange?: string; // "NSE" | "BSE"
  interval?: '1' | '3' | '5' | '15' | '30' | '60' | '120' | '240' | 'D' | 'W';
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
  onIntervalChange?: (newInterval: string) => void;
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
 * Angel One Token to TradingView Symbol dictionary for fast resolution
 */
const TOKEN_LOOKUP: Record<string, { symbol: string; displayName: string; exchange: string }> = {
  '99926000': { symbol: 'NSE:NIFTYBEES', displayName: 'NIFTY 50', exchange: 'NSE' },
  '99926009': { symbol: 'NSE:BANKBEES', displayName: 'BANK NIFTY', exchange: 'NSE' },
  '99926037': { symbol: 'NSE:HDFCBANK', displayName: 'FIN NIFTY', exchange: 'NSE' },
  '2885': { symbol: 'NSE:RELIANCE', displayName: 'Reliance Industries', exchange: 'NSE' },
  '3499': { symbol: 'NSE:TATASTEEL', displayName: 'Tata Steel', exchange: 'NSE' },
  '3045': { symbol: 'NSE:SBIN', displayName: 'State Bank of India', exchange: 'NSE' },
  '1333': { symbol: 'NSE:HDFCBANK', displayName: 'HDFC Bank', exchange: 'NSE' },
  '1594': { symbol: 'NSE:INFY', displayName: 'Infosys', exchange: 'NSE' },
  '4963': { symbol: 'NSE:ICICIBANK', displayName: 'ICICI Bank', exchange: 'NSE' },
  '11536': { symbol: 'NSE:TCS', displayName: 'Tata Consultancy Services', exchange: 'NSE' },
  '1660': { symbol: 'NSE:ITC', displayName: 'ITC Ltd', exchange: 'NSE' },
  '317': { symbol: 'NSE:BAJFINANCE', displayName: 'Bajaj Finance', exchange: 'NSE' },
  '10604': { symbol: 'NSE:BHARTIARTL', displayName: 'Bharti Airtel', exchange: 'NSE' },
  '11532': { symbol: 'NSE:LT', displayName: 'Larsen & Toubro', exchange: 'NSE' },
  '1394': { symbol: 'NSE:HINDUNILVR', displayName: 'Hindustan Unilever', exchange: 'NSE' },
  '5258': { symbol: 'NSE:INDUSINDBK', displayName: 'IndusInd Bank', exchange: 'NSE' },
  '1922': { symbol: 'NSE:KOTAKBANK', displayName: 'Kotak Mahindra Bank', exchange: 'NSE' },
  '3787': { symbol: 'NSE:WIPRO', displayName: 'Wipro', exchange: 'NSE' },
  '10940': { symbol: 'NSE:MARUTI', displayName: 'Maruti Suzuki', exchange: 'NSE' },
  '1232': { symbol: 'NSE:AXISBANK', displayName: 'Axis Bank', exchange: 'NSE' },
  '20374': { symbol: 'NSE:COALINDIA', displayName: 'Coal India', exchange: 'NSE' },
};

/**
 * Resolves symbols for TradingView's advanced embed chart:
 * - Spot indices (e.g. NIFTY 50, BANKNIFTY) are mapped to tick-by-tick mirror ETFs (NSE:NIFTYBEES & NSE:BANKBEES).
 * - Option & Futures contracts map to their chartable underlying asset with annotations.
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
      mappedReason: 'NSE spot index mapped to real-time benchmark ETF (NIFTYBEES).',
    };
  }

  const rawTrimmed = symbol.trim();

  // Check if symbol is a numeric Angel One token ID
  if (/^\d+$/.test(rawTrimmed) && TOKEN_LOOKUP[rawTrimmed]) {
    const info = TOKEN_LOOKUP[rawTrimmed];
    return {
      tradingViewSymbol: info.symbol,
      isIndexMapped: info.symbol.includes('BEES') || info.displayName.includes('NIFTY'),
      displayName: info.displayName,
      underlying: info.displayName,
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(info.symbol)}`,
      mappedReason: `Token ${rawTrimmed} mapped to ${info.displayName} (${info.symbol}).`,
    };
  }

  let clean = rawTrimmed.toUpperCase();
  let exg = exchange.toUpperCase();

  if (clean.includes(':')) {
    const parts = clean.split(':');
    exg = parts[0] || 'NSE';
    clean = parts[1] || '';
  }

  // Strip broker suffixes like -EQ, -BE, -BL, -SM, -INDEX
  clean = clean.replace(/-(EQ|BE|BL|SM|INDEX)$/i, '').trim();

  // 1. Detect Option contracts (e.g. NIFTY01DEC2624900CE or NIFTY 25000 PE)
  const optMatch =
    clean.match(/^([A-Z]+?)(\d{2})([A-Z]{3}|\d{2})(\d+)(CE|PE)$/i) ||
    clean.match(/^([A-Z]+)\s*(\d{2}[A-Z]{3}\d{0,2})?\s*(\d+(?:\.\d+)?)\s*(CE|PE)$/i) ||
    clean.match(/^([A-Z]+)[\s_-]*(\d+)\s*(CE|PE)$/i);

  if (optMatch) {
    const under = optMatch[1] || 'NIFTY';
    const optType = (optMatch[5] || optMatch[4] || optMatch[3] || 'CE').toUpperCase();
    const strike = optMatch[4] || optMatch[3] || optMatch[2] || '';

    let tvSym = `NSE:${under}`;
    let mappedUnder = under;
    const norm = under.replace(/[^A-Z]/g, '');

    if (norm === 'NIFTY' || norm.startsWith('NIFTY50')) {
      tvSym = 'NSE:NIFTYBEES';
      mappedUnder = 'NIFTY 50';
    } else if (norm.startsWith('BANKNIFTY') || norm.startsWith('NIFTYBANK')) {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
    } else if (norm.startsWith('FINNIFTY')) {
      tvSym = 'NSE:HDFCBANK';
      mappedUnder = 'FIN NIFTY';
    } else if (norm.startsWith('MIDCPNIFTY') || norm.startsWith('MIDCAP')) {
      tvSym = 'NSE:MID150BEES';
      mappedUnder = 'MIDCAP NIFTY';
    } else if (norm.startsWith('SENSEX')) {
      tvSym = 'BSE:SENSEXBEES';
      mappedUnder = 'SENSEX';
    }

    return {
      tradingViewSymbol: tvSym,
      isIndexMapped: true,
      isDerivativeMapped: true,
      displayName: clean,
      underlying: mappedUnder,
      contractType: optType,
      strike: strike ? `${strike} ${optType}` : optType,
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      mappedReason: `Option strike charted via underlying asset (${mappedUnder}).`,
    };
  }

  // 2. Detect Futures contracts (e.g. NIFTY FUT, RELIANCE24DECFUT)
  const futMatch = clean.match(/^([A-Z]+?)(\d{2}[A-Z]{3}\d{0,2})?[\s_-]*(?:FUT|FUTURES)$/i);
  if (futMatch) {
    const under = futMatch[1] || 'NIFTY';
    let tvSym = `NSE:${under}`;
    let mappedUnder = under;
    const norm = under.replace(/[^A-Z]/g, '');

    if (norm === 'NIFTY' || norm.startsWith('NIFTY50')) {
      tvSym = 'NSE:NIFTYBEES';
      mappedUnder = 'NIFTY 50';
    } else if (norm.startsWith('BANKNIFTY') || norm.startsWith('NIFTYBANK')) {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
    } else if (norm.startsWith('FINNIFTY')) {
      tvSym = 'NSE:HDFCBANK';
      mappedUnder = 'FIN NIFTY';
    } else if (norm.startsWith('MIDCPNIFTY') || norm.startsWith('MIDCAP')) {
      tvSym = 'NSE:MID150BEES';
      mappedUnder = 'MIDCAP NIFTY';
    } else if (norm.startsWith('SENSEX')) {
      tvSym = 'BSE:SENSEXBEES';
      mappedUnder = 'SENSEX';
    }

    return {
      tradingViewSymbol: tvSym,
      isIndexMapped: true,
      isDerivativeMapped: true,
      displayName: clean,
      underlying: mappedUnder,
      contractType: 'FUT',
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      mappedReason: `Futures contract charted via underlying asset (${mappedUnder}).`,
    };
  }

  // 3. Direct Index mapping
  const norm = clean.replace(/[^A-Z0-9]/g, '');
  if (norm === 'NIFTY' || norm === 'NIFTY50' || norm === 'CNXNIFTY' || norm === 'NIFTYBEES') {
    return {
      tradingViewSymbol: 'NSE:NIFTYBEES',
      isIndexMapped: true,
      displayName: 'NIFTY 50',
      underlying: 'NIFTY 50',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY',
      mappedReason: 'NSE index charted via tick-by-tick mirror ETF (NIFTYBEES).',
    };
  }
  if (norm.startsWith('BANKNIFTY') || norm === 'NIFTYBANK' || norm === 'BANKBEES') {
    return {
      tradingViewSymbol: 'NSE:BANKBEES',
      isIndexMapped: true,
      displayName: 'BANK NIFTY',
      underlying: 'BANK NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ABANKNIFTY',
      mappedReason: 'Bank Nifty charted via tick-by-tick mirror ETF (BANKBEES).',
    };
  }
  if (norm.startsWith('FINNIFTY')) {
    return {
      tradingViewSymbol: 'NSE:HDFCBANK',
      isIndexMapped: true,
      displayName: 'FIN NIFTY',
      underlying: 'FIN NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3AFINNIFTY',
      mappedReason: 'FIN NIFTY charted via key heavyweight constituent (HDFCBANK).',
    };
  }
  if (norm.startsWith('MIDCPNIFTY') || norm.startsWith('MIDCAP')) {
    return {
      tradingViewSymbol: 'NSE:MID150BEES',
      isIndexMapped: true,
      displayName: 'MIDCAP NIFTY',
      underlying: 'MIDCAP NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3AMIDCPNIFTY',
    };
  }
  if (norm === 'SENSEX' || norm === 'BSESENSEX' || norm === 'SENSEXBEES') {
    return {
      tradingViewSymbol: 'BSE:SENSEXBEES',
      isIndexMapped: true,
      displayName: 'BSE SENSEX',
      underlying: 'SENSEX',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=BSE%3ASENSEX',
    };
  }
  if (norm === 'BANKEX' || norm === 'BSEBANKEX') {
    return {
      tradingViewSymbol: 'BSE:BANKBEES',
      isIndexMapped: true,
      displayName: 'BSE BANKEX',
      underlying: 'BANKEX',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=BSE%3ABANKEX',
    };
  }

  // 4. Standard Cash Equities
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
  showToolbar = true,
  className = '',
  livePrice,
  liveNetChange,
  livePercentChange,
  underlyingPrice,
  underlyingPercentChange,
  onSymbolChange,
  onIntervalChange,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentSymbol, setCurrentSymbol] = useState(symbol);
  const [currentInterval, setCurrentInterval] = useState<string>(interval);
  const [chartStyle, setChartStyle] = useState<'1' | '0' | '2' | '3'>('1'); // 1: Candles, 0: Bars, 2: Line, 3: Area
  const [studiesActive, setStudiesActive] = useState<boolean>(enableStudies);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [iframeError, setIframeError] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);
  const [useFallbackHost, setUseFallbackHost] = useState(false);

  // Sync prop changes
  useEffect(() => {
    setCurrentSymbol(symbol);
  }, [symbol]);

  useEffect(() => {
    setCurrentInterval(interval);
  }, [interval]);

  const symbolInfo = useMemo(
    () => resolveTradingViewSymbolInfo(currentSymbol, exchange),
    [currentSymbol, exchange]
  );

  const activeTvSymbol = symbolInfo.tradingViewSymbol;

  // Change Symbol Handler
  const handleSelectNewSymbol = (sym: string) => {
    setCurrentSymbol(sym);
    setIsSearchOpen(false);
    setSearchInput('');
    setIsLoading(true);
    setIframeError(false);
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

  // Change Interval Handler
  const handleIntervalChange = (newInterval: string) => {
    setCurrentInterval(newInterval);
    setIsLoading(true);
    setIframeError(false);
    if (onIntervalChange) {
      onIntervalChange(newInterval);
    }
  };

  // Reload Chart Handler
  const handleReload = () => {
    setIsLoading(true);
    setIframeError(false);
    setReloadCounter((prev) => prev + 1);
  };

  // Build the complete TradingView Advanced Chart configuration
  const widgetConfig = useMemo(() => {
    return {
      autosize: true,
      symbol: activeTvSymbol,
      interval: currentInterval,
      timezone: 'Asia/Kolkata',
      theme: theme === 'dark' ? 'dark' : 'light',
      style: chartStyle,
      locale: 'en',
      enable_publishing: false,
      hide_top_toolbar: !showToolbar,
      hide_legend: false,
      save_image: true,
      calendar: false,
      hide_side_toolbar: false,
      allow_symbol_change: allowSymbolChange,
      studies: studiesActive
        ? [
            'STD;RSI',
            'STD;MACD',
            'STD;EMA@tv-basicstudies',
            'STD;Bollinger_Bands',
          ]
        : [],
      support_host: 'https://www.tradingview.com',
    };
  }, [
    activeTvSymbol,
    currentInterval,
    theme,
    chartStyle,
    showToolbar,
    allowSymbolChange,
    studiesActive,
  ]);

  // Construct reactive direct iframe URL
  const iframeSrc = useMemo(() => {
    if (useFallbackHost) {
      return `https://s.tradingview.com/widgetembed/?symbol=${encodeURIComponent(
        activeTvSymbol
      )}&interval=${encodeURIComponent(
        currentInterval
      )}&theme=${theme}&style=${chartStyle}&timezone=Asia%2FKolkata&locale=en`;
    }
    return `https://www.tradingview-widget.com/embed-widget/advanced-chart/?locale=en#${encodeURIComponent(
      JSON.stringify(widgetConfig)
    )}`;
  }, [useFallbackHost, activeTvSymbol, currentInterval, theme, chartStyle, widgetConfig]);

  // Fallback safety timer: if iframe takes > 7s to load, clear loading spinner
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        setIsLoading(false);
      }
    }, 7000);
    return () => clearTimeout(timer);
  }, [isLoading, iframeSrc, reloadCounter]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const popularSymbols = [
    { label: 'Nifty 50', sym: 'NSE:NIFTYBEES', desc: 'NIFTY 50 ETF' },
    { label: 'Bank Nifty', sym: 'NSE:BANKBEES', desc: 'Banking ETF' },
    { label: 'Reliance', sym: 'NSE:RELIANCE', desc: 'Energy & Retail' },
    { label: 'HDFC Bank', sym: 'NSE:HDFCBANK', desc: 'Private Banking' },
    { label: 'TCS', sym: 'NSE:TCS', desc: 'IT Services' },
    { label: 'SBI', sym: 'NSE:SBIN', desc: 'Public Banking' },
    { label: 'Infosys', sym: 'NSE:INFY', desc: 'IT Consulting' },
    { label: 'ICICI Bank', sym: 'NSE:ICICIBANK', desc: 'Private Banking' },
    { label: 'Tata Steel', sym: 'NSE:TATASTEEL', desc: 'Metals' },
    { label: 'ITC', sym: 'NSE:ITC', desc: 'FMCG' },
    { label: 'Sensex', sym: 'BSE:SENSEXBEES', desc: 'BSE Sensex ETF' },
    { label: 'Midcap 150', sym: 'NSE:MID150BEES', desc: 'Midcap Index ETF' },
  ];

  const intervals = [
    { label: '1m', val: '1' },
    { label: '5m', val: '5' },
    { label: '15m', val: '15' },
    { label: '1h', val: '60' },
    { label: '1D', val: 'D' },
    { label: '1W', val: 'W' },
  ];

  return (
    <div
      className={`relative rounded-2xl overflow-hidden border border-gray-800 bg-gray-950 shadow-2xl transition-all duration-300 flex flex-col ${
        isFullscreen
          ? 'fixed inset-2 z-50 h-[calc(100vh-1rem)] shadow-2xl ring-2 ring-blue-500/60'
          : ''
      } ${className}`}
      style={{ height: isFullscreen ? 'calc(100vh - 1rem)' : height }}
    >
      {/* Top Header Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3.5 py-2 bg-gray-900/95 border-b border-gray-800 text-xs shrink-0 gap-2">
        {/* Left Side: Symbol & Live Pricing Badges */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center space-x-1.5">
            <div className="p-1 rounded-lg bg-blue-500/20 text-blue-400">
              <BarChart2 className="w-4 h-4" />
            </div>
            <span className="font-bold text-white tracking-wide text-xs">
              {symbolInfo.displayName}
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-md font-mono font-bold bg-gray-800 text-gray-400 border border-gray-700/60">
              {activeTvSymbol}
            </span>
          </div>

          {/* Live Price from Real-time Ticker */}
          {typeof livePrice === 'number' && livePrice > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-gray-950/90 border border-gray-700 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400 font-sans text-[10px]">
                {symbolInfo.isDerivativeMapped ? 'Option LTP:' : 'Live:'}
              </span>
              <strong className="text-white font-bold">{formatINR(livePrice)}</strong>
              {typeof livePercentChange === 'number' && (
                <span
                  className={`font-semibold text-[11px] ${
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

          {/* Underlying Share Live Price (for Options/Futures) */}
          {symbolInfo.isDerivativeMapped && typeof underlyingPrice === 'number' && underlyingPrice > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-blue-950/60 border border-blue-500/40 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span className="text-blue-300 font-sans text-[10px]">
                {symbolInfo.underlying || 'Underlying'}:
              </span>
              <strong className="text-white font-bold">{formatINR(underlyingPrice)}</strong>
              {typeof underlyingPercentChange === 'number' && (
                <span
                  className={`font-semibold text-[11px] ${
                    underlyingPercentChange >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}
                >
                  {underlyingPercentChange >= 0 ? '+' : ''}
                  {underlyingPercentChange}%
                </span>
              )}
            </div>
          )}

          {/* Mapping Reason Badge (if derivative or restricted index) */}
          {symbolInfo.mappedReason && (
            <span
              className="hidden lg:inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300"
              title={symbolInfo.mappedReason}
            >
              <AlertCircle className="w-3 h-3 text-amber-400 shrink-0" />
              <span className="truncate max-w-[200px]">{symbolInfo.mappedReason}</span>
            </span>
          )}
        </div>

        {/* Right Side: Interactive Chart Controls */}
        <div className="flex items-center space-x-1.5 ml-auto">
          {/* Timeframe Selector */}
          <div className="flex items-center bg-gray-950 rounded-lg p-0.5 border border-gray-800">
            {intervals.map((item) => (
              <button
                key={item.val}
                type="button"
                onClick={() => handleIntervalChange(item.val)}
                className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                  currentInterval === item.val
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/60'
                }`}
                title={`Switch interval to ${item.label}`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Chart Style Switcher (Candles / Line) */}
          <button
            type="button"
            onClick={() => setChartStyle((prev) => (prev === '1' ? '2' : prev === '2' ? '3' : '1'))}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              chartStyle === '1'
                ? 'bg-gray-800 border-gray-700 text-gray-300 hover:text-white'
                : 'bg-indigo-950/60 border-indigo-500/40 text-indigo-300'
            }`}
            title={`Chart Style: ${chartStyle === '1' ? 'Candles' : chartStyle === '2' ? 'Line' : 'Area'}`}
          >
            <TrendingUp className="w-3 h-3 text-indigo-400" />
            <span className="hidden sm:inline">
              {chartStyle === '1' ? 'Candles' : chartStyle === '2' ? 'Line' : 'Area'}
            </span>
          </button>

          {/* Studies / Indicators Toggle */}
          <button
            type="button"
            onClick={() => setStudiesActive((prev) => !prev)}
            className={`flex items-center space-x-1 px-2 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              studiesActive
                ? 'bg-blue-950/60 border-blue-500/40 text-blue-300'
                : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'
            }`}
            title="Toggle Technical Indicators (RSI, MACD, EMA, BB)"
          >
            <Layers className="w-3 h-3 text-blue-400" />
            <span className="hidden md:inline">Indicators</span>
          </button>

          {/* Switch Symbol Button */}
          {allowSymbolChange && (
            <button
              type="button"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 font-medium transition-all text-[11px]"
            >
              <Search className="w-3 h-3 text-blue-400" />
              <span>Symbol</span>
            </button>
          )}

          {/* Reload Chart Button */}
          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white border border-gray-700 transition-colors"
            title="Reload Chart"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>

          {/* Open on TradingView */}
          <a
            href={symbolInfo.rawIndexLink}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors bg-blue-950/60 border-blue-500/40 text-blue-300 hover:text-white"
            title={`Open ${activeTvSymbol} directly on TradingView.com`}
          >
            <span className="hidden sm:inline">TV</span>
            <ExternalLink className="w-3 h-3" />
          </a>

          {/* Fullscreen Button */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-gray-700 transition-colors"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Symbol Search Modal Overlay */}
      {isSearchOpen && (
        <div className="absolute top-12 left-4 z-40 w-88 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl p-3 animate-in fade-in duration-150 backdrop-blur-md">
          <div className="flex justify-between items-center mb-2.5">
            <span className="text-xs font-bold text-gray-200 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-blue-400" />
              Search Any NSE/BSE Stock or Index
            </span>
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              className="text-gray-400 hover:text-white p-0.5 rounded hover:bg-gray-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleCustomSearchSubmit} className="mb-3">
            <div className="relative">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Type ticker e.g. RELIANCE, SBIN, TCS, INFY"
                className="w-full bg-gray-950 border border-gray-700 rounded-lg py-1.5 pl-3 pr-8 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/50"
                autoFocus
              />
              <button
                type="submit"
                className="absolute right-2 top-2 text-gray-400 hover:text-white"
              >
                <Search className="w-3.5 h-3.5" />
              </button>
            </div>
          </form>

          <div className="space-y-1">
            <div className="text-[10px] uppercase font-bold text-gray-400 tracking-wider mb-1">
              Popular Benchmark Instruments
            </div>
            <div className="grid grid-cols-2 gap-1.5 max-h-60 overflow-y-auto pr-1">
              {popularSymbols.map((item) => (
                <button
                  key={item.sym}
                  type="button"
                  onClick={() => handleSelectNewSymbol(item.sym)}
                  className={`text-left px-2.5 py-1.5 rounded-lg border text-xs transition-all flex flex-col ${
                    activeTvSymbol === item.sym
                      ? 'bg-blue-600/20 border-blue-500/60 text-blue-200'
                      : 'bg-gray-800/70 hover:bg-gray-700/80 border-gray-700/60 text-gray-300 hover:text-white'
                  }`}
                >
                  <span className="font-semibold text-xs">{item.label}</span>
                  <span className="text-[10px] text-gray-400 font-mono">{item.sym}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Chart Body */}
      <div className="relative w-full flex-1 bg-gray-950 overflow-hidden">
        {/* Sleek Skeleton Loading Spinner */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-gray-950/80 backdrop-blur-xs text-center transition-opacity">
            <div className="relative mb-3">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
              <BarChart2 className="w-4 h-4 text-blue-400 absolute inset-0 m-auto" />
            </div>
            <p className="text-xs font-semibold text-gray-300">
              Loading {symbolInfo.displayName} Candlestick Chart...
            </p>
            <p className="text-[10px] text-gray-500 mt-0.5">
              Connecting to TradingView ({activeTvSymbol} • {currentInterval}m)
            </p>
          </div>
        )}

        {/* Fallback Error Banner */}
        {iframeError && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-gray-950 p-6 text-center">
            <AlertCircle className="w-10 h-10 text-amber-400 mb-2" />
            <h3 className="text-sm font-bold text-white mb-1">
              Unable to load embedded chart for {symbolInfo.displayName}
            </h3>
            <p className="text-xs text-gray-400 max-w-md mb-4">
              The chart embed host could not be reached or was blocked by an adblocker/browser policy.
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setUseFallbackHost((prev) => !prev);
                  handleReload();
                }}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold"
              >
                Switch to Alternate Embed Host
              </button>
              <a
                href={symbolInfo.rawIndexLink}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold border border-gray-700 flex items-center gap-1.5"
              >
                <span>Open in TradingView.com</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
        )}

        {/* Direct TradingView Responsive Iframe */}
        <iframe
          key={`${activeTvSymbol}-${currentInterval}-${chartStyle}-${reloadCounter}-${useFallbackHost}`}
          src={iframeSrc}
          title={`TradingView Chart - ${activeTvSymbol}`}
          className="w-full h-full border-0 select-none block"
          style={{ width: '100%', height: '100%' }}
          allow="transparency"
          onLoad={() => {
            setIsLoading(false);
            setIframeError(false);
          }}
          onError={() => {
            setIsLoading(false);
            setIframeError(true);
          }}
        />
      </div>
    </div>
  );
});

export default TradingViewChart;
