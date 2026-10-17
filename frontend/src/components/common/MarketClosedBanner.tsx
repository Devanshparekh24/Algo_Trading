import React from 'react';
import { useMarketStatus } from '../../hooks/useMarket';
import { AlertTriangle, Bell, X, Clock } from 'lucide-react';
import { useAppStore } from '../../store';

interface MarketClosedBannerProps {
  segmentName?: string;
  className?: string;
}

export const MarketClosedBanner: React.FC<MarketClosedBannerProps> = ({
  segmentName = 'Market',
  className = '',
}) => {
  const { data: statusInfo } = useMarketStatus();
  const { marketBannerDismissed, dismissMarketBanner } = useAppStore();

  if (!statusInfo || statusInfo.isOpen || marketBannerDismissed) {
    return null;
  }

  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-r from-rose-50 via-amber-50 to-orange-50 dark:from-rose-950/40 dark:via-amber-950/30 dark:to-orange-950/30 border border-rose-200 dark:border-rose-800/80 rounded-2xl p-4 shadow-sm transition-all ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-800 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-extrabold uppercase tracking-wider text-rose-700 dark:text-rose-400">
                {segmentName} Is Currently Closed
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-900/50 text-rose-800 dark:text-rose-300 font-bold font-mono">
                {statusInfo.timeIST.replace(' IST', '')} IST
              </span>
            </div>
            <div className="text-xs text-gray-800 dark:text-gray-200 font-medium">
              <span className="font-bold text-rose-600 dark:text-rose-400">Reason: </span>
              {statusInfo.closeReason}
            </div>
            <div className="text-[11px] text-gray-600 dark:text-gray-400 flex flex-wrap items-center gap-x-3 gap-y-1 pt-0.5">
              <span className="flex items-center gap-1">
                <Bell className="w-3 h-3 text-rose-500 inline" />
                <strong className="text-gray-800 dark:text-gray-200">{statusInfo.nextSession}</strong>
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-gray-400 inline" />
                <span>Trading Hours: {statusInfo.tradingHours}</span>
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={dismissMarketBanner}
          className="p-1.5 rounded-lg hover:bg-rose-200/50 dark:hover:bg-rose-900/40 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
          title="Dismiss notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MarketClosedBanner;
