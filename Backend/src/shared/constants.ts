// ===========================================================================
// Indian Market Trading & Regulatory Constants
// ===========================================================================

export const DEFAULT_VIRTUAL_CAPITAL = 1000000; // ₹10,00,000 for Dry-Run Simulation

export const DEFAULT_LOT_SIZES: Record<string, number> = {
  NIFTY: 25,
  BANKNIFTY: 15,
  FINNIFTY: 25,
  MIDCPNIFTY: 50,
  SENSEX: 10,
  BANKEX: 15,
};

export const TICK_SIZE = 0.05;

/**
 * Statutory Indian Market Charges & Taxes (as per SEBI & Govt guidelines):
 * - Brokerage: Flat ₹20 per executed order (or 0.03% whichever is lower)
 * - STT (Securities Transaction Tax):
 *   - Options: 0.1% on premium (sell side)
 *   - Equity Intraday: 0.025% on sell side
 *   - Equity Delivery: 0.1% on both buy & sell
 * - Exchange Transaction Charges: 0.05% for options premium turnover, 0.00325% for equity
 * - GST: 18% on (Brokerage + Exchange Charges + SEBI Turnover Fee)
 * - Stamp Duty: 0.003% on buy value (options), 0.015% (delivery buy)
 * - SEBI Turnover Fee: ₹10 per crore (0.0001%)
 */
export const STATUTORY_CHARGES = {
  BROKERAGE_PER_ORDER: 20,
  STT_OPTIONS_SELL: 0.001, // 0.1%
  STT_EQUITY_INTRADAY_SELL: 0.00025, // 0.025%
  STT_EQUITY_DELIVERY: 0.001, // 0.1%
  EXCHANGE_TURNOVER_OPTIONS: 0.0005, // 0.05%
  EXCHANGE_TURNOVER_EQUITY: 0.0000325, // 0.00325%
  GST_RATE: 0.18, // 18%
  STAMP_DUTY_BUY_OPTIONS: 0.00003, // 0.003%
  STAMP_DUTY_BUY_EQUITY: 0.00015, // 0.015%
  SEBI_TURNOVER_FEE_RATE: 0.000001, // ₹10 per crore
};

export const RISK_LIMITS = {
  MAX_DAILY_TRADES: 50,
  MAX_CAPITAL_PER_ORDER_PERCENT: 25, // Max 25% of account balance per position
  DEFAULT_SLIPPAGE_BPS: 5, // 5 basis points (0.05%) default slippage
  MAX_PORTFOLIO_DRAWDOWN_PERCENT: 10, // 10% daily circuit breaker
};
