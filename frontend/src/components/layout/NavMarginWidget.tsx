import React from 'react';
import { Wallet } from 'lucide-react';
import { useRMSLimit } from '../../hooks/useUserProfile';
import { formatINR } from '../../utils/formatters';

export interface NavMarginWidgetProps {
  className?: string;
}

export const NavMarginWidget: React.FC<NavMarginWidgetProps> = ({ className = '' }) => {
  const { data: rmsData, isLoading } = useRMSLimit();

  if (isLoading || !rmsData) {
    return null;
  }

  const marginValue = rmsData.net || rmsData.availablecash || 0;

  return (
    <div
      className={`flex items-center gap-2 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/80 rounded-lg text-right ${className}`}
      title="Live Available RMS Margin"
    >
      <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
      <div className="flex flex-col">
        <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
          Avail Margin
        </span>
        <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300">
          {formatINR(marginValue)}
        </span>
      </div>
    </div>
  );
};

export default NavMarginWidget;
