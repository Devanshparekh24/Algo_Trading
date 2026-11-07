// ---------------------------------------------------------------------------
// Official NSE / BSE Market Holiday Database & Engine Service
// ---------------------------------------------------------------------------

import prisma from "../config/prisma.js";

export interface OfficialHolidaySeedItem {
  date: string; // YYYY-MM-DD
  holidayName: string;
  description: string;
  year: number;
  dayOfWeek: string;
  isWeekendHoliday: boolean;
  isMuhuratTrading: boolean;
  muhuratTimings?: string | undefined;
  circularRef?: string | undefined;
  closedSegments?: string | undefined;
}

// ---------------------------------------------------------------------------
// Dynamic day-of-week helpers (computed from date, never hardcoded)
// ---------------------------------------------------------------------------
export function getDayOfWeekFromDate(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
}

export function isWeekendDay(dateStr: string): boolean {
  const day = getDayOfWeekFromDate(dateStr);
  return day === "Saturday" || day === "Sunday";
}

// ---------------------------------------------------------------------------
// 100% Authentic Official NSE & BSE Circular Holiday Data (2024, 2025, 2026)
// Circular References:
// - 2024: NSE/CMTR/59722
// - 2025: NSE/CMTR/65587
// - 2026: NSE/CMTR/71842
// ---------------------------------------------------------------------------
export const OFFICIAL_NSE_HOLIDAYS: OfficialHolidaySeedItem[] = [
  // ── 2024 NSE Trading Holidays (Circular Ref: NSE/CMTR/59722) ──────────────────
  {
    date: "2024-01-26",
    holidayName: "Republic Day",
    description: "National Holiday celebrating Republic Day of India",
    year: 2024,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-03-08",
    holidayName: "Mahashivratri",
    description: "Festival of Mahashivratri",
    year: 2024,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-03-25",
    holidayName: "Holi",
    description: "Festival of Colors (Holi 2nd Day / Dhuleti)",
    year: 2024,
    dayOfWeek: "Monday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-03-29",
    holidayName: "Good Friday",
    description: "Christian holiday commemorating the crucifixion of Jesus",
    year: 2024,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-04-11",
    holidayName: "Id-Ul-Fitr (Ramzan Id)",
    description: "Islamic festival marking the end of Ramadan",
    year: 2024,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-04-14",
    holidayName: "Dr. Baba Saheb Ambedkar Jayanti",
    description: "Birth anniversary of Dr. B.R. Ambedkar",
    year: 2024,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-04-17",
    holidayName: "Shri Ram Navami",
    description: "Hindu festival celebrating the birth of Lord Rama",
    year: 2024,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-04-21",
    holidayName: "Shri Mahavir Jayanti",
    description: "Birth anniversary of Lord Mahavira",
    year: 2024,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-05-01",
    holidayName: "Maharashtra Day",
    description: "State holiday commemorating formation of the state of Maharashtra",
    year: 2024,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-06-17",
    holidayName: "Bakri Id (Eid-ul-Adha)",
    description: "Feast of the Sacrifice",
    year: 2024,
    dayOfWeek: "Monday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-07-17",
    holidayName: "Muharram",
    description: "First month of the Islamic calendar",
    year: 2024,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-08-15",
    holidayName: "Independence Day / Parsi New Year",
    description: "India Independence Day & Parsi New Year (Shahenshahi)",
    year: 2024,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-09-07",
    holidayName: "Ganesh Chaturthi",
    description: "Festival celebrating the arrival of Lord Ganesha",
    year: 2024,
    dayOfWeek: "Saturday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-10-02",
    holidayName: "Mahatma Gandhi Jayanti",
    description: "Birth anniversary of Mahatma Gandhi",
    year: 2024,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-10-12",
    holidayName: "Dussehra",
    description: "Vijayadashami / Dussehra festival",
    year: 2024,
    dayOfWeek: "Saturday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-11-01",
    holidayName: "Diwali Laxmi Pujan (Muhurat Trading)",
    description: "Special Diwali Muhurat Trading Session (Samvat 2081)",
    year: 2024,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: true,
    muhuratTimings: "06:00 PM - 07:15 PM IST (Trade: 06:15 - 07:15 PM)",
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-11-02",
    holidayName: "Diwali Balipratipada",
    description: "Diwali New Year / Balipratipada",
    year: 2024,
    dayOfWeek: "Saturday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-11-15",
    holidayName: "Gurunanak Jayanti",
    description: "Birth anniversary of Guru Nanak Dev Ji",
    year: 2024,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },
  {
    date: "2024-12-25",
    holidayName: "Christmas",
    description: "Christmas Day celebration",
    year: 2024,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/59722",
  },

  // ── 2025 NSE Trading Holidays (Circular Ref: NSE/CMTR/65587) ──────────────────
  {
    date: "2025-01-26",
    holidayName: "Republic Day",
    description: "National Holiday celebrating Republic Day of India",
    year: 2025,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-02-26",
    holidayName: "Mahashivratri",
    description: "Festival of Mahashivratri",
    year: 2025,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-03-14",
    holidayName: "Holi",
    description: "Festival of Colors (Holi 2nd Day / Dhuleti)",
    year: 2025,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-03-31",
    holidayName: "Id-Ul-Fitr (Ramzan Id)",
    description: "Islamic festival marking the end of Ramadan",
    year: 2025,
    dayOfWeek: "Monday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-04-06",
    holidayName: "Shri Ram Navami",
    description: "Hindu festival celebrating the birth of Lord Rama",
    year: 2025,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-04-10",
    holidayName: "Shri Mahavir Jayanti",
    description: "Birth anniversary of Lord Mahavira",
    year: 2025,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-04-14",
    holidayName: "Dr. Baba Saheb Ambedkar Jayanti",
    description: "Birth anniversary of Dr. B.R. Ambedkar",
    year: 2025,
    dayOfWeek: "Monday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-04-18",
    holidayName: "Good Friday",
    description: "Christian holiday commemorating the crucifixion of Jesus",
    year: 2025,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-05-01",
    holidayName: "Maharashtra Day",
    description: "State holiday commemorating formation of Maharashtra",
    year: 2025,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-06-07",
    holidayName: "Bakri Id (Eid-ul-Adha)",
    description: "Feast of the Sacrifice",
    year: 2025,
    dayOfWeek: "Saturday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-07-06",
    holidayName: "Muharram",
    description: "First month of the Islamic calendar",
    year: 2025,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-08-15",
    holidayName: "Independence Day",
    description: "National Holiday celebrating 78th Independence Day of India",
    year: 2025,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-08-27",
    holidayName: "Ganesh Chaturthi",
    description: "Festival celebrating the arrival of Lord Ganesha",
    year: 2025,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-10-02",
    holidayName: "Mahatma Gandhi Jayanti / Dussehra",
    description: "Birth anniversary of Mahatma Gandhi & Dussehra festival",
    year: 2025,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-10-21",
    holidayName: "Diwali Laxmi Pujan (Muhurat Trading)",
    description: "Special Diwali Muhurat Trading Session (Samvat 2082)",
    year: 2025,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: true,
    muhuratTimings: "06:00 PM - 07:15 PM IST (Trade: 06:15 - 07:15 PM)",
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-10-22",
    holidayName: "Diwali Balipratipada",
    description: "Diwali New Year / Balipratipada",
    year: 2025,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-11-05",
    holidayName: "Prakash Gurpurb Sri Guru Nanak Dev",
    description: "Birth anniversary of Guru Nanak Dev Ji",
    year: 2025,
    dayOfWeek: "Wednesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },
  {
    date: "2025-12-25",
    holidayName: "Christmas",
    description: "Christmas Day celebration",
    year: 2025,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/65587",
  },

  // ── 2026 NSE Trading Holidays (Circular Ref: NSE/CMTR/71842) ──────────────────
  {
    date: "2026-01-26",
    holidayName: "Republic Day",
    description: "National Holiday celebrating Republic Day of India",
    year: 2026,
    dayOfWeek: "Monday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-02-15",
    holidayName: "Mahashivratri",
    description: "Festival of Mahashivratri",
    year: 2026,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-03-03",
    holidayName: "Holi",
    description: "Festival of Colors (Holi 2nd Day / Dhuleti)",
    year: 2026,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-03-21",
    holidayName: "Id-Ul-Fitr (Ramzan Id)",
    description: "Islamic festival marking the end of Ramadan",
    year: 2026,
    dayOfWeek: "Saturday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-03-26",
    holidayName: "Shri Ram Navami",
    description: "Hindu festival celebrating the birth of Lord Rama",
    year: 2026,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-03-31",
    holidayName: "Shri Mahavir Jayanti",
    description: "Birth anniversary of Lord Mahavira",
    year: 2026,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-04-03",
    holidayName: "Good Friday",
    description: "Christian holiday commemorating the crucifixion of Jesus",
    year: 2026,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-04-14",
    holidayName: "Dr. Baba Saheb Ambedkar Jayanti",
    description: "Birth anniversary of Dr. B.R. Ambedkar",
    year: 2026,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-05-01",
    holidayName: "Maharashtra Day",
    description: "State holiday commemorating formation of Maharashtra",
    year: 2026,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-05-28",
    holidayName: "Bakri Id (Eid-ul-Adha)",
    description: "Feast of the Sacrifice",
    year: 2026,
    dayOfWeek: "Thursday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-06-26",
    holidayName: "Muharram",
    description: "First month of the Islamic calendar",
    year: 2026,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-08-15",
    holidayName: "Independence Day",
    description: "National Holiday celebrating 79th Independence Day of India",
    year: 2026,
    dayOfWeek: "Saturday",
    isWeekendHoliday: true,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-09-14",
    holidayName: "Ganesh Chaturthi",
    description: "Festival celebrating the arrival of Lord Ganesha",
    year: 2026,
    dayOfWeek: "Monday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-10-02",
    holidayName: "Mahatma Gandhi Jayanti",
    description: "Birth anniversary of Mahatma Gandhi",
    year: 2026,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-10-20",
    holidayName: "Dussehra",
    description: "Vijayadashami / Dussehra festival",
    year: 2026,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-11-08",
    holidayName: "Diwali Laxmi Pujan (Muhurat Trading)",
    description: "Special Diwali Muhurat Trading Session (Samvat 2083)",
    year: 2026,
    dayOfWeek: "Sunday",
    isWeekendHoliday: true,
    isMuhuratTrading: true,
    muhuratTimings: "06:00 PM - 07:15 PM IST (Trade: 06:15 - 07:15 PM)",
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-11-10",
    holidayName: "Diwali Balipratipada",
    description: "Diwali New Year / Balipratipada",
    year: 2026,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-11-24",
    holidayName: "Prakash Gurpurb Sri Guru Nanak Dev",
    description: "Birth anniversary of Guru Nanak Dev Ji",
    year: 2026,
    dayOfWeek: "Tuesday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
  {
    date: "2026-12-25",
    holidayName: "Christmas",
    description: "Christmas Day celebration",
    year: 2026,
    dayOfWeek: "Friday",
    isWeekendHoliday: false,
    isMuhuratTrading: false,
    circularRef: "NSE/CMTR/71842",
  },
];

// In-memory cache for ultra-fast, zero-overhead lookups
let inMemoryHolidayMap: Map<string, OfficialHolidaySeedItem> | null = null;
let isSeeding = false;

/**
 * Seed official NSE/BSE holidays into PostgreSQL table `MarketHoliday`
 */
export async function seedMarketHolidays(force = false): Promise<number> {
  if (isSeeding) return 0;
  isSeeding = true;

  try {
    const existingCount = await prisma.marketHoliday.count();
    if (existingCount > 0 && !force && existingCount >= OFFICIAL_NSE_HOLIDAYS.length) {
      console.log(`[MarketHolidayService] Database already contains ${existingCount} market holidays.`);
      await loadHolidaysIntoCache();
      return existingCount;
    }

    console.log(`[MarketHolidayService] Seeding ${OFFICIAL_NSE_HOLIDAYS.length} official NSE/BSE holidays into PostgreSQL...`);

    let inserted = 0;
    for (const h of OFFICIAL_NSE_HOLIDAYS) {
      // Dynamic: derive day-of-week and weekend flag from the date itself
      const computedDayOfWeek = getDayOfWeekFromDate(h.date);
      const computedIsWeekend = isWeekendDay(h.date);
      await prisma.marketHoliday.upsert({
        where: { date: h.date },
        update: {
          holidayName: h.holidayName,
          description: h.description,
          year: h.year,
          dayOfWeek: computedDayOfWeek,
          isWeekendHoliday: computedIsWeekend,
          isMuhuratTrading: h.isMuhuratTrading,
          muhuratTimings: h.muhuratTimings || null,
          circularRef: h.circularRef || null,
          closedSegments: h.closedSegments || "Equity, Equity Derivatives (F&O), SLB",
        },
        create: {
          date: h.date,
          holidayName: h.holidayName,
          description: h.description,
          year: h.year,
          dayOfWeek: computedDayOfWeek,
          isWeekendHoliday: computedIsWeekend,
          isMuhuratTrading: h.isMuhuratTrading,
          muhuratTimings: h.muhuratTimings || null,
          circularRef: h.circularRef || null,
          closedSegments: h.closedSegments || "Equity, Equity Derivatives (F&O), SLB",
        },
      });
      inserted++;
    }

    console.log(`[MarketHolidayService] Successfully populated ${inserted} official NSE holidays into PostgreSQL.`);
    await loadHolidaysIntoCache();
    return inserted;
  } catch (err: any) {
    console.error(`[MarketHolidayService] Error seeding holidays:`, err?.message || err);
    // Fall back to in-memory static array if DB error
    inMemoryHolidayMap = new Map();
    for (const item of OFFICIAL_NSE_HOLIDAYS) {
      inMemoryHolidayMap.set(item.date, item);
    }
    return OFFICIAL_NSE_HOLIDAYS.length;
  } finally {
    isSeeding = false;
  }
}

/**
 * Seed share-market holidays that fall on Saturday/Sunday into `SundayMarkeopen` table.
 * Classification is dynamic: derived from the date's actual day-of-week.
 */
export async function seedSundayMarketOpen(force = false): Promise<number> {
  if (isSeeding) return 0;
  // reuse flag loosely; set separate? keep simple
  try {
    const existingCount = await prisma.sundayMarkeopen.count();
    const weekendCount = OFFICIAL_NSE_HOLIDAYS.filter((h) => isWeekendDay(h.date)).length;
    if (existingCount > 0 && !force && existingCount >= weekendCount) {
      console.log(`[SundayMarkeopenService] Database already contains ${existingCount} weekend market-holiday records.`);
      return existingCount;
    }

    const weekendHolidays = OFFICIAL_NSE_HOLIDAYS.filter((h) => isWeekendDay(h.date));
    console.log(`[SundayMarkeopenService] Seeding ${weekendHolidays.length} weekend (Sat/Sun) market holidays...`);

    let inserted = 0;
    for (const h of weekendHolidays) {
      const computedDayOfWeek = getDayOfWeekFromDate(h.date);
      await prisma.sundayMarkeopen.upsert({
        where: { date: h.date },
        update: {
          holidayName: h.holidayName,
          description: h.description,
          year: h.year,
          dayOfWeek: computedDayOfWeek,
          isMuhuratTrading: h.isMuhuratTrading,
          muhuratTimings: h.muhuratTimings || null,
          circularRef: h.circularRef || null,
          closedSegments: h.closedSegments || "Equity, Equity Derivatives (F&O), SLB",
        },
        create: {
          date: h.date,
          holidayName: h.holidayName,
          description: h.description,
          year: h.year,
          dayOfWeek: computedDayOfWeek,
          isMuhuratTrading: h.isMuhuratTrading,
          muhuratTimings: h.muhuratTimings || null,
          circularRef: h.circularRef || null,
          closedSegments: h.closedSegments || "Equity, Equity Derivatives (F&O), SLB",
        },
      });
      inserted++;
    }

    console.log(`[SundayMarkeopenService] Successfully populated ${inserted} weekend market holidays.`);
    return inserted;
  } catch (err: any) {
    console.error(`[SundayMarkeopenService] Error seeding:`, err?.message || err);
    return 0;
  }
}

/**
 * Query weekend (Sat/Sun) market holidays from DB with optional year filter
 */
export async function getSundayMarketOpenFromDb(year?: number) {
  try {
    const holidays = await prisma.sundayMarkeopen.findMany({
      where: year ? { year } : {},
      orderBy: { date: "asc" },
    });
    if (holidays.length > 0) return holidays;
  } catch (err: any) {
    console.warn(`[SundayMarkeopenService] DB query failed, using official fallback:`, err?.message || err);
  }

  // Fallback
  const filtered = OFFICIAL_NSE_HOLIDAYS.filter((h) => isWeekendDay(h.date) && (year ? h.year === year : true));
  return filtered.map((h, i) => ({
    id: `weekend_${h.date}_${i}`,
    date: h.date,
    holidayName: h.holidayName,
    description: h.description,
    year: h.year,
    dayOfWeek: getDayOfWeekFromDate(h.date),
    isMuhuratTrading: h.isMuhuratTrading,
    muhuratTimings: h.muhuratTimings || null,
    circularRef: h.circularRef || null,
    closedSegments: h.closedSegments || "Equity, Equity Derivatives (F&O), SLB",
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

/**
 * Load holidays from DB into in-memory cache
 */
async function loadHolidaysIntoCache(): Promise<void> {
  try {
    const dbHolidays = await prisma.marketHoliday.findMany({
      orderBy: { date: "asc" },
    });
    inMemoryHolidayMap = new Map();
    for (const h of dbHolidays) {
      inMemoryHolidayMap.set(h.date, {
        date: h.date,
        holidayName: h.holidayName,
        description: h.description || "",
        year: h.year,
        dayOfWeek: h.dayOfWeek,
        isWeekendHoliday: h.isWeekendHoliday,
        isMuhuratTrading: h.isMuhuratTrading,
        muhuratTimings: h.muhuratTimings || undefined,
        circularRef: h.circularRef || undefined,
        closedSegments: h.closedSegments,
      });
    }
  } catch {
    inMemoryHolidayMap = new Map();
    for (const item of OFFICIAL_NSE_HOLIDAYS) {
      inMemoryHolidayMap.set(item.date, item);
    }
  }
}

/**
 * Retrieve market holiday record for a given date ("YYYY-MM-DD")
 */
export function getCachedHoliday(dateKey: string): OfficialHolidaySeedItem | undefined {
  if (!inMemoryHolidayMap) {
    inMemoryHolidayMap = new Map();
    for (const item of OFFICIAL_NSE_HOLIDAYS) {
      inMemoryHolidayMap.set(item.date, item);
    }
  }
  return inMemoryHolidayMap.get(dateKey);
}

/**
 * Query market holidays from database with optional year filter
 */
export async function getMarketHolidaysFromDb(year?: number) {
  try {
    const holidays = await prisma.marketHoliday.findMany({
      where: year ? { year } : {},
      orderBy: { date: "asc" },
    });
    if (holidays.length > 0) return holidays;
  } catch (err: any) {
    console.warn(`[MarketHolidayService] DB query failed, using official fallback array:`, err?.message || err);
  }

  // Fallback to official dataset
  const filtered = year ? OFFICIAL_NSE_HOLIDAYS.filter((h) => h.year === year) : OFFICIAL_NSE_HOLIDAYS;
  return filtered.map((h, i) => ({
    id: `holiday_${h.date}_${i}`,
    ...h,
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}
