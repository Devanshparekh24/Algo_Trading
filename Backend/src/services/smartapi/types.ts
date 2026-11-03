// ---------------------------------------------------------------------------
// SmartAPI Type Definitions
// ---------------------------------------------------------------------------

export interface LoginResponse {
  jwtToken: string;
  refreshToken: string;
  feedToken: string;
  /** Human-readable message from the API */
  message?: string;
}

export interface UserProfile {
  clientcode: string;
  name: string;
  email: string;
  mobileno: string;
  exg: string[];
  lastaccesstime: string;
}

export interface RMSData {
  net?: string;
  availablecash?: string;
  collateral?: string;
  m2mUnrealized?: string;
  m2mRealized?: string;
  utilisedDebits?: string;
  utilisedOptionpremium?: string;
  utilisedPayOut?: string;
  utilisedHoldings?: string;
  [key: string]: unknown;
}


export interface Position {
  exchange?: string;
  tradingsymbol?: string;
  symboltoken?: string;
  producttype?: string;
  transactiontype?: string;
  quantity?: string;
  averageprice?: string;
  netqty?: string;
  lp?: string;
  pnl?: string;
  m2m?: string;
  [key: string]: unknown;
}

export interface Holding {
  isin?: string;
  t1quantity?: number;
  authorisedquantity?: number;
  collateralquantity?: number | null;
  collateraltype?: string | null;
  haircut?: number;
  pnlpercentage?: number;
  tradingsymbol?: string;
  exchange?: string;
  symboltoken?: string;
  quantity?: number;
  product?: string;
  averageprice?: number;
  ltp?: number;
  close?: number;
  profitandloss?: number;
  realisedquantity?: number;
  [key: string]: unknown;
}

export interface TotalHolding {
  totalholdingvalue?: number;
  totalinvvalue?: number;
  totalprofitandloss?: number;
  totalpnlpercentage?: number;
  [key: string]: unknown;
}

export interface HoldingsPayload {
  holdings: Holding[];
  totalholding?: TotalHolding;
}

export interface OrderPlacementRequest {
  variety: "NORMAL" | "STOPLOSS" | "AMO" | "ROBO" | string;
  tradingsymbol: string;
  symboltoken: string;
  transactiontype: "BUY" | "SELL";
  exchange: "NSE" | "BSE" | "NFO" | "MCX" | string;
  ordertype: "MARKET" | "LIMIT" | "STOPLOSS_LIMIT" | "STOPLOSS_MARKET" | string;
  producttype: "DELIVERY" | "INTRADAY" | "MARGIN" | "CARRYFORWARD" | "BO" | string;
  duration: "DAY" | "IOC" | string;
  price: string | number;
  squareoff?: string | number | undefined;
  stoploss?: string | number | undefined;
  quantity: string | number;
  triggerprice?: string | number | undefined;
}

export interface OrderPlacementResponse {
  script: string;
  orderid: string;
  uniqueorderid?: string;
}

export interface OrderBookItem {
  variety: string;
  ordertype: string;
  producttype: string;
  duration: string;
  price: number;
  triggerprice: number;
  quantity: string | number;
  disclosedquantity?: string | number | undefined;
  squareoff?: number | undefined;
  stoploss?: number | undefined;
  trailingstoploss?: number | undefined;
  tradingsymbol: string;
  transactiontype: "BUY" | "SELL";
  exchange: string;
  symboltoken: string;
  instrumenttype?: string | undefined;
  strikeprice?: number | undefined;
  optiontype?: string | undefined;
  expirydate?: string | undefined;
  lotsize?: string | number | undefined;
  cancelsize?: string | number | undefined;
  averageprice: number;
  filledshares: string | number;
  unfilledshares: string | number;
  orderid: string;
  text?: string | undefined;
  status: string;
  orderstatus: string;
  updatetime?: string | undefined;
  exchtime?: string | undefined;
  exchorderupdatetime?: string | undefined;
  fillid?: string | undefined;
  filltime?: string | undefined;
  parentorderid?: string | undefined;
  uniqueorderid?: string | undefined;
}

export interface TokenStore {
  jwtToken: string | null;
  refreshToken: string | null;
  feedToken: string | null;
  issuedAt: Date | null;
}

export interface HistoricalDataRequest {
  exchange: string;
  symboltoken: string;
  interval: string;
  fromdate: string;
  todate: string;
}

export type CandleData = [string, number, number, number, number, number];

export interface LtpDataRequest {
  exchange: string;
  tradingsymbol: string;
  symboltoken: string;
}

export interface LtpDataResponse {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  open: number | string;
  high: number | string;
  low: number | string;
  close: number | string;
  ltp: number | string;
}

export interface FullModeRequest {
  mode: "FULL" | "OHLC" | "LTP" | string;
  exchangeTokens: Record<string, string[]>;
  tradingsymbol?: string;
  exchange?: string;
  symboltoken?: string;
}

export interface FullModeResponse {
  status: boolean;
  message: string;
  errorcode: string;
  data: {
    fetched: FullMode[];
    unfetched: UnFetched[];
  };
}

export interface FullMode {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
  ltp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  lastTradeQty: number;
  exchFeedTime: string;
  exchTradeTime: string;
  netChange: number;
  percentChange: number;
  avgPrice: number;
  tradeVolume: number;
  opnInterest: number;
  lowerCircuit: number;
  upperCircuit: number;
  totBuyQuan: number;
  totSellQuan: number;
  "52WeekLow": number;
  "52WeekHigh": number;
  depth: MarketDepth;
}
export interface MarketDepth {
  buy: DepthOrder[];
  sell: DepthOrder[];
}

export interface DepthOrder {
  price: number;
  quantity: number;
  orders: number;
}

export interface UnFetched {
  exchange: string;
  tradingSymbol: string;
  symbolToken: string;
}