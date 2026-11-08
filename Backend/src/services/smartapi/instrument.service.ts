import prisma from "../../config/prisma.js";
import axios from "axios";

export interface InstrumentData {
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

let isSyncing = false;

/**
 * Fetch the instrument master from Angel One and populate it in PostgreSQL.
 */
export async function syncInstruments(): Promise<void> {
  if (isSyncing) {
    throw new Error("Instrument sync is already in progress.");
  }

  isSyncing = true;
  try {
    console.log("[InstrumentService] Fetching scrip master from Angel One...");
    const url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";

    const response = await axios.get<InstrumentData[]>(url);
    const instruments = response.data;
    
    if (!Array.isArray(instruments) || instruments.length === 0) {
      throw new Error("Received empty or invalid instrument list from Angel One API.");
    }

    console.log(`[InstrumentService] Downloaded ${instruments.length} instruments. Syncing with database...`);

    // We clear all existing instruments first for a clean sync of active scripts
    await prisma.instrument.deleteMany({});
    console.log("[InstrumentService] Cleared existing instruments from PostgreSQL.");

    const chunkSize = 5000;
    const total = instruments.length;

    for (let i = 0; i < total; i += chunkSize) {
      const chunk = instruments.slice(i, i + chunkSize);
      const dataToInsert = chunk.map((inst) => ({
        token: inst.token,
        symbol: inst.symbol,
        name: inst.name,
        expiry: inst.expiry,
        strike: inst.strike,
        lotsize: inst.lotsize,
        instrumenttype: inst.instrumenttype,
        exch_seg: inst.exch_seg,
        tick_size: inst.tick_size,
      }));

      await prisma.instrument.createMany({
        data: dataToInsert,
        skipDuplicates: true,
      });

      const batchNum = Math.floor(i / chunkSize) + 1;
      const totalBatches = Math.ceil(total / chunkSize);
      if (batchNum % 5 === 0 || i + chunkSize >= total) {
        console.log(`[InstrumentService] Inserted batch ${batchNum}/${totalBatches}`);
      }
    }

    console.log("[InstrumentService] Successfully populated all instruments in PostgreSQL.");
  } finally {
    isSyncing = false;
  }
}

const lotSizeCache = new Map<string, number>();

/**
 * Dynamic DB-driven lot size resolver.
 * Looks up the authoritative lot size from PostgreSQL `Instrument` table.
 * Caches in-memory for zero-latency lookups without DB bottlenecks.
 */
export async function getInstrumentLotSize(
  symbolOrToken: string,
  fallback?: number
): Promise<number> {
  if (!symbolOrToken) return fallback ?? 1;
  const clean = symbolOrToken.trim();
  const upper = clean.toUpperCase();

  if (lotSizeCache.has(upper)) {
    return lotSizeCache.get(upper)!;
  }

  try {
    // 1. Direct match on token, exact symbol, or name
    const inst = await prisma.instrument.findFirst({
      where: {
        OR: [
          { token: clean },
          { symbol: upper },
          { name: upper },
        ],
      },
      select: { lotsize: true },
    });

    if (inst?.lotsize) {
      const parsed = parseInt(inst.lotsize, 10);
      if (!isNaN(parsed) && parsed > 0) {
        lotSizeCache.set(upper, parsed);
        return parsed;
      }
    }

    // 2. Base derivative root lookup in NFO segment (e.g. "BANKNIFTY", "NIFTY", "FINNIFTY")
    const baseName = upper.startsWith("BANKNIFTY")
      ? "BANKNIFTY"
      : upper.startsWith("FINNIFTY")
      ? "FINNIFTY"
      : upper.startsWith("MIDCPNIFTY")
      ? "MIDCPNIFTY"
      : upper.startsWith("NIFTY")
      ? "NIFTY"
      : null;

    if (baseName) {
      const baseInst = await prisma.instrument.findFirst({
        where: { name: baseName, exch_seg: "NFO" },
        select: { lotsize: true },
      });
      if (baseInst?.lotsize) {
        const parsed = parseInt(baseInst.lotsize, 10);
        if (!isNaN(parsed) && parsed > 0) {
          lotSizeCache.set(upper, parsed);
          return parsed;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[InstrumentService] Failed to lookup lot size for ${symbolOrToken}:`, err?.message || err);
  }

  const defaultFallback = fallback ?? (upper.startsWith("BANKNIFTY") ? 30 : upper.startsWith("NIFTY") ? 65 : 1);
  lotSizeCache.set(upper, defaultFallback);
  return defaultFallback;
}

/**
 * Perform a database-driven search for instruments.
 */
export async function searchInstruments(params: {
  query: string;
  exchange?: string | undefined;
  limit?: number | undefined;
}) {
  const limit = params.limit ?? 50;
  const searchVal = params.query.trim();

  return prisma.instrument.findMany({
    where: {
      AND: [
        {
          OR: [
            { symbol: { contains: searchVal, mode: "insensitive" } },
            { name: { contains: searchVal, mode: "insensitive" } },
          ],
        },
        params.exchange ? { exch_seg: { equals: params.exchange.toUpperCase().trim() } } : {},
      ],
    },
    take: limit,
  });
}

/**
 * Ensure the Instrument table and indexes exist in PostgreSQL.
 */
export async function ensureInstrumentTable(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Instrument" (
        "id" TEXT NOT NULL,
        "token" TEXT NOT NULL,
        "symbol" TEXT NOT NULL,
        "name" TEXT NOT NULL,
        "expiry" TEXT NOT NULL,
        "strike" TEXT NOT NULL,
        "lotsize" TEXT NOT NULL,
        "instrumenttype" TEXT NOT NULL,
        "exch_seg" TEXT NOT NULL,
        "tick_size" TEXT NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT "Instrument_pkey" PRIMARY KEY ("id")
    );
  `);
  await prisma.$executeRawUnsafe(`CREATE UNIQUE INDEX IF NOT EXISTS "Instrument_token_key" ON "Instrument"("token");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Instrument_symbol_idx" ON "Instrument"("symbol");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Instrument_exch_seg_idx" ON "Instrument"("exch_seg");`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Instrument_name_idx" ON "Instrument"("name");`);
}

/**
 * Background scheduler check at startup and every 24 hours.
 */
export async function startInstrumentScheduler(): Promise<void> {
  console.log("[InstrumentService] Starting instrument scheduler...");

  // Run initial check
  try {
    await ensureInstrumentTable();
    const count = await prisma.instrument.count();
    let needsSync = count === 0;

    if (!needsSync) {
      const latest = await prisma.instrument.findFirst({
        orderBy: { updatedAt: "desc" },
      });
      if (latest) {
        const diffMs = Date.now() - latest.updatedAt.getTime();
        needsSync = diffMs > 24 * 60 * 60 * 1000; // 24 hours
      }
    }

    if (needsSync) {
      console.log("[InstrumentService] Local database is empty or stale. Syncing in the background...");
      syncInstruments().catch((err) =>
        console.error("[InstrumentService] Initial sync failed:", err.message)
      );
    } else {
      console.log("[InstrumentService] Local instrument database is current.");
    }
  } catch (err: any) {
    console.error("[InstrumentService] Startup check failed:", err.message);
  }

  // Check every 24 hours
  setInterval(() => {
    console.log("[InstrumentService] Running daily scheduled instrument sync...");
    syncInstruments().catch((err) =>
      console.error("[InstrumentService] Scheduled sync failed:", err.message)
    );
  }, 24 * 60 * 60 * 1000);
}
