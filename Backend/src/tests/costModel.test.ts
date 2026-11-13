import { describe, it, expect } from "vitest";
import {
  calculateIndianMarketCosts,
  getSlippageAdjustedPrice,
} from "../services/ai/costModel.service.js";

describe("Indian Market Cost Model & Slippage Math Tests", () => {
  it("computes accurate intraday equity transaction costs", () => {
    const costs = calculateIndianMarketCosts({
      segment: "EQUITY",
      buyPrice: 1000,
      sellPrice: 1020,
      quantity: 50,
      isMarketOrder: true,
    });

    expect(costs.turnover).toBe(1000 * 50 + 1020 * 50);
    expect(costs.grossPnl).toBe(1000);
    // Indian discount brokerage: min(₹20, 0.03% * turnover) per executed leg = ₹15 + ₹15.3 = ₹30.30
    expect(costs.brokerage).toBeCloseTo(30.3, 1);
    expect(costs.stt).toBeGreaterThan(0);
    expect(costs.gst).toBeGreaterThan(0);
    expect(costs.totalCost).toBeGreaterThan(30);
    expect(costs.netPnl).toBeLessThan(costs.grossPnl);
    expect(costs.netPnl).toBe(costs.grossPnl - costs.totalCost);
  });

  it("computes F&O option costs with proper STT on sell side", () => {
    const costs = calculateIndianMarketCosts({
      segment: "FNO",
      buyPrice: 100,
      sellPrice: 130,
      quantity: 75, // 1 lot of NIFTY
      isMarketOrder: true,
    });

    expect(costs.grossPnl).toBe(30 * 75);
    expect(costs.brokerage).toBeCloseTo(5.17, 1);
    expect(costs.stt).toBeGreaterThan(0);
    expect(costs.netPnl).toBe(costs.grossPnl - costs.totalCost);
  });

  it("applies adverse slippage for market orders", () => {
    const buyPrice = 100;
    const slippedBuy = getSlippageAdjustedPrice(buyPrice, "BUY");
    expect(slippedBuy).toBeGreaterThan(buyPrice);

    const sellPrice = 100;
    const slippedSell = getSlippageAdjustedPrice(sellPrice, "SELL");
    expect(slippedSell).toBeLessThan(sellPrice);
  });
});
