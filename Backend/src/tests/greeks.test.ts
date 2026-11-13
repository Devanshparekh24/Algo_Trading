import { describe, it, expect } from "vitest";
import {
  calculateOptionGreeks,
  parseExpiryToDte,
  checkGoldenHours,
} from "../services/smartapi/greeks.service.js";

describe("Option Greeks & Black-Scholes Engine Tests", () => {
  it("calculates accurate Call option greeks", () => {
    const greeks = calculateOptionGreeks({
      spotPrice: 24500,
      strikePrice: 24500,
      timeToExpiryDays: 7,
      marketPrice: 120,
      isCall: true,
    });

    expect(greeks.delta).toBeGreaterThan(0.4);
    expect(greeks.delta).toBeLessThan(0.6);
    expect(greeks.gamma).toBeGreaterThan(0);
    expect(greeks.theta).toBeLessThan(0);
    expect(greeks.iv).toBeGreaterThan(0.05);
  });

  it("calculates accurate Put option greeks", () => {
    const greeks = calculateOptionGreeks({
      spotPrice: 24500,
      strikePrice: 24500,
      timeToExpiryDays: 7,
      marketPrice: 120,
      isCall: false,
    });

    expect(greeks.delta).toBeGreaterThan(-0.6);
    expect(greeks.delta).toBeLessThan(-0.4);
    expect(greeks.gamma).toBeGreaterThan(0);
    expect(greeks.theta).toBeLessThan(0);
  });

  it("evaluates Golden Hours window correctly", () => {
    const status = checkGoldenHours();
    expect(typeof status.isGoldenHour).toBe("boolean");
    expect(typeof status.isLunchChop).toBe("boolean");
    expect(typeof status.message).toBe("string");
  });

  it("parses NSE expiry dates into accurate DTE days", () => {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
    const pad = (n: number) => String(n).padStart(2, "0");
    const expiryStr = `${pad(futureDate.getDate())}${months[futureDate.getMonth()]}${futureDate.getFullYear()}`;

    const dte = parseExpiryToDte(expiryStr);
    expect(dte).toBeGreaterThan(3);
    expect(dte).toBeLessThanOrEqual(6);
  });
});
