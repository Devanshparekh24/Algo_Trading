// ---------------------------------------------------------------------------
// Black-Scholes Greeks Engine & Greek Momentum Sniper Filters
// ---------------------------------------------------------------------------

import { isContractExpired } from "../../utils/expiryUtils.js";

export interface OptionGreeks {
  delta: number;
  gamma: number;
  theta: number; // Daily theta decay in ₹ INR
  vega: number;
  iv: number; // In percent e.g. 14.5%
  thetaPremiumRatio: number; // |Theta| / Premium
  isGreekEligible: boolean; // Delta 0.30-0.50, Theta/Premium < 0.15
}

export interface GreekEnrichedOption {
  symbolToken: string;
  tradingSymbol: string;
  name: string;
  instrumentType: "CE" | "PE" | "FUT";
  strike: number | null;
  expiry: string;
  ltp: number;
  netChange: number;
  percentChange: number;
  open?: number | undefined;
  high?: number | undefined;
  low?: number | undefined;
  close?: number | undefined;
  tradeVolume?: number | undefined;
  opnInterest?: number | undefined;
  exchange: string;
  greeks: OptionGreeks;
  lotSize: number;
  lotCost: number;
  rank: number;
}

// ---------------------------------------------------------------------------
// Normal Distribution Math Helpers
// ---------------------------------------------------------------------------

function erf(x: number): number {
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);
  const t = 1.0 / (1.0 + p * absX);
  const y =
    1.0 -
    ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return sign * y;
}

export function normalCdf(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2));
}

