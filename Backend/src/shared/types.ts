// ===========================================================================
// Enterprise Shared Domain Models
// ===========================================================================

export type ExecutionMode = "DRY_RUN" | "LIVE";

export interface EstimatedTradeCharges {
  brokerage: number;
  stt: number;
  exchangeCharges: number;
  sebiTurnoverFee: number;
  stampDuty: number;
  gst: number;
  totalCharges: number;
  netTurnover: number;
}

export interface DryRunPreTradeCheck {
  allowed: boolean;
  reason?: string | undefined;
  checks: {
    symbolValid: boolean;
    hasSufficientMargin: boolean;
    requiredMargin: number;
    availableMargin: number;
    lotSizeValid: boolean;
    withinRiskLimits: boolean;
    riskLimitMessage?: string | undefined;
  };
  estimatedCharges: EstimatedTradeCharges;
}

export interface DryRunExecutionResult {
  success: boolean;
  executionMode: "DRY_RUN";
  orderId: string;
  symbol: string;
  transactionType: "BUY" | "SELL";
  productType: string;
  requestedPrice: number;
  simulatedFillPrice: number;
  slippageAmount: number;
  quantity: number;
  orderValue: number;
  charges: EstimatedTradeCharges;
  executedAt: string;
  status: "COMPLETE" | "REJECTED";
  rejectionReason?: string | undefined;
  portfolioState: {
    virtualBalance: number;
    lockedMargin: number;
    realizedPnL: number;
    openPositionsCount: number;
  };
}

export interface VirtualPosition {
  symbol: string;
  exchange: string;
  productType: string;
  quantity: number;
  averagePrice: number;
  currentPrice: number;
  unrealizedPnL: number;
  chargesPaid: number;
  updatedAt: string;
}

export interface DryRunPortfolioSummary {
  startingCapital: number;
  currentCash: number;
  investedValue: number;
  totalPortfolioValue: number;
  totalRealizedPnL: number;
  totalUnrealizedPnL: number;
  netReturnPercent: number;
  totalChargesDeducted: number;
  totalTradesCount: number;
  successfulTradesCount: number;
  positions: VirtualPosition[];
}
