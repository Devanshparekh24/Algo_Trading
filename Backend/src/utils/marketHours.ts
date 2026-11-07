/**
 * Indian Stock Market (NSE / BSE / NFO) Hours & Status Helper.
 * Operates in Indian Standard Time (IST, UTC+5:30).
 * 100% DYNAMIC: Backed by PostgreSQL `MarketHoliday` table with official NSE circular data!
 * (Zero hardcoded holiday maps).
 */

import { getCachedHoliday } from "../services/marketHoliday.service.js";

export interface MarketStatusInfo {
  isOpen: boolean;
  status: "OPEN" | "CLOSED" | "PRE_MARKET" | "POST_MARKET";
  subStatus:
    | "REGULAR"
    | "PRE_MARKET"
    | "POST_MARKET"
    | "CLOSING_SESSION"
    | "WEEKEND"
    | "HOLIDAY"
    | "BEFORE_MARKET"
    | "AFTER_HOURS"
    | "MUHURAT_TRADING";
  message: string;
  closeReason: string;
  exchange: string;
  timeIST: string;
  tradingHours: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  nextSession: string;
  isMuhuratTrading?: boolean;
}

interface IstParts {
  weekday: string;
  weekdayName: string;
  year: string;
  month: string;
  monthName: string;
  day: string;
  hour: number;
  minute: number;
  second: number;
}

function getIstParts(date: Date): IstParts {
  const istFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    weekday: "short",
  });

  const monthFormatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    month: "short",
    weekday: "long",
  });

  const parts = istFormatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const nameParts = monthFormatter.formatToParts(date);
  const nameMap: Record<string, string> = {};
  for (const p of nameParts) {
    nameMap[p.type] = p.value;
  }

  return {
    weekday: partMap["weekday"] || "",
    weekdayName: nameMap["weekday"] || partMap["weekday"] || "",
    year: partMap["year"] || "",
    month: partMap["month"] || "",
    monthName: nameMap["month"] || partMap["month"] || "",
    day: partMap["day"] || "",
    hour: parseInt(partMap["hour"] || "0", 10),
    minute: parseInt(partMap["minute"] || "0", 10),
    second: parseInt(partMap["second"] || "0", 10),
  };
}

/**
 * Find the next upcoming trading session dynamically checking PostgreSQL MarketHoliday table
 */
function findNextUpcomingSession(
  currentDate: Date,
  currentMinutes: number
): {
  nextSessionText: string;
  isMuhurat: boolean;
  muhuratDateKey?: string;
} {
  // Lookahead up to 7 days in IST
  for (let offset = 0; offset <= 7; offset++) {
    const candidateDate = new Date(currentDate.getTime() + offset * 86400000);
    const candidateParts = getIstParts(candidateDate);
    const candidateKey = `${candidateParts.year}-${candidateParts.month}-${candidateParts.day}`;

    // 1. Dynamic lookup from MarketHoliday table
    const holiday = getCachedHoliday(candidateKey);

    if (holiday && holiday.isMuhuratTrading) {
      if (offset === 0) {
        // Today is Muhurat day
        if (currentMinutes < 1155) {
          // before 19:15 IST
          if (currentMinutes < 1095) {
            // before 18:15 IST
            return {
              nextSessionText: `Diwali Muhurat Trading opens today at 06:15 PM IST`,
              isMuhurat: true,
              muhuratDateKey: candidateKey,
            };
          }
          return {
            nextSessionText: `Muhurat Trading session in progress • Closes at 07:15 PM IST`,
            isMuhurat: true,
            muhuratDateKey: candidateKey,
          };
        }
      } else {
        // Future day has Diwali Muhurat Trading
        const dayLabel =
          offset === 1
            ? `Sunday, ${candidateParts.monthName} ${candidateParts.day}`
            : `${candidateParts.weekdayName}, ${candidateParts.monthName} ${candidateParts.day}`;
        return {
          nextSessionText: `Diwali Muhurat Trading: ${dayLabel} at 06:15 PM IST`,
          isMuhurat: true,
          muhuratDateKey: candidateKey,
        };
      }
    }

    // 2. Regular trading day check (Mon-Fri, not a weekday holiday)
    const isSat = candidateParts.weekday === "Sat";
    const isSun = candidateParts.weekday === "Sun";
    const isHoliday = !!holiday && !holiday.isWeekendHoliday && !holiday.isMuhuratTrading;

    if (!isSat && !isSun && !isHoliday) {
      if (offset === 0) {
        if (currentMinutes < 540) {
          return {
            nextSessionText: "Pre-open at 09:00 AM • Regular open at 09:15 AM IST",
            isMuhurat: false,
          };
        }
        if (currentMinutes < 555) {
          return {
            nextSessionText: "Regular trading opens at 09:15 AM IST",
            isMuhurat: false,
          };
        }
      } else {
        const dayLabel =
          offset === 1
            ? "tomorrow"
            : candidateParts.weekday === "Mon"
            ? "Monday"
            : `${candidateParts.weekdayName}`;
        return {
          nextSessionText: `Opens ${dayLabel} at 09:15 AM IST`,
          isMuhurat: false,
        };
      }
    }
  }

  return { nextSessionText: "Opens next trading day at 09:15 AM IST", isMuhurat: false };
}

