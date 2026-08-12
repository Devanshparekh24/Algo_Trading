export interface UserProfile {
  clientcode: string;
  name: string;
  email: string;
  mobileno: string;
  exg: string[];
  lastaccesstime: string;
}

export interface Position {
  exchange?: string;
  tradingsymbol?: string;
  symboltoken?: string;
  producttype?: string;
  transactiontype?: string;
  quantity?: string | number;
  averageprice?: string | number;
  netqty?: string | number;
  lp?: string | number;
  pnl?: string | number;
  m2m?: string | number;
}

export interface ApiResponse<T> {
  statusCode: number;
  data: T;
  message: string;
  success: boolean;
}

export interface RMSData {
  net?: string | number;
  availablecash?: string | number;
  collateral?: string | number;
  m2mUnrealized?: string | number;
  m2mRealized?: string | number;
  utilisedDebits?: string | number;
  utilisedOptionpremium?: string | number;
  utilisedPayOut?: string | number;
  utilisedHoldings?: string | number;
  [key: string]: unknown;
}

