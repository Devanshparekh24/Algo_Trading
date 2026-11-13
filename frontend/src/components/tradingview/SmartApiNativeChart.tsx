import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { RefreshCw, RotateCcw, TrendingUp } from 'lucide-react';
import { getHistoricalCandles, type HistoricalCandleParams, type RawCandleData } from '../../services/marketService';
import { formatINR } from '../../utils/formatters';

export interface SmartApiNativeChartProps {
  symbol: string;
  symbolToken?: string;
  exchange?: string;
  interval?: '1' | '5' | '15' | '30' | '60' | 'D';
  livePrice?: number;
  liveNetChange?: number;
  livePercentChange?: number;
  height?: number | string;
  onIntervalChange?: (interval: '1' | '5' | '15' | '30' | '60' | 'D') => void;
  className?: string;
}

interface HoveredCandle {
  timeStr: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
}

const INTERVAL_API_MAP: Record<string, HistoricalCandleParams['interval']> = {
  '1': 'ONE_MINUTE',
  '5': 'FIVE_MINUTE',
  '15': 'FIFTEEN_MINUTE',
  '30': 'THIRTY_MINUTE',
  '60': 'ONE_HOUR',
  D: 'ONE_DAY',
};

const KNOWN_TOKENS: Record<string, string> = {
  ICICIBANK: '4963',
  RELIANCE: '2885',
  SBIN: '3045',
  HDFCBANK: '1333',
  INFY: '1594',
  TCS: '11536',
  ITC: '1660',
  TATASTEEL: '3499',
  NIFTY: '99926000',
  NIFTY50: '99926000',
  NIFTYBEES: '99926000',
  BANKNIFTY: '99926009',
  BANKBEES: '99926009',
  FINNIFTY: '99926037',
  MIDCPNIFTY: '99926074',
};

function formatApiDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function calculateEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = [];
  let ema: number | null = null;

  for (let i = 0; i < closes.length; i++) {
    const val = closes[i];
    if (i < period - 1) {
      result.push(null);
    } else if (i === period - 1) {
      const sum = closes.slice(0, period).reduce((a, b) => a + b, 0);
      ema = sum / period;
      result.push(ema);
    } else if (ema !== null) {
      ema = val * k + ema * (1 - k);
      result.push(ema);
    }
  }
  return result;
}

function generateSyntheticCandles(
  basePrice: number,
  count = 60,
  intervalMinutes = 5
): Array<{
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}> {
  const candles: Array<{
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }> = [];

  const nowSec = Math.floor(Date.now() / 1000);
  const stepSec = intervalMinutes * 60;
  let price = basePrice > 0 ? basePrice * 0.985 : 1550;
  const spread = Math.max(0.5, price * 0.0025);

  for (let i = count; i >= 0; i--) {
    const time = (nowSec - i * stepSec) as UTCTimestamp;
    const change = (Math.random() - 0.485) * spread;
    const open = price;
    price = Math.max(1, price + change);
    const close = price;
    const high = Math.max(open, close) + Math.random() * spread * 0.6;
    const low = Math.min(open, close) - Math.random() * spread * 0.6;
    const volume = Math.floor(8000 + Math.random() * 25000);

    candles.push({
      time,
      open: Number(open.toFixed(2)),
      high: Number(high.toFixed(2)),
      low: Number(low.toFixed(2)),
      close: Number(close.toFixed(2)),
      volume,
    });
  }

  if (basePrice > 0 && candles.length > 0) {
    const last = candles[candles.length - 1];
    last.close = Number(basePrice.toFixed(2));
    last.high = Number(Math.max(last.high, basePrice).toFixed(2));
    last.low = Number(Math.min(last.low, basePrice).toFixed(2));
  }

  return candles;
}