/**
 * Determine complete Indian market open/closed status in real-time.
 * Dynamically queries PostgreSQL `MarketHoliday` table.
 */
export function getIndianMarketStatus(date: Date = new Date()): MarketStatusInfo {
  const parts = getIstParts(date);
  const weekday = parts.weekday;
  const hour = parts.hour;
  const minute = parts.minute;
  const second = parts.second;
  const timeMinutes = hour * 60 + minute;
  const isSaturday = weekday === "Sat";
  const isSunday = weekday === "Sun";
  const isWeekend = isSaturday || isSunday;

  const dateKey = `${parts.year}-${parts.month}-${parts.day}`;
  const timeIST = `${dateKey} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} IST`;

  // -------------------------------------------------------------------------
  // 1. DYNAMIC CHECK: MarketHoliday table lookup for today
  // -------------------------------------------------------------------------
  const todayHoliday = getCachedHoliday(dateKey);

  // 1A. Special Diwali Muhurat Trading Day
  if (todayHoliday && todayHoliday.isMuhuratTrading) {
    const preOpenStart = 18 * 60; // 18:00 IST (6:00 PM)
    const marketOpen = 18 * 60 + 15; // 18:15 IST (6:15 PM)
    const marketClose = 19 * 60 + 15; // 19:15 IST (7:15 PM)
    const postMarketEnd = 19 * 60 + 35; // 19:35 IST (7:35 PM)
    const displayHours = "06:15 PM - 07:15 PM IST";

    // Before Muhurat Pre-Market (before 18:00 IST)
    if (timeMinutes < preOpenStart) {
      return {
        isOpen: false,
        status: "CLOSED",
        subStatus: "HOLIDAY",
        message: `Market Closed (${todayHoliday.holidayName}) • Special Muhurat Trading Today`,
        closeReason: `${todayHoliday.holidayName} - Regular morning trading is closed. Special 1-hour Muhurat Trading opens this evening (${displayHours})`,
        exchange: "NSE / BSE / NFO",
        timeIST,
        tradingHours: `Diwali Muhurat Trading: ${displayHours}`,
        isWeekend,
        isHoliday: true,
        holidayName: todayHoliday.holidayName,
        nextSession: `Diwali Muhurat Trading opens today at 06:15 PM IST`,
        isMuhuratTrading: true,
      };
    }

    // Muhurat Pre-Market Session (18:00 - 18:15 IST)
    if (timeMinutes >= preOpenStart && timeMinutes < marketOpen) {
      return {
        isOpen: false,
        status: "PRE_MARKET",
        subStatus: "PRE_MARKET",
        message: `Diwali Muhurat Pre-Market Order Entry (18:00 - 18:15 IST)`,
        closeReason: `Diwali Muhurat Pre-Open session in progress`,
        exchange: "NSE / BSE / NFO",
        timeIST,
        tradingHours: `Diwali Muhurat Trading: ${displayHours}`,
        isWeekend,
        isHoliday: true,
        holidayName: todayHoliday.holidayName,
        nextSession: `Diwali Muhurat Trading starts at 06:15 PM IST`,
        isMuhuratTrading: true,
      };
    }

    // MUHURAT TRADING ACTIVE - MARKET OPEN! (18:15 - 19:15 IST)
    if (timeMinutes >= marketOpen && timeMinutes < marketClose) {
      return {
        isOpen: true,
        status: "OPEN",
        subStatus: "MUHURAT_TRADING",
        message: `Diwali Muhurat Trading Open`,
        closeReason: `Auspicious Diwali Muhurat Trading session actively in progress`,
        exchange: "NSE / BSE / NFO",
        timeIST,
        tradingHours: `Special Session: ${displayHours}`,
        isWeekend,
        isHoliday: false,
        holidayName: todayHoliday.holidayName,
        nextSession: `Muhurat session closes at 07:15 PM IST`,
        isMuhuratTrading: true,
      };
    }

    // Muhurat Post-Market Session (19:15 - 19:35 IST)
    if (timeMinutes >= marketClose && timeMinutes < postMarketEnd) {
      return {
        isOpen: false,
        status: "POST_MARKET",
        subStatus: "POST_MARKET",
        message: `Diwali Muhurat Post-Market Session`,
        closeReason: `Diwali Muhurat closing session in progress (closing price orders only)`,
        exchange: "NSE / BSE / NFO",
        timeIST,
        tradingHours: `Special Session: ${displayHours}`,
        isWeekend,
        isHoliday: false,
        nextSession: `Trading concludes at 07:35 PM IST`,
        isMuhuratTrading: true,
      };
    }

    // After Muhurat Session concludes
    const nextRegular = findNextUpcomingSession(new Date(date.getTime() + 86400000), 0);
    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "AFTER_HOURS",
      message: `Diwali Muhurat Trading Concluded`,
      closeReason: `Muhurat Trading session ended. Happy Diwali & prosperous New Samvat!`,
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: `Special Session: ${displayHours}`,
      isWeekend,
      isHoliday: true,
      holidayName: todayHoliday.holidayName,
      nextSession: nextRegular.nextSessionText,
      isMuhuratTrading: false,
    };
  }

  // 1B. Regular Exchange Holiday (non-Muhurat, and not falling solely on a weekend)
  if (todayHoliday && !todayHoliday.isWeekendHoliday) {
    const upcoming = findNextUpcomingSession(date, timeMinutes);
    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "HOLIDAY",
      message: `Market Closed (Holiday: ${todayHoliday.holidayName})`,
      closeReason: `Exchange Holiday: ${todayHoliday.holidayName}${todayHoliday.description ? ` - ${todayHoliday.description}` : ""}`,
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend,
      isHoliday: true,
      holidayName: todayHoliday.holidayName,
      nextSession: upcoming.nextSessionText,
    };
  }

  // -------------------------------------------------------------------------
  // 2. WEEKEND CHECK (Saturdays & Sundays)
  // -------------------------------------------------------------------------
  if (isWeekend) {
    const dayName = isSaturday ? "Saturday" : "Sunday";
    const upcoming = findNextUpcomingSession(date, timeMinutes);

    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "WEEKEND",
      message: upcoming.isMuhurat
        ? `Market Closed (${dayName}) • Special Diwali Muhurat Trading Ahead!`
        : `Market Closed (${dayName})`,
      closeReason: upcoming.isMuhurat
        ? `Weekend (${dayName}) - Next trading session is the auspicious Diwali Muhurat Trading!`
        : `Weekend (${dayName}) - Indian exchanges are closed on Saturdays & Sundays`,
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: true,
      isHoliday: false,
      nextSession: upcoming.nextSessionText,
    };
  }

  // -------------------------------------------------------------------------
  // 3. REGULAR WEEKDAY SCHEDULE (Mon-Fri)
  // -------------------------------------------------------------------------

  // 3A. Before Market (< 09:00 IST / 540 min)
  if (timeMinutes < 540) {
    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "BEFORE_MARKET",
      message: "Market Closed (Before Hours)",
      closeReason: "Early Morning / Pre-opening - Normal trading begins at 09:15 AM IST",
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: false,
      isHoliday: false,
      nextSession: "Pre-open at 09:00 AM • Regular open at 09:15 AM IST",
    };
  }

  // 3B. Pre-Market session (09:00 - 09:15 IST / 540 - 555 min)
  if (timeMinutes >= 540 && timeMinutes < 555) {
    return {
      isOpen: false,
      status: "PRE_MARKET",
      subStatus: "PRE_MARKET",
      message: "Pre-Market Session (Order Entry & Discovery)",
      closeReason: "Pre-Market Session in progress (09:00 - 09:15 AM IST)",
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: false,
      isHoliday: false,
      nextSession: "Regular trading opens at 09:15 AM IST",
    };
  }

  // 3C. Regular Trading Hours - OPEN! (09:15 - 15:30 IST / 555 - 930 min)
  if (timeMinutes >= 555 && timeMinutes < 930) {
    return {
      isOpen: true,
      status: "OPEN",
      subStatus: "REGULAR",
      message: "Market Open",
      closeReason: "Market is actively open for regular trading",
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: false,
      isHoliday: false,
      nextSession: "Closes today at 03:30 PM IST",
    };
  }

  // 3D. Closing Session (15:30 - 15:40 IST / 930 - 940 min)
  if (timeMinutes >= 930 && timeMinutes < 940) {
    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "CLOSING_SESSION",
      message: "Market Closed (Closing Session)",
      closeReason: "Closing Session (03:30 - 03:40 PM IST) - Order execution halted",
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: false,
      isHoliday: false,
      nextSession: "Post-market session at 03:40 PM IST",
    };
  }

  // 3E. Post-Market session (15:40 - 16:00 IST / 940 - 960 min)
  if (timeMinutes >= 940 && timeMinutes < 960) {
    return {
      isOpen: false,
      status: "POST_MARKET",
      subStatus: "POST_MARKET",
      message: "Post-Market Session",
      closeReason: "Post-Market Session (03:40 - 04:00 PM IST) - Closing price orders only",
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: false,
      isHoliday: false,
      nextSession: "Trading ends at 04:00 PM IST",
    };
  }

  // 3F. After Hours (after 16:00 IST / 960 min)
  const upcoming = findNextUpcomingSession(new Date(date.getTime() + 86400000), 0);
  return {
    isOpen: false,
    status: "CLOSED",
    subStatus: "AFTER_HOURS",
    message: "Market Closed (After Hours)",
    closeReason: "After Hours - Regular trading ended at 03:30 PM IST",
    exchange: "NSE / BSE / NFO",
    timeIST,
    tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
    isWeekend: false,
    isHoliday: false,
    nextSession: upcoming.nextSessionText,
  };
}
