// ===========================================================================
// Enterprise Order Router & Execution Dispatcher
// ===========================================================================
// Routes orders securely between:
// - DRY_RUN (Default simulation engine with zero financial risk)
// - LIVE (Angel One SmartAPI with authenticated token and user confirmation)

import type { OrderPlacementRequest, OrderPlacementResponse } from "../smartapi/types.js";
import type { DryRunExecutionResult, DryRunPreTradeCheck, ExecutionMode } from "../../shared/types.js";
import { dryRunEngine } from "./dryRunEngine.js";
import { placeSmartApiOrder } from "../smartapi/api/order.js";
import { broadcastSocketEvent } from "../websocket/socketService.js";

export interface RoutedOrderResult {
  mode: ExecutionMode;
  success: boolean;
  orderId: string;
  symbol: string;
  details: DryRunExecutionResult | OrderPlacementResponse;
  message: string;
}

/**
 * Route an order according to the requested execution mode
 */
export async function routeOrder(
  req: OrderPlacementRequest,
  mode: ExecutionMode = "DRY_RUN",
  currentPrice: number = 0
): Promise<RoutedOrderResult> {
  if (mode === "DRY_RUN") {
    const dryResult = dryRunEngine.executeDryRun(req, currentPrice);

    broadcastSocketEvent("dry_run_order_executed", {
      order: dryResult,
      timestamp: new Date().toISOString(),
    });

    return {
      mode: "DRY_RUN",
      success: dryResult.success,
      orderId: dryResult.orderId,
      symbol: req.tradingsymbol,
      details: dryResult,
      message: dryResult.success
        ? `[Dry Run] Simulated order ${req.transactiontype} filled @ ₹${dryResult.simulatedFillPrice}`
        : `[Dry Run] Order rejected: ${dryResult.rejectionReason}`,
    };
  }

  // LIVE Execution
  const liveResult = await placeSmartApiOrder(req, false);

  broadcastSocketEvent("live_order_executed", {
    order: liveResult,
    timestamp: new Date().toISOString(),
  });

  return {
    mode: "LIVE",
    success: true,
    orderId: liveResult.orderid,
    symbol: liveResult.script,
    details: liveResult,
    message: `[Live Broker] Order placed successfully: OrderID ${liveResult.orderid}`,
  };
}

/**
 * Run pre-trade dry run check without executing
 */
export function validatePreTrade(
  req: OrderPlacementRequest,
  currentPrice: number
): DryRunPreTradeCheck {
  return dryRunEngine.preTradeCheck(req, currentPrice);
}
