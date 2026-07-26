export interface Instrument {
  token: string;
  symbol: string;
  name: string;
  expiry: string;
  strike: string;
  lotsize: string;
  instrumenttype: string;
  exch_seg: string;
  tick_size: string;
}

export interface MarketTick {
  token: string;
  symbol: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  changePercent: number;
}

export interface Order {
  id: string;
  symbol: string;
  token: string;
  type: "MARKET" | "LIMIT" | "STOPLOSS";
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  status: "PENDING" | "EXECUTED" | "CANCELLED" | "REJECTED";
  createdAt: string;
}
