import React, { useEffect, useRef, useState, useMemo, memo } from 'react';
import { Maximize2, Minimize2, BarChart2, ExternalLink, Info, Search, X, Copy, Check, ArrowRight, Layers } from 'lucide-react';
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

export interface SymbolConversionBreakdown {
  brokerSymbol: string;
  tradingViewSymbol: string;
  underlying: string;
  expiryDate: string;
  strike: string;
  optionType: string;
  fullTradingViewUrl: string;
}

export interface ConvertedOptionFormula {
  brokerSymbol: string;
  tradingViewSymbol: string;
  underlying: string;
  expiryDateFormatted: string; // e.g. "261201" (YYMMDD)
  strike: string;
  optionTypeFormatted: 'C' | 'P'; // "C" for CE, "P" for PE
  fullTradingViewUrl: string;
  isOption: boolean;
}

/**
 * Dedicated Conversion Formula Function:
 * Converts Angel One Options format to TradingView native symbol format:
 *
 * Example:
 * Angel One      TradingView
 * ----------------------------
 * NIFTY          NIFTY
 * 01DEC26        261201 (YYMMDD)
 * 24900          24900
 * CE             C  (or PE -> P)
 *
 * Result: NSE:NIFTY261201C24900
 */
export function convertAngelOneToTradingViewSymbol(
  angelSymbol: string,
  exchange = 'NSE'
): ConvertedOptionFormula {
  if (!angelSymbol) {
    return {
      brokerSymbol: '',
      tradingViewSymbol: 'NSE:NIFTYBEES',
      underlying: 'NIFTY',
      expiryDateFormatted: '',
      strike: '',
      optionTypeFormatted: 'C',
      fullTradingViewUrl: 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTYBEES',
      isOption: false,
    };
  }

  let clean = angelSymbol.trim().toUpperCase();
  let exg = exchange.toUpperCase();

  if (clean.includes(':')) {
    const parts = clean.split(':');
    exg = parts[0] || 'NSE';
    clean = parts[1] || '';
  }

  // Strip broker equity suffixes
  clean = clean.replace(/-EQ$/, '').replace(/-BE$/, '').replace(/-BL$/, '').trim();

  const MONTH_TO_NUM: Record<string, string> = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  };

  // 1. Check if already in Native TradingView option format: (UNDER)(YYMMDD|YYMM)(C|P)(STRIKE)
  const mNative = clean.match(/^([A-Z]+)(\d{4,6})([CP])(\d{3,6})$/);
  if (mNative) {
    const underlying = mNative[1] || '';
    const expiry = mNative[2] || '';
    const optionType = mNative[3] as 'C' | 'P';
    const strike = mNative[4] || '';
    const tvSym = `${exg}:${underlying}${expiry}${optionType}${strike}`;
    return {
      brokerSymbol: clean,
      tradingViewSymbol: tvSym,
      underlying,
      expiryDateFormatted: expiry,
      strike,
      optionTypeFormatted: optionType,
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      isOption: true,
    };
  }

  // 2. Weekly Angel One Formula: (UNDER)(DD)(MMM)(YY)(STRIKE)(CE|PE) e.g. NIFTY01DEC2624900CE ➔ NSE:NIFTY261201C24900
  const mWeekly = clean.match(
    /^([A-Z]+?)(0[1-9]|[12]\d|3[01])(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{2})(\d{3,6})(CE|PE)$/i
  );
  if (mWeekly) {
    const underlying = mWeekly[1] || '';
    const dd = mWeekly[2] || '';
    const mmm = (mWeekly[3] || '').toUpperCase();
    const yy = mWeekly[4] || '';
    const strike = mWeekly[5] || '';
    const rawType = (mWeekly[6] || '').toUpperCase();
    const mm = MONTH_TO_NUM[mmm] || '12';
    const expiryDateFormatted = `${yy}${mm}${dd}`; // 26 + 12 + 01 = 261201
    const optionTypeFormatted = rawType === 'CE' ? 'C' : 'P';
    const tvSym = `${exg}:${underlying}${expiryDateFormatted}${optionTypeFormatted}${strike}`;
    return {
      brokerSymbol: clean,
      tradingViewSymbol: tvSym,
      underlying,
      expiryDateFormatted,
      strike,
      optionTypeFormatted,
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      isOption: true,
    };
  }

  // 3. Monthly Angel One Formula: (UNDER)(YY)(MMM)(STRIKE)(CE|PE) e.g. RELIANCE26DEC1300CE ➔ NSE:RELIANCE2612C1300
  const mMonthly = clean.match(
    /^([A-Z]+?)(\d{2})(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)(\d{3,6})(CE|PE)$/i
  );
  if (mMonthly) {
    const underlying = mMonthly[1] || '';
    const yy = mMonthly[2] || '';
    const mmm = (mMonthly[3] || '').toUpperCase();
    const strike = mMonthly[4] || '';
    const rawType = (mMonthly[5] || '').toUpperCase();
    const mm = MONTH_TO_NUM[mmm] || '12';
    const expiryDateFormatted = `${yy}${mm}`; // 26 + 12 = 2612
    const optionTypeFormatted = rawType === 'CE' ? 'C' : 'P';
    const tvSym = `${exg}:${underlying}${expiryDateFormatted}${optionTypeFormatted}${strike}`;
    return {
      brokerSymbol: clean,
      tradingViewSymbol: tvSym,
      underlying,
      expiryDateFormatted,
      strike,
      optionTypeFormatted,
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      isOption: true,
    };
  }

  // 4. Space-separated Option (e.g. "NIFTY 25000 PE", "BANKNIFTY 53400 PE")
  const mSpace = clean.match(/^([A-Z\-]+)\s+(\d+(?:\.\d+)?)\s*(CE|PE)$/i);
  if (mSpace) {
    const underlying = (mSpace[1] || '').trim();
    const strike = mSpace[2] || '';
    const rawType = (mSpace[3] || 'CE').toUpperCase();
    const optionTypeFormatted = rawType === 'CE' ? 'C' : 'P';
    return {
      brokerSymbol: clean,
      tradingViewSymbol: `${exg}:${underlying}`,
      underlying,
      expiryDateFormatted: '',
      strike,
      optionTypeFormatted,
      fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`${exg}:${underlying}`)}`,
      isOption: true,
    };
  }

  return {
    brokerSymbol: clean,
    tradingViewSymbol: `${exg}:${clean}`,
    underlying: clean,
    expiryDateFormatted: '',
    strike: '',
    optionTypeFormatted: 'C',
    fullTradingViewUrl: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`${exg}:${clean}`)}`,
    isOption: false,
  };
}