export function normalPdf(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

// ---------------------------------------------------------------------------
// Days to Expiration (DTE) Helper
// ---------------------------------------------------------------------------

const MONTH_MAP: Record<string, number> = {
  JAN: 0,
  FEB: 1,
  MAR: 2,
  APR: 3,
  MAY: 4,
  JUN: 5,
  JUL: 6,
  AUG: 7,
  SEP: 8,
  OCT: 9,
  NOV: 10,
  DEC: 11,
};

export function parseExpiryToDte(expiryStr?: string): number {
  if (!expiryStr || expiryStr === "NEAR" || expiryStr === "CURRENT") {
    return 3.0; // Default 3 days to weekly expiry
  }

  try {
    // Pattern: 07NOV2024 or 28NOV24 or 07-NOV-2024
    const clean = expiryStr.toUpperCase().replace(/-/g, "");
    const match = clean.match(/^(\d{1,2})([A-Z]{3})(\d{2,4})$/);
    if (match && match[1] && match[2] && match[3]) {
      const day = parseInt(match[1]);
      const monthStr = match[2];
      let year = parseInt(match[3]);
      if (year < 100) year += 2000;

      const month = MONTH_MAP[monthStr];
      if (month !== undefined) {
        // Expiry at 15:30 IST
        const expiryDate = new Date(Date.UTC(year, month, day, 10, 0, 0));
        const diffMs = expiryDate.getTime() - Date.now();
        const days = diffMs / (1000 * 60 * 60 * 24);
        return Math.max(0.1, days);
      }
    }
  } catch (err) {
    // fallback
  }

  return 3.5;
}

// ---------------------------------------------------------------------------
// Implied Volatility (IV) Numerical Solver
// ---------------------------------------------------------------------------

export function calculateImpliedVolatility(
  marketPrice: number,
  spotPrice: number,
  strikePrice: number,
  timeYears: number,
  rate = 0.07,
  isCall = true
): number {
  if (marketPrice <= 0 || timeYears <= 0 || spotPrice <= 0 || strikePrice <= 0) {
    return 0.15; // default 15%
  }

  // Brenner-Subrahmanyam initial approximation
  let sigma = Math.sqrt((2 * Math.PI) / timeYears) * (marketPrice / spotPrice);
  if (isNaN(sigma) || sigma < 0.05) sigma = 0.18;
  if (sigma > 2.0) sigma = 0.40;

  for (let i = 0; i < 20; i++) {
    const sqrtT = Math.sqrt(timeYears);
    const d1 =
      (Math.log(spotPrice / strikePrice) + (rate + 0.5 * sigma * sigma) * timeYears) /
      (sigma * sqrtT);
    const d2 = d1 - sigma * sqrtT;

    const price = isCall
      ? spotPrice * normalCdf(d1) - strikePrice * Math.exp(-rate * timeYears) * normalCdf(d2)
      : strikePrice * Math.exp(-rate * timeYears) * normalCdf(-d2) - spotPrice * normalCdf(-d1);

    const vega = spotPrice * normalPdf(d1) * sqrtT;
    const diff = price - marketPrice;

    if (Math.abs(diff) < 0.02 || Math.abs(vega) < 1e-6) break;

    sigma -= diff / vega;
    if (sigma <= 0.01) sigma = 0.01;
    if (sigma > 3.0) sigma = 3.0;
  }

  return Math.max(0.05, Math.min(2.5, sigma));
}

// ---------------------------------------------------------------------------
// Black-Scholes Greeks Calculation
// ---------------------------------------------------------------------------

export function calculateOptionGreeks(params: {
  spotPrice: number;
  strikePrice: number;
  marketPrice: number;
  timeToExpiryDays: number;
  isCall: boolean;
  rate?: number;
  knownIv?: number;
}): OptionGreeks {
  const {
    spotPrice,
    strikePrice,
    marketPrice,
    timeToExpiryDays,
    isCall,
    rate = 0.07,
    knownIv,
  } = params;

  const S = Math.max(1, spotPrice);
  const K = Math.max(1, strikePrice);
  const P = Math.max(0.05, marketPrice);
  const T = Math.max(0.001, timeToExpiryDays / 365.0);

  // Solve IV if not given
  const sigma =
    knownIv && knownIv > 0
      ? knownIv / 100.0
      : calculateImpliedVolatility(P, S, K, T, rate, isCall);

  const sqrtT = Math.sqrt(T);
  const d1 =
    (Math.log(S / K) + (rate + 0.5 * sigma * sigma) * T) / (sigma * sqrtT);
  const d2 = d1 - sigma * sqrtT;

  const Nd1 = normalCdf(d1);
  const Nd2 = normalCdf(d2);
  const pdfD1 = normalPdf(d1);

  // 1. Delta
  const deltaRaw = isCall ? Nd1 : Nd1 - 1;
  const delta = Number(deltaRaw.toFixed(3));

  // 2. Gamma
  const gammaRaw = pdfD1 / (S * sigma * sqrtT);
  const gamma = Number(gammaRaw.toFixed(6));

  // 3. Theta (Annualized / 365 for 1-day decay in ₹)
  let annualTheta = 0;
  if (isCall) {
    annualTheta =
      -(S * pdfD1 * sigma) / (2 * sqrtT) -
      rate * K * Math.exp(-rate * T) * Nd2;
  } else {
    annualTheta =
      -(S * pdfD1 * sigma) / (2 * sqrtT) +
      rate * K * Math.exp(-rate * T) * normalCdf(-d2);
  }
  const dailyTheta = Number((annualTheta / 365.0).toFixed(2));

  // 4. Vega (1% change in IV)
  const vega = Number(((S * pdfD1 * sqrtT) / 100.0).toFixed(2));

  // 5. Theta / Premium Ratio
  const thetaPremiumRatio = Number((Math.abs(dailyTheta) / P).toFixed(3));

  // 6. Greek Eligibility Check:
  // Rule 1: Delta between 0.30 and 0.50 (for Call: 0.30 - 0.50, for Put: -0.50 - -0.30)
  const absDelta = Math.abs(delta);
  const isDeltaValid = absDelta >= 0.28 && absDelta <= 0.52;
  // Rule 3: Theta / Premium ratio < 0.15
  const isThetaValid = thetaPremiumRatio <= 0.16;

  const isGreekEligible = isDeltaValid && isThetaValid;

  return {
    delta,
    gamma,
    theta: dailyTheta,
    vega,
    iv: Number((sigma * 100).toFixed(1)),
    thetaPremiumRatio,
    isGreekEligible,
  };
}

// ---------------------------------------------------------------------------
// Golden Hours / Momentum Trading Windows Filter
// ---------------------------------------------------------------------------

export interface GoldenHoursStatus {
  isGoldenHour: boolean;
  windowName: string;
  isLunchChop: boolean;
  message: string;
}

export function checkGoldenHours(date = new Date()): GoldenHoursStatus {
  // Convert UTC to IST (+5:30)
  const utc = date.getTime() + date.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 3600000 * 5.5);

  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const timeNum = hours * 60 + minutes;

  const marketOpen = 9 * 60 + 15;     // 09:15
  const morningStart = 9 * 60 + 35;   // 09:35
  const morningEnd = 11 * 60 + 0;     // 11:00
  const lunchStart = 11 * 60 + 30;    // 11:30
  const lunchEnd = 13 * 60 + 15;      // 13:15
  const afternoonStart = 13 * 60 + 30;// 13:30
  const afternoonEnd = 15 * 60 + 0;   // 15:00
  const marketClose = 15 * 60 + 30;   // 15:30

  if (timeNum < marketOpen || timeNum > marketClose) {
    return {
      isGoldenHour: false,
      windowName: "MARKET_CLOSED",
      isLunchChop: false,
      message: "Market is currently closed (Trading hours: 09:15 AM - 03:30 PM IST).",
    };
  }

  // Morning Golden Window (09:35 - 11:00)
  if (timeNum >= morningStart && timeNum <= morningEnd) {
    return {
      isGoldenHour: true,
      windowName: "MORNING_MOMENTUM",
      isLunchChop: false,
      message: "⚡ Morning Momentum Window Active (09:35 AM - 11:00 AM) — High Greek Alpha & Liquidity.",
    };
  }

  // Afternoon Trend Window (13:30 - 15:00)
  if (timeNum >= afternoonStart && timeNum <= afternoonEnd) {
    return {
      isGoldenHour: true,
      windowName: "AFTERNOON_TREND",
      isLunchChop: false,
      message: "🚀 Afternoon Trend Window Active (01:30 PM - 03:00 PM) — Institutional Follow-through & Gamma Acceleration.",
    };
  }

  // Theta Trap / Lunch Chop (11:30 - 13:15)
  if (timeNum >= lunchStart && timeNum <= lunchEnd) {
    return {
      isGoldenHour: false,
      windowName: "LUNCH_THETA_TRAP",
      isLunchChop: true,
      message: "⚠️ Lunch Theta Trap (11:30 AM - 01:15 PM) — Low momentum, high theta bleed. Auto-Pilot paused.",
    };
  }

  return {
    isGoldenHour: false,
    windowName: "NORMAL_HOURS",
    isLunchChop: false,
    message: "Standard Market Hours — Moderate momentum.",
  };
}

