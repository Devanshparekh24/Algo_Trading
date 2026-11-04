// ===========================================================================
// Dry-Run Simulation Engine (Enterprise Risk & Virtual Execution)
// ===========================================================================
// Follows the Dry-Run Principle:
// 1. Full Pre-Trade Validation (Balance, Lot sizes, Margin checks)
// 2. Realistic Slippage Modeling (Bid-Ask spread & market order impact)
// 3. Indian Statutory Charges & Taxes (STT, GST, Brokerage, SEBI fee)
// 4. In-Memory Virtual Portfolio Ledger (Cash, Margin, Open Positions, P&L)

import {
  DEFAULT_VIRTUAL_CAPITAL,
  DEFAULT_LOT_SIZES,
  STATUTORY_CHARGES,
  RISK_LIMITS,
} from "../../shared/constants.js";
import type {
  DryRunPreTradeCheck,
  DryRunExecutionResult,
  DryRunPortfolioSummary,
  EstimatedTradeCharges,
  VirtualPosition,
} from "../../shared/types.js";
import type { OrderPlacementRequest } from "../smartapi/types.js";

export class DryRunEngine {
  private virtualCash: number = DEFAULT_VIRTUAL_CAPITAL;
  private lockedMargin: number = 0;
  private realizedPnL: number = 0;
  private totalChargesPaid: number = 0;
  private totalTradesCount: number = 0;
  private successfulTradesCount: number = 0;
  private positions: Map<string, VirtualPosition> = new Map();

  /**
   * Reset Virtual Portfolio to initial state
   */
  public resetPortfolio(initialCapital: number = DEFAULT_VIRTUAL_CAPITAL): void {
    this.virtualCash = initialCapital;
    this.lockedMargin = 0;
    this.realizedPnL = 0;
    this.totalChargesPaid = 0;
    this.totalTradesCount = 0;
    this.successfulTradesCount = 0;
    this.positions.clear();
  }

  /**
   * Calculate Indian Statutory Taxes & Charges for an order
   */
  public calculateCharges(
    turnover: number,
    transactionType: "BUY" | "SELL",
    isOption: boolean = true
  ): EstimatedTradeCharges {
    // 1. Brokerage: flat ₹20 or 0.03%
    const brokerage = Math.min(20, turnover * 0.0003);

    // 2. STT (Securities Transaction Tax)
    let stt = 0;
    if (isOption) {
      // 0.1% on premium on sell side
      if (transactionType === "SELL") {
        stt = turnover * STATUTORY_CHARGES.STT_OPTIONS_SELL;
      }
    } else {
      if (transactionType === "SELL") {
        stt = turnover * STATUTORY_CHARGES.STT_EQUITY_INTRADAY_SELL;
      }
    }

    // 3. Exchange Turnover Charges
    const exchRate = isOption
      ? STATUTORY_CHARGES.EXCHANGE_TURNOVER_OPTIONS
      : STATUTORY_CHARGES.EXCHANGE_TURNOVER_EQUITY;
    const exchangeCharges = turnover * exchRate;

    // 4. SEBI Turnover Fee (₹10 per crore = 0.0001%)
    const sebiTurnoverFee = turnover * STATUTORY_CHARGES.SEBI_TURNOVER_FEE_RATE;

    // 5. Stamp Duty (only on Buy)
    let stampDuty = 0;
    if (transactionType === "BUY") {
      const stampRate = isOption
        ? STATUTORY_CHARGES.STAMP_DUTY_BUY_OPTIONS
        : STATUTORY_CHARGES.STAMP_DUTY_BUY_EQUITY;
      stampDuty = turnover * stampRate;
    }

    // 6. GST: 18% on (Brokerage + Exchange Charges + SEBI Fee)
    const gstBase = brokerage + exchangeCharges + sebiTurnoverFee;
    const gst = gstBase * STATUTORY_CHARGES.GST_RATE;

    const totalCharges = Number(
      (brokerage + stt + exchangeCharges + sebiTurnoverFee + stampDuty + gst).toFixed(2)
    );

    return {
      brokerage: Number(brokerage.toFixed(2)),
      stt: Number(stt.toFixed(2)),
      exchangeCharges: Number(exchangeCharges.toFixed(2)),
      sebiTurnoverFee: Number(sebiTurnoverFee.toFixed(2)),
      stampDuty: Number(stampDuty.toFixed(2)),
      gst: Number(gst.toFixed(2)),
      totalCharges,
      netTurnover: Number(turnover.toFixed(2)),
    };
  }

