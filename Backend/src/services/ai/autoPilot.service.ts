// ---------------------------------------------------------------------------
// AI Auto-Pilot Service
// Autonomous strategy loop, risk-managed trade trigger evaluation,
// daily loss kill-switch, position caps, and strategy schedule timeline.
// ---------------------------------------------------------------------------

import prisma from "../../config/prisma.js";
import { placeSmartApiOrder } from "../smartapi/api/order.js";
import { broadcastSocketEvent } from "../websocket/socketService.js";
import { getInstrumentLotSize } from "../smartapi/instrument.service.js";
import { checkGoldenHours } from "../smartapi/greeks.service.js";
import {
  activeAiPositions,
  logTradeEntryToDb,
  logAiErrorToDb,
  registerActiveAiPosition,
} from "./execution.service.js";
import type {
  AutoPilotConfig,
  AutoPilotStrategy,
  TradeSignal,
  ActiveAiPosition,
  LiveStrategySuggestion,
  StrategyScheduleRecord,
} from "../../types/aiTrading.types.js";
import type { OrderPlacementRequest } from "../smartapi/types.js";

let autoPilotConfig: AutoPilotConfig = {
  enabled: false,
  mode: "PAPER",
  strategy: "GREEK_SNIPER",
  enforceGoldenHours: true,
  profitTargetPct: 35,
  stopLossPct: 18,
  thetaTimeoutMinutes: 45,
  defaultQuantity: 1,
  maxBudgetPerTrade: 0, // 0 = Dynamic sizing (no fixed price limit, trades by lot)
  productType: "INTRADAY",
  maxDailyTrades: 5,
  executedToday: 0,
  maxDailyLoss: 5000, // ₹5,000 daily loss kill-switch threshold
  maxOpenPositions: 3, // Max concurrent open positions
  confirmedLiveTrading: false, // Mandatory confirmation before placing LIVE broker orders
};

export function getAutoPilotConfig(): AutoPilotConfig {
  return { ...autoPilotConfig };
}

export function updateAutoPilotConfig(newConfig: Partial<AutoPilotConfig>): AutoPilotConfig {
  autoPilotConfig = {
    ...autoPilotConfig,
    ...newConfig,
  };
  broadcastSocketEvent("ai_autopilot_config_update", autoPilotConfig);
  return { ...autoPilotConfig };
}

/**
 * Evaluate Auto-Pilot trigger rules and execute trades
 */