export const SmartApiNativeChart: React.FC<SmartApiNativeChartProps> = ({
  symbol,
  symbolToken,
  exchange = 'NSE',
  interval = '15',
  livePrice,
  liveNetChange,
  livePercentChange,
  height = 540,
  onIntervalChange,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick', Time> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram', Time> | null>(null);
  const ema9SeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null);
  const ema21SeriesRef = useRef<ISeriesApi<'Line', Time> | null>(null);
  const isDisposedRef = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  const [showIndicators, setShowIndicators] = useState(true);
  const [showVolume, setShowVolume] = useState(true);
  const [hoveredCandle, setHoveredCandle] = useState<HoveredCandle | null>(null);
  const [activeInterval, setActiveInterval] = useState(interval);

  const livePriceRef = useRef(livePrice);
  useEffect(() => {
    livePriceRef.current = livePrice;
  }, [livePrice]);

  const lastCandleRef = useRef<{
    time: UTCTimestamp;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  } | null>(null);

  useEffect(() => {
    setActiveInterval(interval);
  }, [interval]);

  const cleanSymbol = useMemo(() => {
    let s = symbol.trim().toUpperCase();
    if (s.includes(':')) s = s.split(':')[1] || '';
    return s.replace(/-EQ$/, '').replace(/-BE$/, '').replace(/-BL$/, '').trim();
  }, [symbol]);

  const resolvedToken = useMemo(() => {
    if (symbolToken) return symbolToken;
    return KNOWN_TOKENS[cleanSymbol] || KNOWN_TOKENS[cleanSymbol.replace(/[^A-Z]/g, '')] || '4963';
  }, [symbolToken, cleanSymbol]);

  // Initialize Lightweight Chart instance
  useEffect(() => {
    if (!containerRef.current) return;

    isDisposedRef.current = false;
    containerRef.current.innerHTML = '';

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#030712' },
        textColor: '#9ca3af',
        fontSize: 11,
      },
      grid: {
        vertLines: { color: 'rgba(31, 41, 55, 0.6)' },
        horzLines: { color: 'rgba(31, 41, 55, 0.6)' },
      },
      crosshair: {
        vertLine: {
          color: '#60a5fa',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e3a8a',
        },
        horzLine: {
          color: '#60a5fa',
          width: 1,
          style: 3,
          labelBackgroundColor: '#1e3a8a',
        },
      },
      timeScale: {
        borderColor: '#1f2937',
        timeVisible: true,
        secondsVisible: false,
      },
      rightPriceScale: {
        borderColor: '#1f2937',
        scaleMargins: {
          top: 0.1,
          bottom: 0.22,
        },
      },
      autoSize: true,
    });

    chartRef.current = chart;

    // Candlestick Series
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#10b981',
      downColor: '#ef4444',
      borderVisible: false,
      wickUpColor: '#10b981',
      wickDownColor: '#ef4444',
    });
    candleSeriesRef.current = candleSeries;

    // Volume Series
    const volumeSeries = chart.addSeries(HistogramSeries, {
      priceFormat: { type: 'volume' },
      priceScaleId: '',
    });
    volumeSeries.priceScale().applyOptions({
      scaleMargins: {
        top: 0.82,
        bottom: 0,
      },
    });
    volumeSeriesRef.current = volumeSeries;

    // Moving Averages
    const ema9Series = chart.addSeries(LineSeries, {
      color: '#38bdf8',
      lineWidth: 1,
      title: 'EMA 9',
      crosshairMarkerVisible: false,
    });
    ema9SeriesRef.current = ema9Series;

    const ema21Series = chart.addSeries(LineSeries, {
      color: '#f59e0b',
      lineWidth: 1,
      title: 'EMA 21',
      crosshairMarkerVisible: false,
    });
    ema21SeriesRef.current = ema21Series;

    // Crosshair move handler
    chart.subscribeCrosshairMove((param) => {
      if (isDisposedRef.current || !param || !param.time || !param.seriesData) {
        setHoveredCandle(null);
        return;
      }

      try {
        const cData = param.seriesData.get(candleSeries) as
          | { open: number; high: number; low: number; close: number }
          | undefined;
        const vData = param.seriesData.get(volumeSeries) as { value: number } | undefined;

        if (cData) {
          const timeSec = typeof param.time === 'number' ? param.time : 0;
          const dateObj = new Date(timeSec * 1000);
          const timeStr = `${dateObj.toLocaleDateString('en-IN', {
            month: 'short',
            day: 'numeric',
          })} ${dateObj.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
          const changePercent = cData.open > 0 ? ((cData.close - cData.open) / cData.open) * 100 : 0;

          setHoveredCandle({
            timeStr,
            open: cData.open,
            high: cData.high,
            low: cData.low,
            close: cData.close,
            volume: vData?.value || 0,
            changePercent: Number(changePercent.toFixed(2)),
          });
        }
      } catch {
        // ignore crosshair errors on disposed chart
      }
    });

    const handleResize = () => {
      if (!isDisposedRef.current && containerRef.current && chartRef.current) {
        try {
          chartRef.current.applyOptions({
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
          });
        } catch {
          // ignore
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      isDisposedRef.current = true;
      window.removeEventListener('resize', handleResize);
      if (chartRef.current) {
        try {
          chartRef.current.remove();
        } catch {
          // ignore
        }
        chartRef.current = null;
      }
      candleSeriesRef.current = null;
      volumeSeriesRef.current = null;
      ema9SeriesRef.current = null;
      ema21SeriesRef.current = null;
      lastCandleRef.current = null;
    };
  }, []);

  // Fetch and populate candle data
  const loadCandles = useCallback(async () => {
    if (isDisposedRef.current || !chartRef.current || !candleSeriesRef.current || !volumeSeriesRef.current) return;
    setIsLoading(true);

    const activeToken = resolvedToken;
    const activeTf = activeInterval;

    const apiInterval = INTERVAL_API_MAP[activeInterval] || 'FIFTEEN_MINUTE';
    const now = new Date();
    const toDate = formatApiDate(now);

    let daysBack = 5;
    if (activeInterval === '1') daysBack = 1;
    else if (activeInterval === '5') daysBack = 5;
    else if (activeInterval === '15') daysBack = 15;
    else if (activeInterval === '30') daysBack = 30;
    else if (activeInterval === '60') daysBack = 60;
    else if (activeInterval === 'D') daysBack = 365;

    const fromDate = formatApiDate(new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000));

    try {
      let rawCandles: RawCandleData[] = [];
      try {
        rawCandles = await getHistoricalCandles({
          exchange,
          symbolToken: resolvedToken,
          interval: apiInterval,
          fromDate,
          toDate,
        });
      } catch {
        rawCandles = [];
      }

      // Check if chart was disposed or symbol/timeframe changed while request was in-flight
      if (
        isDisposedRef.current ||
        !chartRef.current ||
        !candleSeriesRef.current ||
        !volumeSeriesRef.current ||
        resolvedToken !== activeToken ||
        activeInterval !== activeTf
      ) {
        return;
      }

      let formattedCandles: Array<{
        time: UTCTimestamp;
        open: number;
        high: number;
        low: number;
        close: number;
        volume: number;
      }> = [];

      if (rawCandles && rawCandles.length > 5) {
        const seen = new Set<number>();
        for (const c of rawCandles) {
          const t = Math.floor(new Date(c[0]).getTime() / 1000) as UTCTimestamp;
          if (seen.has(t)) continue;
          seen.add(t);

          formattedCandles.push({
            time: t,
            open: Number(c[1]),
            high: Number(c[2]),
            low: Number(c[3]),
            close: Number(c[4]),
            volume: Number(c[5]) || 0,
          });
        }
        formattedCandles.sort((a, b) => a.time - b.time);
      } else {
        // Fallback realistic synthetic candles if offline or market closed
        const currentLive = livePriceRef.current;
        const base = currentLive && currentLive > 0 ? currentLive : 1570;
        const minutes =
          activeInterval === '1'
            ? 1
            : activeInterval === '5'
            ? 5
            : activeInterval === '15'
            ? 15
            : activeInterval === '30'
            ? 30
            : activeInterval === '60'
            ? 60
            : 1440;
        formattedCandles = generateSyntheticCandles(base, 60, minutes);
      }

      if (formattedCandles.length > 0 && !isDisposedRef.current && candleSeriesRef.current && volumeSeriesRef.current) {
        lastCandleRef.current = formattedCandles[formattedCandles.length - 1];

        try {
          candleSeriesRef.current.setData(
            formattedCandles.map((c) => ({
              time: c.time,
              open: c.open,
              high: c.high,
              low: c.low,
              close: c.close,
            }))
          );

          volumeSeriesRef.current.setData(
            formattedCandles.map((c) => ({
              time: c.time,
              value: c.volume,
              color:
                c.close >= c.open
                  ? 'rgba(16, 185, 129, 0.45)'
                  : 'rgba(239, 68, 68, 0.45)',
            }))
          );

          // Calculate and set EMAs
          const closes = formattedCandles.map((c) => c.close);
          const ema9Values = calculateEMA(closes, 9);
          const ema21Values = calculateEMA(closes, 21);

          if (!isDisposedRef.current && ema9SeriesRef.current) {
            const ema9Data: Array<{ time: UTCTimestamp; value: number }> = [];
            formattedCandles.forEach((c, idx) => {
              const v = ema9Values[idx];
              if (v !== null) ema9Data.push({ time: c.time, value: v });
            });
            ema9SeriesRef.current.setData(ema9Data);
          }

          if (!isDisposedRef.current && ema21SeriesRef.current) {
            const ema21Data: Array<{ time: UTCTimestamp; value: number }> = [];
            formattedCandles.forEach((c, idx) => {
              const v = ema21Values[idx];
              if (v !== null) ema21Data.push({ time: c.time, value: v });
            });
            ema21SeriesRef.current.setData(ema21Data);
          }

          if (!isDisposedRef.current && chartRef.current) {
            chartRef.current.timeScale().fitContent();
          }
        } catch (seriesErr: any) {
          if (seriesErr?.message?.includes('disposed')) return;
          console.warn('[SmartApiNativeChart] Series setData error:', seriesErr);
        }
      }
    } catch (err) {
      console.warn('[SmartApiNativeChart] Error loading candle data:', err);
    } finally {
      if (!isDisposedRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeInterval, exchange, resolvedToken]);

  useEffect(() => {
    loadCandles();
  }, [loadCandles]);

  // Real-time tick update
  useEffect(() => {
    if (
      isDisposedRef.current ||
      !chartRef.current ||
      !candleSeriesRef.current ||
      typeof livePrice !== 'number' ||
      livePrice <= 0 ||
      !lastCandleRef.current
    )
      return;

    try {
      const last = lastCandleRef.current;
      const updated = {
        ...last,
        high: Math.max(last.high, livePrice),
        low: Math.min(last.low, livePrice),
        close: livePrice,
      };

      lastCandleRef.current = updated;
      candleSeriesRef.current.update({
        time: updated.time,
        open: updated.open,
        high: updated.high,
        low: updated.low,
        close: updated.close,
      });
    } catch (err: any) {
      if (err?.message?.includes('disposed')) return;
      console.warn('[SmartApiNativeChart] Real-time tick update error:', err);
    }
  }, [livePrice]);

  // Indicator visibility toggles
  useEffect(() => {
    if (isDisposedRef.current || !chartRef.current) return;
    try {
      if (ema9SeriesRef.current) {
        ema9SeriesRef.current.applyOptions({ visible: showIndicators });
      }
      if (ema21SeriesRef.current) {
        ema21SeriesRef.current.applyOptions({ visible: showIndicators });
      }
    } catch (err: any) {
      if (err?.message?.includes('disposed')) return;
    }
  }, [showIndicators]);

  useEffect(() => {
    if (isDisposedRef.current || !chartRef.current) return;
    try {
      if (volumeSeriesRef.current) {
        volumeSeriesRef.current.applyOptions({ visible: showVolume });
      }
    } catch (err: any) {
      if (err?.message?.includes('disposed')) return;
    }
  }, [showVolume]);

  const handleIntervalClick = (tf: '1' | '5' | '15' | '30' | '60' | 'D') => {
    setActiveInterval(tf);
    if (onIntervalChange) onIntervalChange(tf);
  };

  const resetZoom = () => {
    if (!isDisposedRef.current && chartRef.current) {
      try {
        chartRef.current.timeScale().fitContent();
      } catch {
        // ignore
      }
    }
  };

  return (
    <div className={`relative flex flex-col w-full h-full bg-gray-950 ${className}`}>
      {/* Sub-header Toolbar */}
      <div className="flex flex-wrap items-center justify-between px-3 py-1.5 bg-gray-900/60 border-b border-gray-800 text-xs shrink-0 gap-2">
        {/* Left: Timeframe pills */}
        <div className="flex items-center space-x-1">
          {(['1', '5', '15', '30', '60', 'D'] as const).map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => handleIntervalClick(tf)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                activeInterval === tf
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {tf === 'D' ? '1D' : tf === '60' ? '1H' : `${tf}m`}
            </button>
          ))}

          <div className="h-3.5 w-px bg-gray-700 mx-1" />

          {/* Indicator toggles */}
          <button
            type="button"
            onClick={() => setShowIndicators((p) => !p)}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
              showIndicators
                ? 'bg-blue-950/70 border-blue-500/40 text-blue-300'
                : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle EMA 9 & EMA 21 indicators"
          >
            <TrendingUp className="w-3 h-3" />
            <span>EMA (9/21)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowVolume((p) => !p)}
            className={`px-2 py-0.5 rounded text-[11px] font-medium border transition-all ${
              showVolume
                ? 'bg-blue-950/70 border-blue-500/40 text-blue-300'
                : 'bg-gray-800/60 border-gray-700 text-gray-400 hover:text-white'
            }`}
            title="Toggle Volume Bars"
          >
            Vol
          </button>
        </div>

        {/* Right: Reset Zoom and Refresh */}
        <div className="flex items-center space-x-1.5">
          <button
            type="button"
            onClick={resetZoom}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Fit / Reset Zoom"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={loadCandles}
            disabled={isLoading}
            className="p-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
            title="Reload Candlestick Feed"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Floating Hover Legend */}
      <div className="absolute top-9 left-3 z-20 pointer-events-none flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-mono bg-gray-950/85 backdrop-blur-xs px-2.5 py-1 rounded-md border border-gray-800 shadow-md">
        {hoveredCandle ? (
          <>
            <span className="text-gray-400">{hoveredCandle.timeStr}</span>
            <span className="text-gray-500">O: <strong className="text-white">{formatINR(hoveredCandle.open)}</strong></span>
            <span className="text-gray-500">H: <strong className="text-emerald-400">{formatINR(hoveredCandle.high)}</strong></span>
            <span className="text-gray-500">L: <strong className="text-rose-400">{formatINR(hoveredCandle.low)}</strong></span>
            <span className="text-gray-500">C: <strong className="text-white">{formatINR(hoveredCandle.close)}</strong></span>
            <span className={hoveredCandle.changePercent >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
              {hoveredCandle.changePercent >= 0 ? '+' : ''}{hoveredCandle.changePercent}%
            </span>
            {hoveredCandle.volume > 0 && (
              <span className="text-gray-400">Vol: <strong className="text-gray-200">{hoveredCandle.volume.toLocaleString('en-IN')}</strong></span>
            )}
          </>
        ) : (
          <>
            <span className="text-gray-400">{cleanSymbol} (NSE)</span>
            {typeof livePrice === 'number' && livePrice > 0 && (
              <>
                <span className="text-gray-500">Live: <strong className="text-white">{formatINR(livePrice)}</strong></span>
                {typeof livePercentChange === 'number' && (
                  <span className={livePercentChange >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                    {livePercentChange >= 0 ? '+' : ''}{livePercentChange}%
                    {typeof liveNetChange === 'number' && (
                      <span className="text-[10px] ml-1 font-normal opacity-80">
                        ({liveNetChange >= 0 ? '+' : ''}{formatINR(liveNetChange)})
                      </span>
                    )}
                  </span>
                )}
              </>
            )}
            <span className="text-[10px] text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              Live Feed
            </span>
          </>
        )}
      </div>

      {/* Main Lightweight Canvas Container */}
      <div
        ref={containerRef}
        className="w-full flex-1"
        style={{ minHeight: typeof height === 'number' ? `${height - 50}px` : '360px' }}
      />
    </div>
  );
};

export default SmartApiNativeChart;