  /**
   * Pre-Trade Safety Check (validates margin, lots, risk boundaries)
   */
  public preTradeCheck(
    req: OrderPlacementRequest,
    currentMarketPrice: number
  ): DryRunPreTradeCheck {
    const qty = Number(req.quantity || 1);
    const price = Number(req.price) > 0 ? Number(req.price) : currentMarketPrice;
    const turnover = qty * price;
    const isOption = req.tradingsymbol.endsWith("CE") || req.tradingsymbol.endsWith("PE");
    const charges = this.calculateCharges(turnover, req.transactiontype as "BUY" | "SELL", isOption);

    const requiredMargin = turnover + charges.totalCharges;
    const availableMargin = this.virtualCash;

    const hasSufficientMargin = req.transactiontype === "BUY" ? availableMargin >= requiredMargin : true;
    const symbolValid = Boolean(req.tradingsymbol && req.tradingsymbol.length > 2);

    // Lot Size validation for major indices
    let lotSizeValid = true;
    for (const [idx, lot] of Object.entries(DEFAULT_LOT_SIZES)) {
      if (req.tradingsymbol.startsWith(idx)) {
        if (qty % lot !== 0) {
          lotSizeValid = false;
        }
        break;
      }
    }

    // Risk Check: Max 25% of account balance in a single order
    const maxAllowedOrderValue = (DEFAULT_VIRTUAL_CAPITAL * RISK_LIMITS.MAX_CAPITAL_PER_ORDER_PERCENT) / 100;
    const withinRiskLimits = turnover <= maxAllowedOrderValue;

    const allowed = symbolValid && hasSufficientMargin && lotSizeValid && withinRiskLimits;

    let reason: string | undefined;
    if (!symbolValid) reason = "Invalid trading symbol";
    else if (!hasSufficientMargin) reason = `Insufficient virtual margin. Required: ₹${requiredMargin.toFixed(2)}, Available: ₹${availableMargin.toFixed(2)}`;
    else if (!lotSizeValid) reason = `Quantity ${qty} must be an exact multiple of the index lot size`;
    else if (!withinRiskLimits) reason = `Order value ₹${turnover.toFixed(2)} exceeds 25% single-order risk threshold (₹${maxAllowedOrderValue.toFixed(2)})`;

    return {
      allowed,
      reason,
      checks: {
        symbolValid,
        hasSufficientMargin,
        requiredMargin: Number(requiredMargin.toFixed(2)),
        availableMargin: Number(availableMargin.toFixed(2)),
        lotSizeValid,
        withinRiskLimits,
        riskLimitMessage: reason,
      },
      estimatedCharges: charges,
    };
  }