// ---------------------------------------------------------------------------
// Greek Momentum Sniper Strike Filter
// ---------------------------------------------------------------------------

export function filterAndRankGreekSniperStrikes(params: {
  candidates: Array<{
    symbolToken: string;
    tradingSymbol: string;
    name: string;
    instrumentType: "CE" | "PE" | "FUT";
    strike: number | null;
    expiry: string;
    ltp: number;
    netChange: number;
    percentChange: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    tradeVolume?: number;
    opnInterest?: number;
    lotSize?: number;
    lotsize?: string | number;
    exchange: string;
  }>;
  spotPrice: number;
  spotTrend: "BULLISH" | "BEARISH" | "NEUTRAL";
  budget: number;
  minPremium?: number; // default 25
  maxPremium?: number; // default 75
}): GreekEnrichedOption[] {
  const {
    candidates,
    spotPrice,
    spotTrend,
    budget,
    minPremium = 25,
    maxPremium = 75,
  } = params;

  const enriched: GreekEnrichedOption[] = [];

  for (const item of candidates) {
    // Expiry Guard: Never analyze or rank expired option contracts
    if (isContractExpired(item.expiry, item.tradingSymbol)) continue;

    // Only analyze options
    if (item.instrumentType !== "CE" && item.instrumentType !== "PE") continue;
    if (!item.strike || item.strike <= 0) continue;
    if (item.ltp <= 0) continue;

    const lotSize =
      typeof item.lotSize === "number" && item.lotSize > 0
        ? item.lotSize
        : typeof item.lotsize === "string" && parseInt(item.lotsize, 10) > 0
        ? parseInt(item.lotsize, 10)
        : typeof item.lotsize === "number" && item.lotsize > 0
        ? item.lotsize
        : item.tradingSymbol.startsWith("BANKNIFTY")
        ? 30
        : item.tradingSymbol.startsWith("NIFTY")
        ? 65
        : 1;
    const lotCost = Math.round(item.ltp * lotSize);

    // Step 1: Budget allocation check (must be affordable within budget)
    if (budget > 0 && lotCost > budget) continue;

    // Step 2: Price range filter (₹25 to ₹75 by default)
    if (item.ltp < minPremium || item.ltp > maxPremium) continue;

    // Step 4: Directional alignment with underlying spot trend
    if (spotTrend === "BULLISH" && item.instrumentType !== "CE") continue;
    if (spotTrend === "BEARISH" && item.instrumentType !== "PE") continue;

    // Step 3: Compute Black-Scholes Greeks
    const isCall = item.instrumentType === "CE";
    const dte = parseExpiryToDte(item.expiry);
    const greeks = calculateOptionGreeks({
      spotPrice,
      strikePrice: item.strike,
      marketPrice: item.ltp,
      timeToExpiryDays: dte,
      isCall,
    });

    // Rule 1: Delta between 0.30 and 0.50 (with tolerance 0.25 - 0.55)
    const absDelta = Math.abs(greeks.delta);
    if (absDelta < 0.25 || absDelta > 0.55) continue;

    // Rule 3: Theta / Premium ratio < 0.25 (caps daily theta bleed)
    if (greeks.thetaPremiumRatio > 0.25) continue;

    enriched.push({
      ...item,
      greeks,
      lotSize,
      lotCost,
      rank: 0,
    });
  }

  // Rule 2: Gamma in Top 3 highest candidate strikes (Max acceleration)
  enriched.sort((a, b) => b.greeks.gamma - a.greeks.gamma);

  // Return Top 3 Gamma strikes with assigned rank
  return enriched.slice(0, 3).map((item, idx) => ({
    ...item,
    rank: idx + 1,
  }));
}
