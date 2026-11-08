// ---------------------------------------------------------------------------
// Institutional Indian Market Transaction Cost & Slippage Engine
// Models standard NSE/NFO charges: Brokerage, STT, Exchange fees, GST,
// SEBI turnover charges, Stamp Duty, and Execution Slippage.
// ---------------------------------------------------------------------------

export interface TradeCostBreakdown {
  turnover: number;
  buyTurnover: number;
  sellTurnover: number;
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  gst: number;
  sebiCharges: number;
  stampDuty: number;
  totalCharges: number;
  slippage: number;
  totalCost: number;
  grossPnl: number;
  netPnl: number;
  netPnlPercent: number;
}

export interface CalculateCostParams {
  segment: "EQUITY" | "FNO";
  contractType?: "CE" | "PE" | "FUT" | "EQ" | string | null | undefined;
  action?: "BUY" | "SELL" | undefined;
  buyPrice: number;
  sellPrice: number;
  quantity: number;
  isMarketOrder?: boolean | undefined;
  slippageRate?: number | undefined; // Default 0.0015 (0.15% per leg for market orders)
}

/**
 * Calculates authentic Indian exchange charges, taxes, and slippage
 * for Equity Intraday and F&O Options/Futures trading.
 */
export function calculateIndianMarketCosts(params: CalculateCostParams): TradeCostBreakdown {
  const {
    segment,
    contractType = "CE",
    buyPrice,
    sellPrice,
    quantity,
    isMarketOrder = true,
    slippageRate = 0.0015, // 0.15% per leg on market orders
  } = params;

  const buyTurnover = buyPrice * quantity;
  const sellTurnover = sellPrice * quantity;
  const totalTurnover = buyTurnover + sellTurnover;

  const isOption = segment === "FNO" && (contractType === "CE" || contractType === "PE");
  const isFuture = segment === "FNO" && contractType === "FUT";
  const isEquity = segment === "EQUITY" || contractType === "EQ";

  // 1. Brokerage:
  // Standard Indian discount brokers (Angel One, Zerodha, Groww):
  // ₹20 flat per executed order or 0.03% (whichever is lower).
  const buyBrokerage = Math.min(20, 0.0003 * buyTurnover);
  const sellBrokerage = Math.min(20, 0.0003 * sellTurnover);
  const brokerage = Number((buyBrokerage + sellBrokerage).toFixed(2));

  // 2. STT (Securities Transaction Tax):
  // - Options: 0.1% on sell turnover (premium value)
  // - Futures: 0.02% on sell turnover
  // - Equity Intraday: 0.025% on sell turnover
  // - Equity Delivery: 0.1% on both buy & sell
  let stt = 0;
  if (isOption) {
    stt = sellTurnover * 0.001; // 0.1% on sell side premium
  } else if (isFuture) {
    stt = sellTurnover * 0.0002; // 0.02% on sell turnover
  } else if (isEquity) {
    stt = sellTurnover * 0.00025; // 0.025% on sell side intraday
  }
  stt = Number(stt.toFixed(2));

  // 3. Exchange Transaction Charges:
  // - NSE Options: ~0.05% of turnover (premium value)
  // - NSE Futures: ~0.0019% of turnover
  // - NSE Cash: ~0.00297% of turnover
  let exchangeRate = 0.0005; // 0.05% for options
  if (isFuture) {
    exchangeRate = 0.000019;
  } else if (isEquity) {
    exchangeRate = 0.0000297;
  }
  const exchangeCharges = Number((totalTurnover * exchangeRate).toFixed(2));

  // 4. SEBI Turnover Fee:
  // ₹10 per crore (0.0001% of turnover)
  const sebiCharges = Number((totalTurnover * 0.000001).toFixed(2));

  // 5. GST:
  // 18% on (Brokerage + Exchange Charges + SEBI Charges)
  const gst = Number(((brokerage + exchangeCharges + sebiCharges) * 0.18).toFixed(2));

  // 6. Stamp Duty (State Stamp Act, collected on Buy side turnover only):
  // - Options: 0.003% on buy turnover
  // - Futures: 0.002% on buy turnover
  // - Equity Intraday: 0.003% on buy turnover
  const stampDutyRate = isFuture ? 0.00002 : 0.00003;
  const stampDuty = Number((buyTurnover * stampDutyRate).toFixed(2));

  // Total regulatory & statutory charges
  const totalCharges = Number(
    (brokerage + stt + exchangeCharges + sebiCharges + gst + stampDuty).toFixed(2)
  );

  // 7. Slippage:
  // Market orders face bid-ask spread and fill latency.
  // Model 0.15% adverse slippage on entry and exit.
  const slippage = isMarketOrder
    ? Number(((buyTurnover * slippageRate) + (sellTurnover * slippageRate)).toFixed(2))
    : 0;

  // Total Trading Cost (Charges + Slippage)
  const totalCost = Number((totalCharges + slippage).toFixed(2));

  // Gross PnL
  const grossPnl = Number(((sellPrice - buyPrice) * quantity).toFixed(2));

  // Net PnL (Gross PnL minus all charges and slippage)
  const netPnl = Number((grossPnl - totalCost).toFixed(2));

  // Net PnL Percentage based on capital deployed (buy turnover)
  const netPnlPercent =
    buyTurnover > 0 ? Number(((netPnl / buyTurnover) * 100).toFixed(2)) : 0;

  return {
    turnover: Number(totalTurnover.toFixed(2)),
    buyTurnover: Number(buyTurnover.toFixed(2)),
    sellTurnover: Number(sellTurnover.toFixed(2)),
    brokerage,
    stt,
    exchangeCharges,
    gst,
    sebiCharges,
    stampDuty,
    totalCharges,
    slippage,
    totalCost,
    grossPnl,
    netPnl,
    netPnlPercent,
  };
}

/**
 * Applies realistic slippage to simulated/paper trade executions.
 * - BUY orders fill slightly higher (+slippage)
 * - SELL orders fill slightly lower (-slippage)
 */
export function getSlippageAdjustedPrice(
  rawPrice: number,
  action: "BUY" | "SELL",
  slippageRate = 0.0015
): number {
  if (rawPrice <= 0) return rawPrice;
  if (action === "BUY") {
    // Fill higher due to ask side premium
    return Number((rawPrice * (1 + slippageRate)).toFixed(2));
  } else {
    // Fill lower due to bid side discount
    return Number((rawPrice * (1 - slippageRate)).toFixed(2));
  }
}