export interface ResolvedSymbolInfo {
  tradingViewSymbol: string;
  convertedOptionSymbol?: string;
  underlyingTradingViewSymbol?: string;
  isIndexMapped: boolean;
  isDerivativeMapped?: boolean;
  displayName: string;
  underlying?: string;
  contractType?: 'CE' | 'PE' | 'FUT' | 'EQ';
  strike?: string;
  expiry?: string;
  rawIndexLink?: string;
  tradingViewOptionLink?: string;
  mappedReason?: string;
  conversionBreakdown?: SymbolConversionBreakdown;
}

/**
 * Robust symbol resolver for Indian Markets (NSE / BSE):
 *
 * NOTE ON TRADINGVIEW RESTRICTIONS & DERIVATIVES (F&O):
 * 1. NSE proprietary spot indices (NSE:NIFTY and NSE:BANKNIFTY) are legally restricted
 *    by NSE licensing rules from being rendered inside external embedded widgets.
 *    TradingView displays "This symbol is only available on TradingView" if raw spot
 *    index tickers are requested. We map them to tick-by-tick mirror ETFs (NIFTYBEES & BANKBEES).
 *
 * 2. Individual Option Strikes (e.g. NIFTY01DEC2625200CE, NIFTY 25000 PE, BANKNIFTY 53400 PE)
 *    and Futures contracts DO NOT exist as standalone tickers on TradingView's free embed widget.
 *    TradingView returns "This symbol doesn't exist".
 *    All option and future traders chart the UNDERLYING asset (NIFTY 50, BANK NIFTY, or stock).
 *    We automatically extract the underlying and map it directly to its liquid chartable asset!
 */