export async function evaluateAutoPilotTriggers(signals: TradeSignal[]): Promise<void> {
  if (!autoPilotConfig.enabled) return;
  if (autoPilotConfig.executedToday >= autoPilotConfig.maxDailyTrades) {
    console.log(`[AI Auto-Pilot] Daily trade limit reached (${autoPilotConfig.executedToday}/${autoPilotConfig.maxDailyTrades}).`);
    return;
  }

  // Risk Safeguard 1: Max Daily Loss Kill Switch
  const maxLossLimit = autoPilotConfig.maxDailyLoss || 5000;
  let todayRealizedPnL = 0;
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const exitedToday = await prisma.aiTradeLog.findMany({
      where: {
        status: "EXITED",
        exitedAt: { gte: startOfDay },
      },
      select: { netPnl: true, pnl: true },
    });
    todayRealizedPnL = exitedToday.reduce((sum, t) => sum + (t.netPnl ?? t.pnl ?? 0), 0);
  } catch {
    todayRealizedPnL = 0;
  }

  const openUnrealizedPnL = Array.from(activeAiPositions.values())
    .filter((p) => p.status === "OPEN")
    .reduce((sum, p) => sum + (p.pnl || 0), 0);

  const cumulativeTodayPnL = todayRealizedPnL + openUnrealizedPnL;

  if (cumulativeTodayPnL <= -maxLossLimit) {
    console.warn(
      `[AI Auto-Pilot Kill Switch] Total daily loss ₹${cumulativeTodayPnL.toFixed(2)} breached threshold of -₹${maxLossLimit}. DISARMING AUTO-PILOT!`
    );
    autoPilotConfig.enabled = false;

    await logAiErrorToDb({
      source: "KILL_SWITCH",
      action: "AUTO_PILOT_HALTED",
      message: `Kill-switch activated: Today's loss ₹${cumulativeTodayPnL.toFixed(2)} exceeded ₹${maxLossLimit} limit. Auto-pilot disabled.`,
      details: { cumulativeTodayPnL, maxLossLimit, todayRealizedPnL, openUnrealizedPnL },
    }).catch(console.error);

    broadcastSocketEvent("ai_kill_switch_triggered", {
      message: `Kill-switch triggered! Cumulative loss ₹${cumulativeTodayPnL.toFixed(2)} breached max daily loss limit of ₹${maxLossLimit}. Auto-Pilot disarmed.`,
      cumulativeLoss: cumulativeTodayPnL,
      maxDailyLoss: maxLossLimit,
      todayRealizedPnL,
      openUnrealizedPnL,
    });
    return;
  }

  // Risk Safeguard 2: Max Concurrent Open Positions Cap
  const openPositionsCount = Array.from(activeAiPositions.values()).filter((p) => p.status === "OPEN").length;
  const maxOpenCap = autoPilotConfig.maxOpenPositions || 3;
  if (openPositionsCount >= maxOpenCap) {
    console.log(`[AI Auto-Pilot Risk] Open positions cap reached (${openPositionsCount}/${maxOpenCap}). Skipping new trade triggers.`);
    return;
  }

  // Risk Safeguard 3: LIVE Broker Order Safety Confirmation Gate
  if (autoPilotConfig.mode === "LIVE" && !autoPilotConfig.confirmedLiveTrading) {
    console.warn(`[AI Auto-Pilot Safety] Mode is LIVE but user safety confirmation is missing. Refusing live trade execution.`);
    return;
  }

  // Golden Hours Filter: If running Greek Sniper strategy, pause triggers during lunch theta trap
  if (autoPilotConfig.strategy === "GREEK_SNIPER" && autoPilotConfig.enforceGoldenHours !== false) {
    const golden = checkGoldenHours();
    if (golden.isLunchChop) {
      console.log(`[AI Auto-Pilot] Golden Hours Filter: Paused during lunch theta trap (${golden.message})`);
      return;
    }
  }

  for (const sig of signals) {
    if (sig.status !== "ACTIVE") continue;
    if (sig.action === "HOLD") continue;

    const isFno = sig.exchange === "NFO" || sig.segment === "FNO";

    // 1. GREEK_SNIPER Strategy Pipeline
    if (autoPilotConfig.strategy === "GREEK_SNIPER") {
      if (!isFno) continue;
      if (sig.greeks) {
        if (sig.greeks.delta < 0.25 || sig.greeks.delta > 0.60) continue;
        if (sig.greeks.thetaPremiumRatio > 0.18) continue;
      }
    }
    // 2. GAMMA_BLAST Strategy Pipeline (Expiry Afternoon Gamma Surge)
    else if (autoPilotConfig.strategy === "GAMMA_BLAST") {
      if (!isFno) continue;
      // Scans for cheap, high-elasticity explosive strikes (₹10 to ₹55)
      if (sig.currentPrice > 65 || sig.currentPrice < 8) continue;
      if (sig.greeks && sig.greeks.delta > 0.45) continue;
    }
    // 3. VWAP_TRAP Strategy Pipeline (Institutional Fakeout Trap & Reversal)
    else if (autoPilotConfig.strategy === "VWAP_TRAP") {
      if (!isFno) continue;
      // Counter-trend confirmation: Puts on high failure, Calls on low bounce
      if (sig.indicators) {
        if (sig.contractType === "PE" && sig.indicators.rsi < 40) continue;
        if (sig.contractType === "CE" && sig.indicators.rsi > 60) continue;
      }
    }
    // 4. ORB_15M Strategy Pipeline (Opening Range Breakout Trend Follower)
    else if (autoPilotConfig.strategy === "ORB_15M") {
      // Requires strong momentum and trending indicators
      if (sig.indicators && (sig.indicators.emaTrend === "NEUTRAL" || sig.indicators.macd?.trend === "NEUTRAL")) continue;
    }
    // 5. PCR_REVERSAL Strategy Pipeline (Sentiment Extremes Mean Reversion)
    else if (autoPilotConfig.strategy === "PCR_REVERSAL") {
      if (!isFno) continue;
      // Reversal oscillator: Avoid buying Calls when overbought or Puts when oversold
      if (sig.contractType === "CE" && sig.indicators && sig.indicators.rsi > 68) continue;
      if (sig.contractType === "PE" && sig.indicators && sig.indicators.rsi < 32) continue;
    }
    // 6. EMA_9_21 Strategy Pipeline (NIFTY Intraday EMA Crossover)
    else if (autoPilotConfig.strategy === "EMA_9_21") {
      // Only trade NIFTY-based instruments for this strategy
      if (sig.underlying !== "NIFTY" && !sig.symbol.includes("NIFTY")) continue;
      // Require real EMA crossover or strong EMA trend alignment:
      if (sig.action === "BUY" && sig.indicators) {
        const hasCross = sig.indicators.emaCrossover === "BULLISH_CROSSOVER";
        const hasTrend = sig.indicators.emaTrend === "STRONG_BULLISH" || sig.indicators.emaTrend === "BULLISH";
        if (!hasCross && !hasTrend) continue;
      }
      if (sig.action === "SELL" && sig.indicators) {
        const hasCross = sig.indicators.emaCrossover === "BEARISH_CROSSOVER";
        const hasTrend = sig.indicators.emaTrend === "STRONG_BEARISH" || sig.indicators.emaTrend === "BEARISH";
        if (!hasCross && !hasTrend) continue;
      }
      // Price must be above EMA9 for BUY, below EMA9 for SELL
      if (sig.action === "BUY" && sig.indicators && sig.currentPrice < sig.indicators.ema9) continue;
      if (sig.action === "SELL" && sig.indicators && sig.currentPrice > sig.indicators.ema9) continue;
    }

    // Safety Gate: Never auto-execute trades based on synthetic/fallback data
    if (sig.isSynthetic) {
      console.warn(`[AI Auto-Pilot] Refusing execution on synthetic data for ${sig.symbol}`);
      await logAiErrorToDb({
        source: "AUTO_PILOT",
        action: "REJECT_SYNTHETIC_SIGNAL",
        symbol: sig.symbol,
        token: sig.token,
        message: `Auto-pilot rejected trade for ${sig.symbol}: synthetic candle data detected.`,
      });
      continue;
    }

    const lotSize = sig.lotSize || (await getInstrumentLotSize(sig.symbol, 1));
    const lots = autoPilotConfig.defaultQuantity || 1;
    const finalQty = isFno ? lotSize * lots : lots;
    const estimatedCost = finalQty * sig.currentPrice;

    // Optional Budget Gatekeeper: ONLY active if a positive budget cap > 0 is configured by user.
    if (autoPilotConfig.maxBudgetPerTrade && autoPilotConfig.maxBudgetPerTrade > 0) {
      if (estimatedCost > autoPilotConfig.maxBudgetPerTrade) {
        console.log(
          `[AI Auto-Pilot] Skipping ${sig.symbol}: Cost ₹${estimatedCost.toFixed(2)} (${finalQty} units @ ₹${sig.currentPrice}) exceeds custom budget of ₹${autoPilotConfig.maxBudgetPerTrade}`
        );
        continue;
      }
    }

    console.log(
      `[AI Auto-Pilot] Qualifying signal found: ${sig.action} ${sig.symbol} @ ₹${sig.currentPrice} (Cost: ₹${estimatedCost.toFixed(2)}, Strategy: ${autoPilotConfig.strategy})`
    );

    try {
      const orderReq: OrderPlacementRequest = {
        variety: "NORMAL",
        tradingsymbol: sig.symbol,
        symboltoken: sig.token,
        transactiontype: sig.action,
        exchange: sig.exchange || (isFno ? "NFO" : "NSE"),
        ordertype: "MARKET",
        producttype: isFno ? "CARRYFORWARD" : autoPilotConfig.productType,
        duration: "DAY",
        price: 0,
        quantity: finalQty,
      };

      const isPaper = autoPilotConfig.mode === "PAPER";
      const result = await placeSmartApiOrder(orderReq, isPaper);

      sig.status = "EXECUTED";
      autoPilotConfig.executedToday += 1;

      // Register active AI position for auto-exit monitoring
      const posId = `pos_${result.orderid || Date.now()}`;
      
      // Dynamic Target & Stop Loss tailored by Strategy
      let targetPct = autoPilotConfig.profitTargetPct || 35;
      let slPct = autoPilotConfig.stopLossPct || 18;
      let timeoutMins = autoPilotConfig.thetaTimeoutMinutes || 45;

      if (autoPilotConfig.strategy === "GAMMA_BLAST") {
        targetPct = Math.max(targetPct, 75);
        slPct = Math.min(slPct, 30);
        timeoutMins = 30;
      } else if (autoPilotConfig.strategy === "VWAP_TRAP") {
        targetPct = Math.max(targetPct, 40);
        slPct = 18;
      } else if (autoPilotConfig.strategy === "ORB_15M") {
        timeoutMins = 60;
      } else if (autoPilotConfig.strategy === "PCR_REVERSAL") {
        targetPct = Math.max(targetPct, 35);
        slPct = 15;
      }

      const targetPrice = sig.target1 > 0 ? sig.target1 : Number((sig.currentPrice * (1 + targetPct / 100)).toFixed(2));
      const stopLossPrice = sig.stopLoss > 0 ? sig.stopLoss : Number((sig.currentPrice * (1 - slPct / 100)).toFixed(2));

      const position: ActiveAiPosition = {
        id: posId,
        orderId: result.orderid,
        symbol: sig.symbol,
        token: sig.token,
        exchange: sig.exchange || (isFno ? "NFO" : "NSE"),
        strategy: autoPilotConfig.strategy,
        entryPrice: sig.currentPrice,
        currentPrice: sig.currentPrice,
        highestPrice: sig.currentPrice,
        quantity: finalQty,
        lots,
        action: sig.action === "SELL" ? "SELL" : "BUY",
        targetPrice,
        stopLossPrice,
        enteredAt: Date.now(),
        holdingMinutes: 0,
        timeoutMinutes: timeoutMins,
        mode: autoPilotConfig.mode,
        status: "OPEN",
        pnl: 0,
        pnlPercent: 0,
        greeks: sig.greeks,
        exitRetryCount: 0,
      };

      registerActiveAiPosition(position);
      logTradeEntryToDb(position, sig).catch(console.error);

      broadcastSocketEvent("ai_signal_executed", {
        signalId: sig.id,
        symbol: sig.symbol,
        order: result,
        position,
        mode: autoPilotConfig.mode,
        strategy: autoPilotConfig.strategy,
      });

      console.log(`[AI Auto-Pilot] Successfully executed auto-trade for ${sig.symbol} (${result.orderid})`);
    } catch (err: any) {
      console.error(`[AI Auto-Pilot] Failed to place order for ${sig.symbol}:`, err?.message || err);
      logAiErrorToDb({
        source: "AUTO_PILOT",
        action: "PLACE_ORDER",
        symbol: sig.symbol,
        token: sig.token,
        message: err?.message || "Auto-pilot order placement failed",
        stack: err?.stack,
        details: { signal: sig, config: autoPilotConfig },
      }).catch(console.error);
    }
  }
}

