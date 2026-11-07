import React, { useState } from 'react';
import { useMarketStatus } from '../../hooks/useMarket';
import { Bell, Clock } from 'lucide-react';

interface MarketStatusBadgeProps {
  compact?: boolean;
  showDetailsTooltip?: boolean;
  className?: string;
}

export const MarketStatusBadge: React.FC<MarketStatusBadgeProps> = ({
  compact = false,
  showDetailsTooltip = true,
  className = '',
}) => {
  const { data: statusInfo } = useMarketStatus();
  const [tooltipOpen, setTooltipOpen] = useState(false);

  // Fallback defaults if statusInfo is still loading
  const isOpen = statusInfo?.isOpen ?? false;
  const status = statusInfo?.status ?? 'CLOSED';

  // Specific short reason for badge text
  const reasonShort = (() => {
    if (statusInfo?.subStatus === 'MUHURAT_TRADING') return 'Diwali Muhurat';
    if (statusInfo?.isHoliday) {
      if (statusInfo.isMuhuratTrading) return 'Diwali Muhurat Today';
      return `Holiday: ${statusInfo.holidayName || ''}`;
    }
    if (statusInfo?.isWeekend) {
      if (statusInfo.nextSession?.includes('Muhurat')) return 'Muhurat Ahead';
      return 'Weekend';
    }
    if (statusInfo?.subStatus === 'BEFORE_MARKET') return 'Pre-Hours';
    if (statusInfo?.subStatus === 'AFTER_HOURS' || statusInfo?.subStatus === 'CLOSING_SESSION') return 'After Hours';
    return '';
  })();

  // Badge visual styles
  const badgeConfig = (() => {
    if (isOpen) {
      const isMuhurat = statusInfo?.subStatus === 'MUHURAT_TRADING';
      return {
        bg: isMuhurat ? 'bg-amber-100 dark:bg-amber-950/60' : 'bg-emerald-50 dark:bg-emerald-950/40',
        border: isMuhurat ? 'border-amber-400 dark:border-amber-600' : 'border-emerald-200 dark:border-emerald-800/80',
        text: isMuhurat ? 'text-amber-800 dark:text-amber-300 font-extrabold' : 'text-emerald-700 dark:text-emerald-400',
        dot: isMuhurat ? 'bg-amber-500' : 'bg-emerald-500',
        label: isMuhurat ? 'Diwali Muhurat Open' : 'Market Open',
        ping: true,
      };
    }
    if (status === 'PRE_MARKET') {
      return {
        bg: 'bg-amber-50 dark:bg-amber-950/40',
        border: 'border-amber-200 dark:border-amber-800/80',
        text: 'text-amber-700 dark:text-amber-400',
        dot: 'bg-amber-500',
        label: 'Pre-Market',
        ping: true,
      };
    }
    if (status === 'POST_MARKET') {
      return {
        bg: 'bg-indigo-50 dark:bg-indigo-950/40',
        border: 'border-indigo-200 dark:border-indigo-800/80',
        text: 'text-indigo-700 dark:text-indigo-400',
        dot: 'bg-indigo-500',
        label: 'Post-Market',
        ping: false,
      };
    }
    return {
      bg: 'bg-rose-50 dark:bg-rose-950/40',
      border: 'border-rose-200 dark:border-rose-800/80',
      text: 'text-rose-700 dark:text-rose-400',
      dot: 'bg-rose-500',
      label: 'Market Closed',
      ping: false,
    };
  })();

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={() => setTooltipOpen(true)}
      onMouseLeave={() => setTooltipOpen(false)}
      onClick={() => setTooltipOpen(!tooltipOpen)}
    >
      <div
        className={`flex items-center gap-1.5 rounded-full font-bold transition-all cursor-pointer ${
          badgeConfig.bg
        } ${badgeConfig.border} border ${badgeConfig.text} ${
          compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs shadow-sm'
        }`}
      >
        <span className="relative flex h-2 w-2">
          {badgeConfig.ping && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${badgeConfig.dot}`}
            ></span>
          )}
          <span className={`relative inline-flex rounded-full h-2 w-2 ${badgeConfig.dot}`}></span>
        </span>
        <span>{badgeConfig.label}</span>

        {!compact && reasonShort && (
          <span className="text-[10px] opacity-80 font-medium hidden sm:inline">
            · {reasonShort}
          </span>
        )}
      </div>

      {/* Hover / Click Info Tooltip */}
      {showDetailsTooltip && tooltipOpen && statusInfo && (
        <div className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 z-50 text-xs space-y-2.5 pointer-events-none animate-in fade-in zoom-in-95">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-700">
            <span className="font-bold text-gray-900 dark:text-white flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${badgeConfig.dot}`}></span>
              {badgeConfig.label}
            </span>
            <span className="text-[10px] font-mono font-semibold text-gray-400">
              {statusInfo.exchange}
            </span>
          </div>

          {/* Closure Reason Callout if Closed */}
          {!isOpen && statusInfo.closeReason && (
            <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 space-y-0.5">
              <span className="text-[9px] uppercase font-bold text-rose-600 dark:text-rose-400 block tracking-wider">
                Reason for Closure
              </span>
              <span className="text-[11px] font-semibold text-rose-800 dark:text-rose-200 leading-tight block">
                {statusInfo.closeReason}
              </span>
            </div>
          )}

          <div className="space-y-1 text-[11px] text-gray-600 dark:text-gray-300">
            <div className="flex justify-between items-center">
              <span className="text-gray-400 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Trading Hours:</span>
              </span>
              <span className="font-mono">{statusInfo.tradingHours}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Current IST:</span>
              <span className="font-mono">{statusInfo.timeIST.replace(' IST', '')}</span>
            </div>
            <div className="pt-1.5 border-t border-gray-100 dark:border-gray-700 text-[11px] text-blue-600 dark:text-blue-400 font-semibold flex items-center gap-1.5">
              <Bell className="w-3.5 h-3.5 shrink-0" />
              <span>{statusInfo.nextSession}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MarketStatusBadge;
