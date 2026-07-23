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
 * Background scheduler check at startup and every 24 hours.
 */
export async function startInstrumentScheduler(): Promise<void> {
  console.log("[InstrumentService] Starting instrument scheduler...");

  // Run initial check
  try {
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
