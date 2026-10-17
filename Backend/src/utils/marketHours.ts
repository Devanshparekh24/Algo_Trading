/**
 * Indian Stock Market (NSE / BSE / NFO) Hours & Status Helper.
 * Operates in Indian Standard Time (IST, UTC+5:30).
 */

export interface MarketStatusInfo {
  isOpen: boolean;
  status: "OPEN" | "CLOSED" | "PRE_MARKET" | "POST_MARKET";
  subStatus: "REGULAR" | "PRE_MARKET" | "POST_MARKET" | "CLOSING_SESSION" | "WEEKEND" | "HOLIDAY" | "BEFORE_MARKET" | "AFTER_HOURS";
  message: string;
  closeReason: string;
  exchange: string;
  timeIST: string;
  tradingHours: string;
  isWeekend: boolean;
  isHoliday: boolean;
  holidayName?: string;
  nextSession: string;
}

// Major NSE/BSE Trading Holidays (YYYY-MM-DD)
const NSE_HOLIDAYS_MAP: Record<string, string> = {
  "2026-01-26": "Republic Day",
  "2026-02-17": "Mahashivratri",
  "2026-03-03": "Holi",
  "2026-03-20": "Id-Ul-Fitr (Ramzan Id)",
  "2026-03-27": "Ram Navami",
  "2026-03-31": "Mahavir Jayanti",
  "2026-04-03": "Good Friday",
  "2026-04-14": "Dr. Baba Saheb Ambedkar Jayanti",
  "2026-05-01": "Maharashtra Day",
  "2026-05-27": "Bakri Id / Eid-ul-Adha",
  "2026-06-25": "Muharram",
  "2026-08-15": "Independence Day",
  "2026-09-04": "Milad-un-Nabi",
  "2026-10-02": "Mahatma Gandhi Jayanti",
  "2026-10-20": "Dussehra",
  "2026-11-08": "Diwali Laxmi Pujan",
  "2026-11-10": "Diwali Balipratipada",
  "2026-11-24": "Gurunanak Jayanti",
  "2026-12-25": "Christmas",
};

export function getIndianMarketStatus(date: Date = new Date()): MarketStatusInfo {
  // Convert current time to IST string and extract components
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

  const parts = istFormatter.formatToParts(date);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const weekday = partMap["weekday"] || ""; // 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'
  const hour = parseInt(partMap["hour"] || "0", 10);
  const minute = parseInt(partMap["minute"] || "0", 10);
  const second = parseInt(partMap["second"] || "0", 10);
  const day = partMap["day"] || "";
  const month = partMap["month"] || "";
  const year = partMap["year"] || "";

  const timeMinutes = hour * 60 + minute;
  const isSaturday = weekday === "Sat";
  const isSunday = weekday === "Sun";
  const isWeekend = isSaturday || isSunday;

  const dateKey = `${year}-${month}-${day}`;
  const timeIST = `${dateKey} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:${String(second).padStart(2, "0")} IST`;

  // Check Public/Exchange Holiday first
  const holidayName = NSE_HOLIDAYS_MAP[dateKey];
  if (holidayName) {
    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "HOLIDAY",
      message: `Market Closed (Holiday: ${holidayName})`,
      closeReason: `Exchange Holiday: ${holidayName}`,
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend,
      isHoliday: true,
      holidayName,
      nextSession: "Opens next trading day at 09:15 AM IST",
    };
  }

  // Weekend
  if (isWeekend) {
    const dayName = isSaturday ? "Saturday" : "Sunday";
    return {
      isOpen: false,
      status: "CLOSED",
      subStatus: "WEEKEND",
      message: `Market Closed (${dayName})`,
      closeReason: `Weekend (${dayName}) - Indian exchanges are closed on Saturdays & Sundays`,
      exchange: "NSE / BSE / NFO",
      timeIST,
      tradingHours: "09:15 AM - 03:30 PM IST (Mon-Fri)",
      isWeekend: true,
      isHoliday: false,
      nextSession: "Opens Monday at 09:15 AM IST",
    };
  }

  // Weekday schedule:
  // < 09:00 (540 min): Before Market
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

  // 09:00 to 09:15 (540 - 555 min): Pre-Market session
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

  // 09:15 to 15:30 (555 - 930 min): Regular Trading Hours - OPEN
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

  // 15:30 to 15:40 (930 - 940 min): Closing Session
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

  // 15:40 to 16:00 (940 - 960 min): Post-Market session
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

  // After 16:00 (960 min): After Hours
  const isFriday = weekday === "Fri";
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
    nextSession: isFriday
      ? "Opens Monday at 09:15 AM IST"
      : "Opens tomorrow at 09:15 AM IST",
  };
}
