// ---------------------------------------------------------------------------
// AI Universe Management Service
// Dynamic and custom universe resolution, Demat holdings, and Top Movers
// ---------------------------------------------------------------------------

import fs from "fs";
import path from "path";
import prisma from "../../config/prisma.js";
import { getHoldings } from "../smartapi/api/holdings.js";
import { getGainersLosersData } from "../smartapi/api/gainersLosers.js";
import { getInstrumentLotSize } from "../smartapi/instrument.service.js";
import type {
  MarketSegment,
  ScripCandidate,
  AddScripInput,
  FnoCandidate,
  ContractType,
} from "../../types/aiTrading.types.js";

// Default High-Liquidity Equity Universe
export const DEFAULT_UNIVERSE: ScripCandidate[] = [
  { symbol: "RELIANCE-EQ", token: "2885", exchange: "NSE", name: "Reliance Industries", segment: "EQUITY", source: "CORE" },
  { symbol: "TATASTEEL-EQ", token: "3499", exchange: "NSE", name: "Tata Steel", segment: "EQUITY", source: "CORE" },
  { symbol: "SBIN-EQ", token: "3045", exchange: "NSE", name: "State Bank of India", segment: "EQUITY", source: "CORE" },
  { symbol: "HDFCBANK-EQ", token: "1333", exchange: "NSE", name: "HDFC Bank", segment: "EQUITY", source: "CORE" },
  { symbol: "INFY-EQ", token: "1594", exchange: "NSE", name: "Infosys Ltd", segment: "EQUITY", source: "CORE" },
  { symbol: "ICICIBANK-EQ", token: "4963", exchange: "NSE", name: "ICICI Bank", segment: "EQUITY", source: "CORE" },
  { symbol: "TCS-EQ", token: "11536", exchange: "NSE", name: "Tata Consultancy Services", segment: "EQUITY", source: "CORE" },
  { symbol: "ITC-EQ", token: "1660", exchange: "NSE", name: "ITC Ltd", segment: "EQUITY", source: "CORE" },
  { symbol: "LT-EQ", token: "11483", exchange: "NSE", name: "Larsen & Toubro", segment: "EQUITY", source: "CORE" },
  { symbol: "BHARTIARTL-EQ", token: "10604", exchange: "NSE", name: "Bharti Airtel", segment: "EQUITY", source: "CORE" },
];

// Default High-Liquidity Futures & Options Universe
export const DEFAULT_FNO_UNIVERSE: FnoCandidate[] = [
  { symbol: "NIFTY03NOV2625000PE", token: "54333", exchange: "NFO", name: "NIFTY 25000 PE", segment: "FNO", contractType: "PE", strike: 25000, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2625000CE", token: "54332", exchange: "NFO", name: "NIFTY 25000 CE", segment: "FNO", contractType: "CE", strike: 25000, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2624500PE", token: "54177", exchange: "NFO", name: "NIFTY 24500 PE", segment: "FNO", contractType: "PE", strike: 24500, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2624500CE", token: "54136", exchange: "NFO", name: "NIFTY 24500 CE", segment: "FNO", contractType: "CE", strike: 24500, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2625200PE", token: "54451", exchange: "NFO", name: "NIFTY 25200 PE", segment: "FNO", contractType: "PE", strike: 25200, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "NIFTY03NOV2625200CE", token: "54450", exchange: "NFO", name: "NIFTY 25200 CE", segment: "FNO", contractType: "CE", strike: 25200, expiry: "03NOV2026", lotSize: 65, underlying: "NIFTY", source: "CORE" },
  { symbol: "BANKNIFTY23NOV2653400PE", token: "62109", exchange: "NFO", name: "BANKNIFTY 53400 PE", segment: "FNO", contractType: "PE", strike: 53400, expiry: "23NOV2026", lotSize: 30, underlying: "BANKNIFTY", source: "CORE" },
  { symbol: "BANKNIFTY29DEC2653100CE", token: "59517", exchange: "NFO", name: "BANKNIFTY 53100 CE", segment: "FNO", contractType: "CE", strike: 53100, expiry: "29DEC2026", lotSize: 30, underlying: "BANKNIFTY", source: "CORE" },
];