export function resolveTradingViewSymbolInfo(symbol: string, exchange = 'NSE'): ResolvedSymbolInfo {
  if (!symbol) {
    return {
      tradingViewSymbol: 'NSE:NIFTYBEES',
      isIndexMapped: true,
      displayName: 'NIFTY 50 (via NIFTYBEES ETF)',
      underlying: 'NIFTY 50',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY',
      mappedReason:
        'NSE proprietary spot index data is restricted by exchange licensing in external widgets. Showing real-time benchmark ETF (NIFTYBEES) which tracks NIFTY 1:1.',
    };
  }

  let clean = symbol.trim().toUpperCase();
  let exg = exchange.toUpperCase();

  // If already prefixed with exchange (e.g. NSE:NIFTY01DEC2625200CE or NFO:...)
  if (clean.includes(':')) {
    const parts = clean.split(':');
    exg = parts[0] || 'NSE';
    clean = parts[1] || '';
  }

  // Strip broker suffixes like -EQ, -BE, -BL
  clean = clean.replace(/-EQ$/, '').replace(/-BE$/, '').replace(/-BL$/, '').trim();

  // 1. Run the Dedicated Formula Converter for Options (Angel One ➔ TradingView)
  const converted = convertAngelOneToTradingViewSymbol(clean, exg);
  if (converted.isOption && converted.strike) {
    const under = converted.underlying;
    const optType = converted.optionTypeFormatted === 'C' ? 'CE' : 'PE';

    // Map underlying index to real-time benchmark ETF for liquid fallback
    let tvSym = `NSE:${under}`;
    let mappedUnder = under;
    const normUnder = under.replace(/[^A-Z]/g, '');
    if (normUnder === 'NIFTY' || normUnder.startsWith('NIFTY50') || normUnder === 'CNXNIFTY') {
      tvSym = 'NSE:NIFTYBEES';
      mappedUnder = 'NIFTY 50';
    } else if (normUnder.startsWith('BANKNIFTY') || normUnder === 'NIFTYBANK') {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
    } else if (normUnder.startsWith('FINNIFTY') || normUnder === 'NIFTYFIN') {
      tvSym = 'NSE:HDFCBANK';
      mappedUnder = 'FIN NIFTY';
    } else if (normUnder.startsWith('MIDCPNIFTY') || normUnder.startsWith('MIDCAP')) {
      tvSym = 'NSE:MID150BEES';
      mappedUnder = 'MIDCAP NIFTY';
    }

    const breakdown: SymbolConversionBreakdown = {
      brokerSymbol: clean,
      tradingViewSymbol: converted.tradingViewSymbol,
      underlying: under,
      expiryDate: converted.expiryDateFormatted,
      strike: converted.strike,
      optionType: `${optType} ➔ ${converted.optionTypeFormatted}`,
      fullTradingViewUrl: converted.fullTradingViewUrl,
    };

    return {
      tradingViewSymbol: tvSym, // Underlying chartable symbol (avoids restricted option tickers in embed)
      underlyingTradingViewSymbol: tvSym,
      convertedOptionSymbol: converted.tradingViewSymbol,
      isIndexMapped: true,
      isDerivativeMapped: true,
      displayName: `${clean} (${converted.tradingViewSymbol})`,
      underlying: mappedUnder,
      contractType: optType,
      strike: converted.strike,
      expiry: converted.expiryDateFormatted,
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      tradingViewOptionLink: converted.fullTradingViewUrl,
      mappedReason: `Converted using TradingView Formula: ${clean} ➔ ${converted.tradingViewSymbol}. Chart opens using underlying asset to avoid TradingView restrictions.`,
      conversionBreakdown: breakdown,
    };
  }

  // 2. Space-separated Option Tickers fallback (e.g. "NIFTY 25000 PE", "BANKNIFTY 53400 PE")
  const spaceOpt = clean.match(/^([A-Z\-]+)\s+(\d+(?:\.\d+)?)\s*(CE|PE)$/i);
  if (spaceOpt) {
    const rawUnder = (spaceOpt[1] || 'NIFTY').trim();
    const strike = spaceOpt[2] || '';
    const optType = (spaceOpt[3] || 'CE').toUpperCase() as 'CE' | 'PE';

    let tvSym = `NSE:${rawUnder}`;
    let mappedUnder = rawUnder;
    const normUnder = rawUnder.replace(/[^A-Z]/g, '');
    if (normUnder === 'NIFTY' || normUnder.startsWith('NIFTY50') || normUnder === 'CNXNIFTY') {
      tvSym = 'NSE:NIFTYBEES';
      mappedUnder = 'NIFTY 50';
    } else if (normUnder.startsWith('BANKNIFTY') || normUnder === 'NIFTYBANK') {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
    }

    return {
      tradingViewSymbol: tvSym,
      underlyingTradingViewSymbol: tvSym,
      isIndexMapped: true,
      isDerivativeMapped: true,
      displayName: `${clean} (${mappedUnder} ${strike} ${optType})`,
      underlying: mappedUnder,
      contractType: optType,
      strike,
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(tvSym)}`,
      mappedReason: `Charting underlying ${mappedUnder} (${tvSym}) for this option strike.`,
    };
  }

  // 3. Handle Futures Contracts (e.g. "ANGELONE23NOV26FUT", "MARICO23NOV26FUT", "NIFTY23NOV26FUT")
  if (clean.endsWith('FUT')) {
    const body = clean.slice(0, -3);
    let under = '';

    if (body.startsWith('NIFTY')) {
      under = 'NIFTY';
    } else if (body.startsWith('BANKNIFTY')) {
      under = 'BANKNIFTY';
    } else if (body.startsWith('FINNIFTY')) {
      under = 'FINNIFTY';
    } else {
      const match = body.match(/^([A-Z\-]+?)(?:\d{2}[A-Z]{3}(?:\d{2})?)?$/i);
      under = match ? match[1] || '' : body;
    }

    let tvSym = `NSE:${under}`;
    let mappedUnder = under;
    let rawLink = `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`NSE:${under}`)}`;

    if (under === 'NIFTY') {
      tvSym = 'NSE:NIFTYBEES';
      mappedUnder = 'NIFTY 50';
      rawLink = 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY';
    } else if (under === 'BANKNIFTY') {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
      rawLink = 'https://www.tradingview.com/chart/?symbol=NSE%3ABANKNIFTY';
    }

    return {
      tradingViewSymbol: tvSym,
      isIndexMapped: true,
      isDerivativeMapped: true,
      displayName: `${clean} (${mappedUnder} Futures)`,
      underlying: mappedUnder,
      contractType: 'FUT',
      rawIndexLink: rawLink,
      mappedReason: `Displaying underlying cash asset ${mappedUnder} (${tvSym}) for this Futures contract.`,
    };
  }

  // 4. Comprehensive Benchmark Index Detector & Normalizer
  // Removes all non-alphanumeric chars to handle:
  // "NIFTY", "NIFTY 50", "NIFTY-50", "NIFTY_50", "CNX NIFTY", "NIFTY 50 (ETF)", "NIFTY-INDEX", etc.
  const norm = clean.replace(/[^A-Z0-9]/g, '');

  if (
    norm === 'NIFTY' ||
    norm === 'NIFTY50' ||
    norm === 'CNXNIFTY' ||
    norm === 'NIFTYINDEX' ||
    norm === 'NIFTY50INDEX' ||
    norm.startsWith('NIFTY50') ||
    (norm.startsWith('NIFTY') && (norm.endsWith('INDEX') || norm.endsWith('ETF') || norm.length <= 7))
  ) {
    return {
      tradingViewSymbol: 'NSE:NIFTYBEES',
      isIndexMapped: true,
      displayName: 'NIFTY 50 (via NIFTYBEES ETF)',
      underlying: 'NIFTY 50',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ANIFTY',
      mappedReason:
        'NSE proprietary spot index data is restricted by exchange licensing in external widgets. Displaying real-time benchmark ETF (NIFTYBEES) which tracks NIFTY 1:1 with zero restriction.',
    };
  }

  if (
    norm === 'BANKNIFTY' ||
    norm === 'NIFTYBANK' ||
    norm === 'BANKNIFTYINDEX' ||
    norm === 'BANKINDEX' ||
    norm === 'BANK' ||
    (norm.startsWith('BANKNIFTY') && (norm.endsWith('INDEX') || norm.endsWith('ETF')))
  ) {
    return {
      tradingViewSymbol: 'NSE:BANKBEES',
      isIndexMapped: true,
      displayName: 'BANK NIFTY (via BANKBEES ETF)',
      underlying: 'BANK NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ABANKNIFTY',
      mappedReason:
        'NSE Spot Index data is restricted by exchange licensing in external widgets. Displaying BANKBEES ETF (tracks Bank Nifty 1:1).',
    };
  }

  if (
    norm === 'FINNIFTY' ||
    norm === 'NIFTYFIN' ||
    norm === 'NIFTYFINSERVICE' ||
    norm === 'FINNIFTYINDEX'
  ) {
    return {
      tradingViewSymbol: 'NSE:HDFCBANK',
      isIndexMapped: true,
      displayName: 'FIN NIFTY (HDFC Bank Core)',
      underlying: 'FIN NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3AFINNIFTY',
      mappedReason:
        'Fin Nifty spot data is restricted in external widgets. Displaying primary constituent (HDFC Bank).',
    };
  }

  if (
    norm === 'MIDCPNIFTY' ||
    norm === 'MIDCAPNIFTY' ||
    norm === 'NIFTYMIDSELECT' ||
    norm === 'NIFTYMIDCAP'
  ) {
    return {
      tradingViewSymbol: 'NSE:MID150BEES',
      isIndexMapped: true,
      displayName: 'MIDCAP NIFTY (via MID150BEES ETF)',
      underlying: 'MIDCAP NIFTY',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3AMIDCPNIFTY',
      mappedReason:
        'Midcap Nifty spot data is restricted in external widgets. Displaying Nippon Midcap 150 ETF.',
    };
  }

  if (norm === 'SENSEX' || norm === 'BSESENSEX' || norm === 'SENSEXINDEX') {
    return {
      tradingViewSymbol: 'BSE:SENSEXETF',
      isIndexMapped: true,
      displayName: 'BSE SENSEX (via SENSEXETF)',
      underlying: 'SENSEX',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=BSE%3ASENSEX',
      mappedReason:
        'BSE Sensex spot data is restricted in external widgets. Displaying Sensex ETF.',
    };
  }

  if (norm === 'BANKEX' || norm === 'BSEBANKEX') {
    return {
      tradingViewSymbol: 'NSE:BANKBEES',
      isIndexMapped: true,
      displayName: 'BSE BANKEX (via BANKBEES ETF)',
      underlying: 'BANKEX',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=BSE%3ABANKEX',
      mappedReason: 'Displaying Bank ETF for Bankex.',
    };
  }

  if (norm === 'CNXIT' || norm === 'NIFTYIT') {
    return {
      tradingViewSymbol: 'NSE:ITBEES',
      isIndexMapped: true,
      displayName: 'NIFTY IT (via ITBEES ETF)',
      underlying: 'NIFTY IT',
      rawIndexLink: 'https://www.tradingview.com/chart/?symbol=NSE%3ACNXIT',
      mappedReason: 'Displaying Nippon IT ETF for Nifty IT Index.',
    };
  }

  // Catch-all for any remaining index-like symbols that are restricted in embeds
  const isIndexLike =
    !clean.endsWith('BEES') &&
    !clean.endsWith('ETF') &&
    (norm.includes('NIFTY') ||
      norm.includes('SENSEX') ||
      norm.includes('BANKNIFTY') ||
      norm.includes('MIDCAP') ||
      norm.includes('FINNIFTY'));
  if (isIndexLike) {
    let tvSym = 'NSE:NIFTYBEES';
    let mappedUnder = 'NIFTY 50';
    if (norm.includes('BANK')) {
      tvSym = 'NSE:BANKBEES';
      mappedUnder = 'BANK NIFTY';
    } else if (norm.includes('SENSEX')) {
      tvSym = 'BSE:SENSEXETF';
      mappedUnder = 'SENSEX';
    } else if (norm.includes('MIDCAP')) {
      tvSym = 'NSE:MID150BEES';
      mappedUnder = 'MIDCAP NIFTY';
    } else if (norm.includes('FINNIFTY') || norm.includes('NIFTYFIN')) {
      tvSym = 'NSE:HDFCBANK';
      mappedUnder = 'FIN NIFTY';
    }
    return {
      tradingViewSymbol: tvSym,
      isIndexMapped: true,
      displayName: `${clean} (via ${tvSym.replace(/^[A-Z]+:/, '')})`,
      underlying: mappedUnder,
      rawIndexLink: `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(`${exg}:${clean}`)}`,
      mappedReason: 'Index data is restricted in external widgets. Displaying liquid benchmark ETF.',
    };
  }

  // 5. Standard Cash Equities (e.g. RELIANCE, TCS, INFY, SBIN)
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
  // Default to UNDERLYING so chart opens with a TradingView-supported symbol (avoids "only available on TradingView" errors).
  const [chartTarget, setChartTarget] = useState<'CONVERTED_OPTION' | 'UNDERLYING'>('UNDERLYING');
  const [isBreakdownOpen, setIsBreakdownOpen] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  // Sync internal symbol when external prop updates & ensure option opens via formula
  useEffect(() => {
    setCurrentSymbol(symbol);
    const converted = convertAngelOneToTradingViewSymbol(symbol, exchange);
    if (converted.isOption) {
      setChartTarget('UNDERLYING');
    }
  }, [symbol, exchange]);

  const symbolInfo = useMemo(
    () => resolveTradingViewSymbolInfo(currentSymbol, exchange),
    [currentSymbol, exchange]
  );

  // Determine active symbol for the TradingView widget:
  // When an option is opened, it uses the converted formula symbol (e.g. NSE:NIFTY261201C24900)
  const activeTvSymbol = useMemo(() => {
    if (chartTarget === 'UNDERLYING' && symbolInfo.underlyingTradingViewSymbol) {
      return symbolInfo.underlyingTradingViewSymbol;
    }
    if (symbolInfo.convertedOptionSymbol) {
      return symbolInfo.convertedOptionSymbol;
    }
    return symbolInfo.tradingViewSymbol;
  }, [chartTarget, symbolInfo.convertedOptionSymbol, symbolInfo.underlyingTradingViewSymbol, symbolInfo.tradingViewSymbol]);

  const handleSelectNewSymbol = (sym: string) => {
    setCurrentSymbol(sym);
    setChartTarget('UNDERLYING');
    setIsSearchOpen(false);
    setSearchInput('');
    if (onSymbolChange) {
      onSymbolChange(sym);
    }
  };

  // Modern TradingView Advanced Real-Time Chart Embed
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous widget
    container.innerHTML = '';

    const widgetHolder = document.createElement('div');
    widgetHolder.className = 'tradingview-widget-container__widget';
    widgetHolder.style.height = '100%';
    widgetHolder.style.width = '100%';

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;

    const studiesList = enableStudies
      ? [
          'RSI@tv-basicstudies',
          'MASimple@tv-basicstudies',
          'MACD@tv-basicstudies',
          'BB@tv-basicstudies',
        ]
      : [];

    const config = {
      autosize: true,
      symbol: activeTvSymbol,
      interval: interval,
      timezone: 'Asia/Kolkata',
      theme: theme,
      style: '1', // Candlestick
      locale: 'en',
      enable_publishing: false,
      allow_symbol_change: false,
      calendar: false,
      hide_side_toolbar: false,
      support_host: 'https://www.tradingview.com',
      studies: studiesList,
      overrides: {
        'paneProperties.background': theme === 'dark' ? '#0b0f19' : '#ffffff',
        'paneProperties.vertGridProperties.color': theme === 'dark' ? '#1f2937' : '#f3f4f6',
        'paneProperties.horzGridProperties.color': theme === 'dark' ? '#1f2937' : '#f3f4f6',
      },
    };

    script.innerHTML = JSON.stringify(config);

    container.appendChild(widgetHolder);
    container.appendChild(script);

    return () => {
      container.innerHTML = '';
    };
  }, [activeTvSymbol, interval, theme, enableStudies]);

  const toggleFullscreen = () => {
    setIsFullscreen((prev) => !prev);
  };

  const POPULAR_WATCHLIST = [
    { label: 'Nifty 50 (ETF)', sym: 'NSE:NIFTYBEES' },
    { label: 'Bank Nifty (ETF)', sym: 'NSE:BANKBEES' },
    { label: 'Reliance', sym: 'NSE:RELIANCE' },
    { label: 'Tata Steel', sym: 'NSE:TATASTEEL' },
    { label: 'SBI', sym: 'NSE:SBIN' },
    { label: 'HDFC Bank', sym: 'NSE:HDFCBANK' },
    { label: 'Infosys', sym: 'NSE:INFY' },
    { label: 'ICICI Bank', sym: 'NSE:ICICIBANK' },
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
          <div
            className={`p-1 rounded-lg ${
              symbolInfo.isDerivativeMapped
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-blue-500/20 text-blue-400'
            }`}
          >
            <BarChart2 className="w-4 h-4" />
          </div>
          <span className="font-bold text-white tracking-wide">
            {symbolInfo.displayName}
          </span>
          <span
            className={`text-[11px] px-2 py-0.5 rounded-md font-mono font-bold ${
              symbolInfo.isDerivativeMapped
                ? 'bg-purple-900/60 border border-purple-500/50 text-purple-200'
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            {activeTvSymbol} • {interval === 'D' ? '1D' : `${interval}m`}
          </span>

          {/* Live Price of this Share/Instrument */}
          {typeof livePrice === 'number' && livePrice > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-gray-950/90 border border-gray-700 font-mono text-[11px] ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-gray-400 font-sans">
                {symbolInfo.isDerivativeMapped ? 'Option LTP:' : 'Live Share:'}
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

          {/* If Option / Derivative: also show the live price of THAT SHARE (Underlying) */}
          {symbolInfo.isDerivativeMapped && typeof underlyingPrice === 'number' && underlyingPrice > 0 && (
            <div className="flex items-center space-x-1.5 px-2.5 py-0.5 rounded-lg bg-blue-950/60 border border-blue-500/40 font-mono text-[11px]">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
              <span className="text-blue-300 font-sans">
                {symbolInfo.underlying || 'Share'} Live:
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

          {/* Converted Symbol Breakdown Badge */}
          {symbolInfo.conversionBreakdown && (
            <button
              type="button"
              onClick={() => setIsBreakdownOpen((prev) => !prev)}
              className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-purple-950/70 hover:bg-purple-900/80 border border-purple-500/50 text-purple-200 text-[11px] font-mono transition-all ml-1 shadow-sm"
              title="Click to view Angel One ➔ TradingView symbol conversion breakdown"
            >
              <Layers className="w-3.5 h-3.5 text-purple-400" />
              <span>TV Ticker:</span>
              <strong className="text-white font-bold">{symbolInfo.convertedOptionSymbol}</strong>
            </button>
          )}

          {/* Chart Target Mode Toggle: Option Strike vs Underlying */}
          {symbolInfo.convertedOptionSymbol && (
            <div className="flex items-center bg-gray-950 p-0.5 rounded-lg border border-purple-500/40 text-[11px] ml-1">
              <button
                type="button"
                onClick={() => setChartTarget('CONVERTED_OPTION')}
                className={`px-2 py-0.5 rounded font-semibold transition-all ${
                  chartTarget === 'CONVERTED_OPTION'
                    ? 'bg-purple-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={`Chart Option Strike (${symbolInfo.convertedOptionSymbol})`}
              >
                Option Strike ({symbolInfo.convertedOptionSymbol.replace(/^NSE:/, '')})
              </button>
              <button
                type="button"
                onClick={() => setChartTarget('UNDERLYING')}
                className={`px-2 py-0.5 rounded font-semibold transition-all ${
                  chartTarget === 'UNDERLYING'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-gray-400 hover:text-white'
                }`}
                title={`Chart Underlying Benchmark (${symbolInfo.underlyingTradingViewSymbol?.replace(/^NSE:/, '') || 'Index'})`}
              >
                Underlying ({symbolInfo.underlyingTradingViewSymbol?.replace(/^NSE:/, '') || 'Index'})
              </button>
            </div>
          )}

          {/* Quick Symbol Switcher Button */}
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

        <div className="flex items-center space-x-2">
          <a
            href={
              chartTarget === 'CONVERTED_OPTION' && symbolInfo.conversionBreakdown?.fullTradingViewUrl
                ? symbolInfo.conversionBreakdown.fullTradingViewUrl
                : `https://www.tradingview.com/chart/?symbol=${encodeURIComponent(activeTvSymbol)}`
            }
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
              symbolInfo.isDerivativeMapped
                ? 'bg-purple-950/60 border-purple-500/40 text-purple-300 hover:text-white'
                : 'bg-blue-950/60 border-blue-500/40 text-blue-300 hover:text-white'
            }`}
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

      {/* Symbol Conversion Breakdown Card */}
      {isBreakdownOpen && symbolInfo.conversionBreakdown && (
        <div className="p-3.5 bg-gray-900 border-b border-purple-500/40 text-xs text-gray-300 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-purple-400" />
              <span className="font-bold text-white text-sm">Converted Symbol Breakdown</span>
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 font-mono">
                Angel One ➔ TradingView
              </span>
            </div>
            <button
              onClick={() => setIsBreakdownOpen(false)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
              <div className="text-gray-400 text-[10px] uppercase font-sans font-semibold">Underlying</div>
              <div className="flex items-center space-x-1.5 mt-1 font-bold">
                <span className="text-gray-400">{symbolInfo.conversionBreakdown.underlying}</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="text-white">{symbolInfo.conversionBreakdown.underlying}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
              <div className="text-gray-400 text-[10px] uppercase font-sans font-semibold">Expiry Date</div>
              <div className="flex items-center space-x-1.5 mt-1 font-bold">
                <span className="text-gray-400">{symbolInfo.conversionBreakdown.expiryDate.split('➔')[0]?.trim()}</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="text-purple-300">{symbolInfo.conversionBreakdown.expiryDate.split('➔')[1]?.trim()}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
              <div className="text-gray-400 text-[10px] uppercase font-sans font-semibold">Strike Price</div>
              <div className="flex items-center space-x-1.5 mt-1 font-bold">
                <span className="text-gray-400">{symbolInfo.conversionBreakdown.strike}</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="text-white">{symbolInfo.conversionBreakdown.strike}</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-gray-950 border border-gray-800">
              <div className="text-gray-400 text-[10px] uppercase font-sans font-semibold">Option Type</div>
              <div className="flex items-center space-x-1.5 mt-1 font-bold">
                <span className="text-gray-400">{symbolInfo.contractType}</span>
                <ArrowRight className="w-3 h-3 text-purple-400" />
                <span className="text-emerald-400">{symbolInfo.conversionBreakdown.optionType.split('➔')[1]?.trim()}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-gray-800/80">
            <div className="text-xs text-gray-300 flex items-center gap-2">
              <span className="text-gray-400">Full Converted Ticker:</span>
              <span className="px-2.5 py-1 rounded-lg bg-black/60 border border-purple-500/40 text-purple-200 font-mono font-bold">
                {symbolInfo.convertedOptionSymbol}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(symbolInfo.convertedOptionSymbol || '');
                  setIsCopied(true);
                  setTimeout(() => setIsCopied(false), 2000);
                }}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs border border-gray-700 transition-all"
              >
                {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{isCopied ? 'Copied Ticker!' : 'Copy TV Symbol'}</span>
              </button>

              {symbolInfo.tradingViewOptionLink && (
                <a
                  href={symbolInfo.tradingViewOptionLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-xs shadow-md transition-all"
                >
                  <span>Open TV Option Chart</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Symbol Switcher Modal / Dropdown */}
      {isSearchOpen && (
        <div className="p-3 bg-gray-900 border-b border-gray-800 space-y-2.5 text-xs animate-in fade-in duration-200">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-gray-300">Switch Chart Symbol:</span>
            <button
              onClick={() => setIsSearchOpen(false)}
              className="p-1 text-gray-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && searchInput.trim()) {
                    handleSelectNewSymbol(searchInput.trim());
                  }
                }}
                placeholder="Search symbol (e.g. RELIANCE, NIFTY, TATASTEEL, NIFTY 25000 PE)..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-gray-950 border border-gray-700 text-white text-xs focus:border-blue-500 focus:outline-none"
              />
            </div>
            <button
              onClick={() => {
                if (searchInput.trim()) handleSelectNewSymbol(searchInput.trim());
              }}
              className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-colors"
            >
              Apply
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="text-[10px] text-gray-400 uppercase font-semibold">Popular:</span>
            {POPULAR_WATCHLIST.map((item) => (
              <button
                key={item.sym}
                onClick={() => handleSelectNewSymbol(item.sym)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                  currentSymbol.toUpperCase() === item.sym.toUpperCase()
                    ? 'bg-blue-600 text-white border-blue-400'
                    : 'bg-gray-800 text-gray-300 border-gray-700 hover:bg-gray-700 hover:text-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Formula Conversion Ribbon */}
      {symbolInfo.conversionBreakdown && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-gradient-to-r from-purple-950/70 via-gray-900 to-purple-950/50 border-b border-purple-500/30 text-xs shrink-0">
          <div className="flex items-center space-x-2 flex-wrap gap-y-1">
            <span className="text-[10px] uppercase font-bold text-purple-300 bg-purple-900/60 border border-purple-500/40 px-2 py-0.5 rounded">
              Formula:
            </span>
            <span className="font-mono text-gray-300 bg-gray-950 px-2 py-0.5 rounded border border-gray-800">
              Angel One: <strong className="text-white">{symbolInfo.conversionBreakdown.brokerSymbol}</strong>
            </span>
            <ArrowRight className="w-3 h-3 text-purple-400" />
            <span className="font-mono text-purple-200 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-500/40 font-bold">
              TradingView: <strong className="text-white">{symbolInfo.conversionBreakdown.tradingViewSymbol}</strong>
            </span>
            <span className="text-[11px] text-gray-400 font-mono hidden md:inline">
              ({symbolInfo.conversionBreakdown.underlying} | {symbolInfo.conversionBreakdown.expiryDate} | {symbolInfo.conversionBreakdown.strike} | {symbolInfo.conversionBreakdown.optionType})
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              Active: <strong className="text-white font-mono">{activeTvSymbol}</strong>
            </span>
            <button
              type="button"
              onClick={() => setIsBreakdownOpen((prev) => !prev)}
              className="px-2 py-0.5 rounded bg-gray-800 hover:bg-gray-700 text-purple-300 border border-purple-500/30 text-[11px] font-medium"
            >
              Formula Table
            </button>
          </div>
        </div>
      )}

      {/* Licensing or Derivative Underlying Mapping Notice */}
      {(symbolInfo.isDerivativeMapped || symbolInfo.isIndexMapped) && (
        <div
          className={`px-4 py-2 border-b text-[11px] flex items-center justify-between shrink-0 ${
            symbolInfo.isDerivativeMapped
              ? 'bg-purple-950/50 border-purple-500/30 text-purple-200'
              : 'bg-blue-950/40 border-blue-500/20 text-blue-200'
          }`}
        >
          <div className="flex items-center space-x-1.5">
            <Info
              className={`w-3.5 h-3.5 shrink-0 ${
                symbolInfo.isDerivativeMapped ? 'text-purple-400' : 'text-blue-400'
              }`}
            />
            <span>{symbolInfo.mappedReason}</span>
          </div>
          {symbolInfo.rawIndexLink && (
            <a
              href={symbolInfo.rawIndexLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`underline font-semibold ml-2 shrink-0 ${
                symbolInfo.isDerivativeMapped
                  ? 'text-purple-300 hover:text-white'
                  : 'text-blue-300 hover:text-white'
              }`}
            >
              {symbolInfo.isDerivativeMapped ? 'View Underlying ↗' : 'View Spot Index ↗'}
            </a>
          )}
        </div>
      )}

      {/* TradingView Container */}
      <div
        ref={containerRef}
        className="w-full flex-1 tradingview-widget-container"
        style={{ height: '100%', minHeight: '380px' }}
      />
    </div>
  );
});

export default TradingViewChart;
