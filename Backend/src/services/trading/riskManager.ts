// ===========================================================================
// Risk Management Engine & Circuit Breakers
// ===========================================================================

import { RISK_LIMITS } from "../../shared/constants.js";
import { dryRunEngine } from "./dryRunEngine.js";

export interface RiskCheckResult {
  passed: boolean;
  code?: string;
  message?: string;
}

export class RiskManager {
  private dailyTradesCount = 0;
  private dailyStartCapital = 1000000;
  private isCircuitBreakerTripped = false;

  /**
   * Check if an order is within system risk limits
   */
  public evaluateOrderRisk(orderValue: number, currentBalance: number): RiskCheckResult {
    if (this.isCircuitBreakerTripped) {
      return {
        passed: false,
        code: "CIRCUIT_BREAKER_ACTIVE",
        message: "Trading halted: Daily portfolio drawdown circuit breaker is active.",
      };
    }

    if (this.dailyTradesCount >= RISK_LIMITS.MAX_DAILY_TRADES) {
      return {
        passed: false,
        code: "MAX_TRADES_EXCEEDED",
        message: `Exceeded maximum daily trades limit (${RISK_LIMITS.MAX_DAILY_TRADES} trades).`,
      };
    }

    const maxPerOrder = (currentBalance * RISK_LIMITS.MAX_CAPITAL_PER_ORDER_PERCENT) / 100;
    if (orderValue > maxPerOrder) {
      return {
        passed: false,
        code: "MAX_ORDER_EXCEEDED",
        message: `Order value ₹${orderValue.toFixed(2)} exceeds maximum per-trade risk allowance (₹${maxPerOrder.toFixed(2)}).`,
      };
    }

    return { passed: true };
  }

  /**
   * Evaluate portfolio drawdown
   */
  public checkDrawdown(): boolean {
    const summary = dryRunEngine.getPortfolioSummary();
    const currentTotal = summary.totalPortfolioValue;
    const drawdown = ((this.dailyStartCapital - currentTotal) / this.dailyStartCapital) * 100;

    if (drawdown >= RISK_LIMITS.MAX_PORTFOLIO_DRAWDOWN_PERCENT) {
      this.isCircuitBreakerTripped = true;
      console.warn(`[RiskManager] CIRCUIT BREAKER TRIGGERED! Drawdown: ${drawdown.toFixed(2)}%`);
      return false;
    }

    return true;
  }

  public recordTrade(): void {
    this.dailyTradesCount++;
  }

  public resetDailyLimits(startCapital: number): void {
    this.dailyTradesCount = 0;
    this.dailyStartCapital = startCapital;
    this.isCircuitBreakerTripped = false;
  }
}

export const riskManager = new RiskManager();