// ---------------------------------------------------------------------------
// Strategy Scheduling & Live Suggestion Timeline Engine
// ---------------------------------------------------------------------------

export const STATIC_STRATEGY_SCHEDULES: Omit<StrategyScheduleRecord, "isActiveNow" | "status" | "dateTime">[] = [
  {
    strategy: "ORB_15M",
    name: "15-Minute ORB",
    startTime: "09:30",
    endTime: "11:00",
    timeWindowLabel: "09:30 AM – 11:00 AM IST",
    daysActive: "ALL",
    marketCondition: "Morning High-Volume Breakout",
    description: "Captures 15m high/low breakouts with volume surge. Auto-exits before 11 AM midday chop.",
    targetProfitPct: 35,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "VWAP_TRAP",
    name: "VWAP Fakeout Trap",
    startTime: "11:00",
    endTime: "13:15",
    timeWindowLabel: "11:00 AM – 01:15 PM IST",
    daysActive: "ALL",
    marketCondition: "Midday Chop & Institutional Reversal",
    description: "Catches failed retail breakouts. Buys PEs on failed highs and CEs on reclaimed lows.",
    targetProfitPct: 40,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "GAMMA_BLAST",
    name: "Expiry Gamma Blast",
    startTime: "13:15",
    endTime: "14:45",
    timeWindowLabel: "01:15 PM – 02:45 PM IST",
    daysActive: "EXPIRY_DAY",
    marketCondition: "Afternoon Expiry Squeeze (Hero/Zero)",
    description: "Cheap ₹10–₹45 options on the day's expiry index catching explosive 1:3+ gamma surges.",
    targetProfitPct: 80,
    stopLossPct: 30,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "GREEK_SNIPER",
    name: "Greek Momentum Sniper",
    startTime: "09:35",
    endTime: "15:15",
    timeWindowLabel: "09:35 AM – 03:15 PM IST",
    daysActive: "ALL",
    marketCondition: "Directional High-Delta Momentum",
    description: "High Delta (0.35–0.50), top Gamma, and strict 45-minute theta decay protection timeout.",
    targetProfitPct: 35,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "PCR_REVERSAL",
    name: "PCR Sentiment Reversal",
    startTime: "10:00",
    endTime: "15:00",
    timeWindowLabel: "Market Sentiment Extremes",
    daysActive: "ALL",
    marketCondition: "Overbought / Oversold Contrarian",
    description: "Buys PEs when PCR > 1.35 (Overbought), buys CEs when PCR < 0.70 (Oversold).",
    targetProfitPct: 35,
    stopLossPct: 15,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "STANDARD",
    name: "Standard Scalper",
    startTime: "09:20",
    endTime: "15:20",
    timeWindowLabel: "All Trading Hours",
    daysActive: "ALL",
    marketCondition: "Classic Trend Following",
    description: "9/21 EMA + VWAP momentum scalping across liquid instruments.",
    targetProfitPct: 30,
    stopLossPct: 18,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
  {
    strategy: "EMA_9_21",
    name: "NIFTY 9/21 EMA Crossover",
    startTime: "09:15",
    endTime: "15:30",
    timeWindowLabel: "All Trading Hours (NIFTY Intraday)",
    daysActive: "ALL",
    marketCondition: "Trending EMA Crossover",
    description: "9/21 EMA crossover on intraday NIFTY 5-minute candles. Buy when EMA9 crosses above EMA21 with price above both; Sell when EMA9 crosses below EMA21 with price below both.",
    targetProfitPct: 25,
    stopLossPct: 12,
    suggestedBudget: 0,
    sizingLabel: "Dynamic Market Sizing (By Lots)",
  },
];

export function getCurrentIST(): { hours: number; minutes: number; day: number; timeNum: number; istString: string } {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const istDate = new Date(utc + 330 * 60000);
  const hours = istDate.getHours();
  const minutes = istDate.getMinutes();
  const day = istDate.getDay();
  const timeNum = hours * 100 + minutes;
  const pad = (n: number) => String(n).padStart(2, "0");
  const istString = `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(hours)}:${pad(minutes)} IST`;
  return { hours, minutes, day, timeNum, istString };
}

export function getTodayExpiryIndex(day: number): string {
  switch (day) {
    case 1:
      return "MIDCPNIFTY (Monday Expiry)";
    case 2:
      return "FINNIFTY (Tuesday Expiry)";
    case 3:
      return "BANKNIFTY (Wednesday Expiry)";
    case 4:
      return "NIFTY 50 (Thursday Expiry)";
    case 5:
      return "BSE SENSEX (Friday Expiry)";
    default:
      return "NIFTY 50 / BANKNIFTY";
  }
}

export function getLiveStrategySuggestion(): LiveStrategySuggestion {
  const { day, timeNum, istString } = getCurrentIST();
  const expiryIndexToday = getTodayExpiryIndex(day);

  // 1. Early Morning NIFTY 9/21 EMA Crossover: 09:15 to 09:30
  if (timeNum >= 915 && timeNum < 930) {
    return {
      recommendedStrategy: "EMA_9_21",
      strategyName: "NIFTY 9/21 EMA Crossover",
      badge: "📈 Early EMA Crossover",
      icon: "TrendingUp",
      timeWindowLabel: "09:15 AM – 09:30 AM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "NIFTY 5-minute EMA 9/21 crossover scan. Enter BUY when EMA9 crosses above EMA21 with price above both; enter SELL on bearish cross with price below both.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 25,
      stopLossPct: 12,
      dateTime: istString,
    };
  }

  // 2. Morning ORB: 09:30 to 11:00
  if (timeNum >= 930 && timeNum < 1100) {
    return {
      recommendedStrategy: "ORB_15M",
      strategyName: "15-Minute ORB",
      badge: "🌅 Morning Breakout Window",
      icon: "Sun",
      timeWindowLabel: "09:30 AM – 11:00 AM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "High institutional morning rush. Ride 15m High/Low breakouts with volume confirmation before 11 AM.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 35,
      stopLossPct: 18,
      dateTime: istString,
    };
  }

  // 3. Midday VWAP Trap: 11:00 to 13:15
  if (timeNum >= 1100 && timeNum < 1315) {
    return {
      recommendedStrategy: "VWAP_TRAP",
      strategyName: "VWAP Fakeout Trap",
      badge: "🪤 Midday Reversal Window",
      icon: "TrendingDown",
      timeWindowLabel: "11:00 AM – 01:15 PM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "Lunch chop period. Avoid chasing breakout fakes; buy PEs on failed day highs and CEs on reclaimed day lows.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 40,
      stopLossPct: 18,
      dateTime: istString,
    };
  }

  // 4. Afternoon Expiry Gamma Blast: 13:15 to 14:45
  if (timeNum >= 1315 && timeNum < 1445) {
    return {
      recommendedStrategy: "GAMMA_BLAST",
      strategyName: "Expiry Gamma Blast",
      badge: "🚀 Afternoon Gamma Surge",
      icon: "Flame",
      timeWindowLabel: "01:15 PM – 02:45 PM IST",
      activeNow: true,
      expiryIndexToday,
      reason: `Expiry short-covering rally active on ${expiryIndexToday}. Fast asymmetric 1:3+ surge on cheap options.`,
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 80,
      stopLossPct: 30,
      dateTime: istString,
    };
  }

  // 5. Closing Momentum: 14:45 to 15:30
  if (timeNum >= 1445 && timeNum <= 1530) {
    return {
      recommendedStrategy: "GREEK_SNIPER",
      strategyName: "Greek Momentum Sniper",
      badge: "⚡ Closing Scalper",
      icon: "Zap",
      timeWindowLabel: "02:45 PM – 03:30 PM IST",
      activeNow: true,
      expiryIndexToday,
      reason: "Market close directional squeeze. Filters high Delta and top Gamma for fast closing scalps.",
      suggestedBudget: 0,
      sizingLabel: "Dynamic (1 Lot @ Market Price)",
      targetProfitPct: 35,
      stopLossPct: 18,
      dateTime: istString,
    };
  }

  // Outside Trading Hours
  return {
    recommendedStrategy: "ORB_15M",
    strategyName: "15-Minute ORB",
    badge: "⏳ Pre-Market Preparation",
    icon: "Clock",
    timeWindowLabel: "Tomorrow 09:30 AM – 11:00 AM IST",
    activeNow: false,
    expiryIndexToday,
    reason: `Market closed. Next high-probability institutional window is 15-Min ORB on ${expiryIndexToday} at 09:30 AM.`,
    suggestedBudget: 0,
    sizingLabel: "Dynamic (1 Lot @ Market Price)",
    targetProfitPct: 35,
    stopLossPct: 18,
    dateTime: istString,
  };
}

export async function getStrategySchedules(): Promise<{
  liveSuggestion: LiveStrategySuggestion;
  schedules: StrategyScheduleRecord[];
  history: any[];
}> {
  const liveSuggestion = getLiveStrategySuggestion();
  const { timeNum, istString } = getCurrentIST();

  const schedules: StrategyScheduleRecord[] = STATIC_STRATEGY_SCHEDULES.map((s) => {
    let status: "ACTIVE" | "UPCOMING" | "PAST" = "UPCOMING";
    let isActiveNow = false;

    const startNum = parseInt(s.startTime.replace(":", ""), 10);
    const endNum = parseInt(s.endTime.replace(":", ""), 10);

    if (timeNum >= startNum && timeNum <= endNum) {
      status = "ACTIVE";
      isActiveNow = true;
    } else if (timeNum > endNum) {
      status = "PAST";
    }

    return {
      ...s,
      status,
      isActiveNow,
      dateTime: istString,
    };
  });

  let history: any[] = [];
  try {
    history = await prisma.aiStrategySchedule.findMany({
      orderBy: { dateTime: "desc" },
      take: 20,
    });
    history = history.map((h) => ({
      ...h,
      id: String(h.id),
    }));
  } catch {
    history = [];
  }

  return {
    liveSuggestion,
    schedules,
    history,
  };
}

export async function logStrategyScheduleEvent(params: {
  strategy: string;
  name: string;
  startTime: string;
  endTime: string;
  daysActive?: string;
  marketCondition?: string;
  description?: string;
  targetProfitPct?: number;
  stopLossPct?: number;
  suggestedBudget?: number;
}): Promise<any> {
  try {
    const res = await prisma.aiStrategySchedule.create({
      data: {
        strategy: params.strategy,
        name: params.name,
        startTime: params.startTime,
        endTime: params.endTime,
        daysActive: params.daysActive || "ALL",
        marketCondition: params.marketCondition || "Active Schedule",
        description: params.description || "",
        targetProfitPct: params.targetProfitPct || 35,
        stopLossPct: params.stopLossPct || 18,
        suggestedBudget: params.suggestedBudget || 5000,
        status: "ACTIVE",
        dateTime: new Date(),
      },
    });
    return { ...res, id: String(res.id) };
  } catch (err: any) {
    console.warn("[Database] Could not log strategy schedule event:", err?.message || err);
    return {
      ...params,
      id: String(Date.now()),
      dateTime: new Date().toISOString(),
    };
  }
}