  /**
   * Execute simulated Dry-Run trade with realistic slippage and accounting
   */
  public executeDryRun(
    req: OrderPlacementRequest,
    currentMarketPrice: number
  ): DryRunExecutionResult {
    const preCheck = this.preTradeCheck(req, currentMarketPrice);
    this.totalTradesCount++;

    const orderId = `DRY_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const now = new Date().toISOString();
    const qty = Number(req.quantity || 1);
    const requestedPrice = Number(req.price) > 0 ? Number(req.price) : currentMarketPrice;

    if (!preCheck.allowed) {
      return {
        success: false,
        executionMode: "DRY_RUN",
        orderId,
        symbol: req.tradingsymbol,
        transactionType: req.transactiontype as "BUY" | "SELL",
        productType: req.producttype || "INTRADAY",
        requestedPrice,
        simulatedFillPrice: requestedPrice,
        slippageAmount: 0,
        quantity: qty,
        orderValue: qty * requestedPrice,
        charges: preCheck.estimatedCharges,
        executedAt: now,
        status: "REJECTED",
        rejectionReason: preCheck.reason,
        portfolioState: {
          virtualBalance: Number(this.virtualCash.toFixed(2)),
          lockedMargin: Number(this.lockedMargin.toFixed(2)),
          realizedPnL: Number(this.realizedPnL.toFixed(2)),
          openPositionsCount: this.positions.size,
        },
      };
    }

    // Realistic slippage: 0.05% adverse impact for MARKET orders
    let slippagePercent = 0;
    if (req.ordertype === "MARKET" || !req.price || Number(req.price) === 0) {
      slippagePercent = (RISK_LIMITS.DEFAULT_SLIPPAGE_BPS / 10000);
    }

    const slippageMultiplier = req.transactiontype === "BUY" ? 1 + slippagePercent : 1 - slippagePercent;
    const simulatedFillPrice = Number((requestedPrice * slippageMultiplier).toFixed(2));
    const slippageAmount = Number(Math.abs(simulatedFillPrice - requestedPrice).toFixed(2));

    const totalOrderValue = Number((simulatedFillPrice * qty).toFixed(2));
    const charges = preCheck.estimatedCharges;
    this.totalChargesPaid += charges.totalCharges;

    // Portfolio Accounting
    const posKey = `${req.tradingsymbol}_${req.producttype || "INTRADAY"}`;
    const existingPos = this.positions.get(posKey);

    if (req.transactiontype === "BUY") {
      this.virtualCash -= (totalOrderValue + charges.totalCharges);
      if (existingPos) {
        const newQty = existingPos.quantity + qty;
        const totalCost = (existingPos.quantity * existingPos.averagePrice) + totalOrderValue;
        existingPos.averagePrice = Number((totalCost / newQty).toFixed(2));
        existingPos.quantity = newQty;
        existingPos.chargesPaid += charges.totalCharges;
        existingPos.updatedAt = now;
      } else {
        this.positions.set(posKey, {
          symbol: req.tradingsymbol,
          exchange: req.exchange || "NSE",
          productType: req.producttype || "INTRADAY",
          quantity: qty,
          averagePrice: simulatedFillPrice,
          currentPrice: simulatedFillPrice,
          unrealizedPnL: 0,
          chargesPaid: charges.totalCharges,
          updatedAt: now,
        });
      }
    } else {
      // SELL order
      this.virtualCash += (totalOrderValue - charges.totalCharges);
      if (existingPos) {
        const tradePnL = (simulatedFillPrice - existingPos.averagePrice) * Math.min(qty, existingPos.quantity);
        this.realizedPnL += tradePnL;

        if (qty >= existingPos.quantity) {
          this.positions.delete(posKey);
        } else {
          existingPos.quantity -= qty;
          existingPos.chargesPaid += charges.totalCharges;
          existingPos.updatedAt = now;
        }
      }
    }

    this.successfulTradesCount++;

    return {
      success: true,
      executionMode: "DRY_RUN",
      orderId,
      symbol: req.tradingsymbol,
      transactionType: req.transactiontype as "BUY" | "SELL",
      productType: req.producttype || "INTRADAY",
      requestedPrice,
      simulatedFillPrice,
      slippageAmount,
      quantity: qty,
      orderValue: totalOrderValue,
      charges,
      executedAt: now,
      status: "COMPLETE",
      portfolioState: {
        virtualBalance: Number(this.virtualCash.toFixed(2)),
        lockedMargin: Number(this.lockedMargin.toFixed(2)),
        realizedPnL: Number(this.realizedPnL.toFixed(2)),
        openPositionsCount: this.positions.size,
      },
    };
  }

  /**
   * Get virtual portfolio metrics summary
   */
  public getPortfolioSummary(): DryRunPortfolioSummary {
    let investedValue = 0;
    let totalUnrealizedPnL = 0;
    const positionsList: VirtualPosition[] = [];

    for (const pos of this.positions.values()) {
      const posValue = pos.quantity * pos.currentPrice;
      investedValue += posValue;
      pos.unrealizedPnL = Number(((pos.currentPrice - pos.averagePrice) * pos.quantity).toFixed(2));
      totalUnrealizedPnL += pos.unrealizedPnL;
      positionsList.push(pos);
    }

    const totalPortfolioValue = Number((this.virtualCash + investedValue).toFixed(2));
    const totalReturn = (totalPortfolioValue - DEFAULT_VIRTUAL_CAPITAL);
    const netReturnPercent = Number(((totalReturn / DEFAULT_VIRTUAL_CAPITAL) * 100).toFixed(2));

    return {
      startingCapital: DEFAULT_VIRTUAL_CAPITAL,
      currentCash: Number(this.virtualCash.toFixed(2)),
      investedValue: Number(investedValue.toFixed(2)),
      totalPortfolioValue,
      totalRealizedPnL: Number(this.realizedPnL.toFixed(2)),
      totalUnrealizedPnL: Number(totalUnrealizedPnL.toFixed(2)),
      netReturnPercent,
      totalChargesDeducted: Number(this.totalChargesPaid.toFixed(2)),
      totalTradesCount: this.totalTradesCount,
      successfulTradesCount: this.successfulTradesCount,
      positions: positionsList,
    };
  }
}

export const dryRunEngine = new DryRunEngine();