// Persistence for custom universe list
const DATA_DIR = path.resolve(process.cwd(), "data");
const CUSTOM_UNIVERSE_FILE = path.join(DATA_DIR, "custom_universe.json");

function ensureDataDir(): void {
  if (!fs.existsSync(DATA_DIR)) {
    try {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    } catch (e) {
      console.warn("[AI Dynamic Universe] Could not create data directory:", e);
    }
  }
}

export function loadCustomUniverse(): ScripCandidate[] {
  try {
    ensureDataDir();
    if (fs.existsSync(CUSTOM_UNIVERSE_FILE)) {
      const raw = fs.readFileSync(CUSTOM_UNIVERSE_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn("[AI Dynamic Universe] Error reading custom_universe.json:", err);
  }
  return [];
}

export function saveCustomUniverse(items: ScripCandidate[]): void {
  try {
    ensureDataDir();
    fs.writeFileSync(CUSTOM_UNIVERSE_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (err) {
    console.error("[AI Dynamic Universe] Failed to save custom_universe.json:", err);
  }
}

/**
 * Dynamically resolves the active market universe based on:
 * 1. User custom watchlists (saved to JSON)
 * 2. Active Demat holdings (from Angel One SmartAPI)
 * 3. Real-time top Market Movers (Price Gainers/Losers or OI Movers from SmartAPI)
 * 4. High-liquidity Core Index constituents & Options
 */
export async function getDynamicUniverse(segment: MarketSegment = "EQUITY"): Promise<ScripCandidate[]> {
  const universeMap = new Map<string, ScripCandidate>();

  // 1. User-Configured Custom Universe
  const customItems = loadCustomUniverse();
  for (const item of customItems) {
    const isFno =
      item.segment === "FNO" ||
      item.exchange === "NFO" ||
      item.symbol.endsWith("PE") ||
      item.symbol.endsWith("CE") ||
      item.symbol.endsWith("FUT");

    if ((segment === "FNO" && isFno) || (segment === "EQUITY" && !isFno)) {
      universeMap.set(item.token, {
        ...item,
        segment: isFno ? "FNO" : "EQUITY",
        source: "CUSTOM",
      });
    }
  }

  if (segment === "EQUITY") {
    // 2. Dynamically include User's Demat Holdings
    try {
      const holdingsRes = await getHoldings();
      if (holdingsRes && holdingsRes.holdings) {
        for (const h of holdingsRes.holdings) {
          if (h.symboltoken && h.tradingsymbol && !universeMap.has(String(h.symboltoken))) {
            universeMap.set(String(h.symboltoken), {
              symbol: h.tradingsymbol,
              token: String(h.symboltoken),
              exchange: h.exchange || "NSE",
              name: h.tradingsymbol,
              segment: "EQUITY",
              source: "HOLDING",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not fetch holdings for scan universe:`, err?.message || err);
    }

    // 3. Dynamically fetch Top Market Movers (Price Gainers & Losers)
    try {
      const [gainersRes, losersRes] = await Promise.allSettled([
        getGainersLosersData({ datatype: "PercPriceGainers", expirytype: "NEAR" }),
        getGainersLosersData({ datatype: "PercPriceLosers", expirytype: "NEAR" }),
      ]);

      if (gainersRes.status === "fulfilled" && gainersRes.value?.data) {
        for (const g of gainersRes.value.data.slice(0, 3)) {
          const t = String(g.symbolToken);
          if (g.symbolToken && g.tradingSymbol && !universeMap.has(t)) {
            universeMap.set(t, {
              symbol: g.tradingSymbol,
              token: t,
              exchange: "NSE",
              name: `${g.tradingSymbol} (Top Gainer)`,
              segment: "EQUITY",
              source: "MARKET_MOVER",
            });
          }
        }
      }

      if (losersRes.status === "fulfilled" && losersRes.value?.data) {
        for (const l of losersRes.value.data.slice(0, 3)) {
          const t = String(l.symbolToken);
          if (l.symbolToken && l.tradingSymbol && !universeMap.has(t)) {
            universeMap.set(t, {
              symbol: l.tradingSymbol,
              token: t,
              exchange: "NSE",
              name: `${l.tradingSymbol} (Top Loser)`,
              segment: "EQUITY",
              source: "MARKET_MOVER",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not fetch equity market movers:`, err?.message || err);
    }

    // 4. Dynamically pull Core Liquid Equities from SmartAPI Instrument Database
    try {
      const topSymbols = [
        "RELIANCE-EQ", "TCS-EQ", "HDFCBANK-EQ", "INFY-EQ", "ICICIBANK-EQ",
        "SBIN-EQ", "BHARTIARTL-EQ", "ITC-EQ", "LT-EQ", "TATASTEEL-EQ",
        "KOTAKBANK-EQ", "AXISBANK-EQ", "TATAMOTORS-EQ", "MARUTI-EQ", "SUNPHARMA-EQ"
      ];
      const dbEquities = await prisma.instrument.findMany({
        where: {
          exch_seg: "NSE",
          symbol: { in: topSymbols },
        },
        take: 15,
      });

      for (const inst of dbEquities) {
        if (!universeMap.has(inst.token)) {
          universeMap.set(inst.token, {
            symbol: inst.symbol,
            token: inst.token,
            exchange: inst.exch_seg,
            name: inst.name || inst.symbol,
            segment: "EQUITY",
            lotSize: parseInt(inst.lotsize) || 1,
            source: "CORE",
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not load core equities from SmartAPI Instrument table:`, err?.message || err);
    }

    // Safety fallback
    for (const core of DEFAULT_UNIVERSE) {
      if (!universeMap.has(core.token)) {
        universeMap.set(core.token, {
          ...core,
          segment: "EQUITY",
          source: "CORE",
        });
      }
    }
  } else {
    // Segment === "FNO"
    // 2. Dynamically fetch Top OI Movers for F&O
    try {
      const oiGainersRes = await getGainersLosersData({ datatype: "PercOIGainers", expirytype: "NEAR" });
      if (oiGainersRes?.data) {
        for (const oiItem of oiGainersRes.data.slice(0, 4)) {
          const t = String(oiItem.symbolToken);
          if (oiItem.symbolToken && oiItem.tradingSymbol && !universeMap.has(t)) {
            const sym = oiItem.tradingSymbol;
            const isCall = sym.endsWith("CE");
            const isPut = sym.endsWith("PE");
            const contractType: ContractType = isCall ? "CE" : isPut ? "PE" : "FUT";
            universeMap.set(t, {
              symbol: sym,
              token: t,
              exchange: "NFO",
              name: `${sym} (OI Mover)`,
              segment: "FNO",
              contractType,
              lotSize: await getInstrumentLotSize(sym, 1),
              underlying: sym.startsWith("BANKNIFTY") ? "BANKNIFTY" : "NIFTY",
              source: "MARKET_MOVER",
            });
          }
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not fetch FNO OI movers:`, err?.message || err);
    }

    // 3. Dynamically pull Core F&O Options from SmartAPI Instrument Database
    try {
      const dbOptions = await prisma.instrument.findMany({
        where: {
          exch_seg: "NFO",
          instrumenttype: "OPTIDX",
          name: { in: ["NIFTY", "BANKNIFTY"] },
        },
        take: 12,
        orderBy: { expiry: "asc" },
      });

      for (const inst of dbOptions) {
        if (!universeMap.has(inst.token)) {
          const sym = inst.symbol;
          const isCall = sym.endsWith("CE");
          const isPut = sym.endsWith("PE");
          const contractType: ContractType = isCall ? "CE" : isPut ? "PE" : "FUT";
          const rawStrike = parseFloat(inst.strike);
          const strike = isNaN(rawStrike) ? undefined : rawStrike > 100000 ? rawStrike / 100 : rawStrike;

          universeMap.set(inst.token, {
            symbol: inst.symbol,
            token: inst.token,
            exchange: "NFO",
            name: `${inst.name} ${strike || ""} ${contractType}`,
            segment: "FNO",
            contractType,
            strike,
            expiry: inst.expiry,
            lotSize: parseInt(inst.lotsize) || (await getInstrumentLotSize(sym, 1)),
            underlying: inst.name,
            source: "CORE",
          });
        }
      }
    } catch (err: any) {
      console.warn(`[AI Dynamic Universe] Could not load core F&O options from SmartAPI Instrument table:`, err?.message || err);
    }

    // Fallback if DB empty
    for (const core of DEFAULT_FNO_UNIVERSE) {
      if (!universeMap.has(core.token)) {
        universeMap.set(core.token, {
          ...core,
          segment: "FNO",
          source: "CORE",
        });
      }
    }
  }

  return Array.from(universeMap.values());
}

/**
 * Get universe scrips for a segment or combined
 */
export async function getUniverseScrips(segment?: MarketSegment): Promise<ScripCandidate[]> {
  if (segment) {
    return await getDynamicUniverse(segment);
  }
  const [eq, fno] = await Promise.all([getDynamicUniverse("EQUITY"), getDynamicUniverse("FNO")]);
  return [...eq, ...fno];
}

/**
 * Add or update custom scrip in dynamic universe
 */
export async function addCustomUniverseScrip(scrip: AddScripInput): Promise<ScripCandidate[]> {
  const current = loadCustomUniverse();

  let resolvedToken = scrip.token ? String(scrip.token).trim() : "";
  let resolvedExchange = scrip.exchange ? scrip.exchange.toUpperCase().trim() : "";
  let resolvedName = scrip.name || scrip.symbol;
  let resolvedLotSize = scrip.lotSize;
  let resolvedStrike = scrip.strike;
  let resolvedExpiry = scrip.expiry;

  // Auto-resolve token and instrument metadata from SmartAPI Instrument Database if token is missing
  if (!resolvedToken) {
    try {
      const match = await prisma.instrument.findFirst({
        where: {
          OR: [
            { symbol: { equals: scrip.symbol.toUpperCase().trim() } },
            { symbol: { equals: `${scrip.symbol.toUpperCase().trim()}-EQ` } },
            { name: { equals: scrip.symbol.toUpperCase().trim() } },
          ],
        },
      });
      if (match) {
        resolvedToken = match.token;
        resolvedExchange = match.exch_seg;
        resolvedName = match.name || match.symbol;
        resolvedLotSize = parseInt(match.lotsize) || 1;
        resolvedExpiry = match.expiry;
        const rawStrike = parseFloat(match.strike);
        if (!isNaN(rawStrike) && rawStrike > 0) {
          resolvedStrike = rawStrike > 100000 ? rawStrike / 100 : rawStrike;
        }
      }
    } catch (e: any) {
      console.warn("[addCustomUniverseScrip] DB instrument resolution failed:", e?.message || e);
    }
  }

  if (!resolvedToken) {
    throw new Error(`Could not find SmartAPI instrument token for "${scrip.symbol}". Please check the symbol or sync scrip master.`);
  }

  const existingIdx = current.findIndex((item) => item.token === resolvedToken);

  const isFno =
    scrip.segment === "FNO" ||
    resolvedExchange === "NFO" ||
    scrip.symbol.endsWith("PE") ||
    scrip.symbol.endsWith("CE") ||
    scrip.symbol.endsWith("FUT");

  const formatted: ScripCandidate = {
    symbol: scrip.symbol.toUpperCase().trim(),
    token: resolvedToken,
    exchange: resolvedExchange || (isFno ? "NFO" : "NSE"),
    name: resolvedName,
    segment: isFno ? "FNO" : "EQUITY",
    contractType: scrip.contractType || (scrip.symbol.endsWith("CE") ? "CE" : scrip.symbol.endsWith("PE") ? "PE" : scrip.symbol.endsWith("FUT") ? "FUT" : "EQ"),
    strike: resolvedStrike,
    expiry: resolvedExpiry,
    lotSize: resolvedLotSize || (isFno ? (await getInstrumentLotSize(scrip.symbol, 1)) : 1),
    underlying: scrip.underlying,
    source: "CUSTOM",
  };

  if (existingIdx >= 0) {
    current[existingIdx] = formatted;
  } else {
    current.push(formatted);
  }

  saveCustomUniverse(current);
  return await getDynamicUniverse(formatted.segment);
}

/**
 * Remove scrip from custom universe
 */
export async function removeCustomUniverseScrip(token: string): Promise<ScripCandidate[]> {
  const current = loadCustomUniverse();
  const filtered = current.filter((item) => item.token !== token);
  saveCustomUniverse(filtered);
  return await getUniverseScrips();
}

/**
 * Reset custom universe back to defaults
 */
export async function resetCustomUniverse(): Promise<ScripCandidate[]> {
  saveCustomUniverse([]);
  return await getUniverseScrips();
}
