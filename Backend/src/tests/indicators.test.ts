import { describe, it, expect } from "vitest";
import {
  calculateRSI,
  calculateEMA,
  calculateEMASeries,
  calculateSMA,
  calculateBollingerBands,
  calculateATR,
  calculateOrderBookImbalance,
} from "../services/ai/indicators.service.js";

describe("Technical Indicators Unit Tests", () => {
  it("calculates RSI correctly on upward momentum", () => {
    // 15 ascending prices
    const prices = [100, 102, 104, 103, 105, 107, 108, 110, 112, 115, 114, 116, 118, 120, 122];
    const rsi = calculateRSI(prices, 14);
    expect(rsi).toBeGreaterThan(60);
    expect(rsi).toBeLessThanOrEqual(100);
  });

  it("calculates RSI correctly on downward momentum", () => {
    // 15 descending prices
    const prices = [120, 118, 116, 117, 114, 112, 110, 108, 106, 104, 105, 102, 100, 98, 95];
    const rsi = calculateRSI(prices, 14);
    expect(rsi).toBeLessThan(40);
    expect(rsi).toBeGreaterThanOrEqual(0);
  });

  it("calculates SMA correctly", () => {
    const prices = [10, 20, 30, 40, 50];
    const sma = calculateSMA(prices, 5);
    expect(sma).toBe(30);
  });

  it("calculates EMA series correctly", () => {
    const prices = [10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
    const series = calculateEMASeries(prices, 5);
    expect(series.length).toBe(prices.length);
    expect(series[series.length - 1]).toBeGreaterThan(15);
  });

  it("calculates Bollinger Bands correctly", () => {
    const prices = Array.from({ length: 30 }, (_, i) => 100 + Math.sin(i) * 5);
    const bb = calculateBollingerBands(prices, 20, 2);
    expect(bb.upper).toBeGreaterThan(bb.middle);
    expect(bb.middle).toBeGreaterThan(bb.lower);
    expect(bb.bandwidth).toBeGreaterThan(0);
  });

  it("calculates ATR (Average True Range) correctly", () => {
    const highs = [105, 107, 106, 108, 110, 112, 111, 113, 115, 114, 116, 118, 117, 119, 121];
    const lows = [98, 100, 101, 102, 104, 106, 105, 107, 109, 108, 110, 112, 111, 113, 115];
    const closes = [102, 104, 103, 105, 107, 108, 110, 112, 111, 113, 115, 114, 116, 118, 120];
    const atr = calculateATR(highs, lows, closes, 14);
    expect(atr).toBeGreaterThan(0);
    expect(atr).toBeLessThan(15);
  });

  it("calculates Order Book Imbalance percentage correctly", () => {
    expect(calculateOrderBookImbalance(600, 400)).toBe(60);
    expect(calculateOrderBookImbalance(200, 800)).toBe(20);
    expect(calculateOrderBookImbalance(0, 0)).toBe(50);
  });
});
