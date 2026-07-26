export interface MarketTick {
  symbol: string;
  token: string;
  lastTradedPrice: number;
  volume: number;
  timestamp: Date;
}

export interface TradeSignal {
  action: "BUY" | "SELL" | "HOLD";
  symbol: string;
  token: string;
  quantity: number;
  price?: number;
  reason?: string;
}

export abstract class BaseStrategy {
  public abstract name: string;
  public abstract enabled: boolean;

  /**
   * Process an incoming market tick and return a trade signal if conditions are met.
   */
  public abstract onTick(tick: MarketTick): Promise<TradeSignal | null>;
}
