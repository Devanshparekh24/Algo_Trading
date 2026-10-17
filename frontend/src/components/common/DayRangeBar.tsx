import React from 'react';
import { calculateRangeProgress, formatNumber } from '../../utils/formatters';

export interface DayRangeBarProps {
  current?: number | null;
  low?: number | null;
  high?: number | null;
  showLabels?: boolean;
  formatFn?: (val?: number | null) => string;
  className?: string;
}

export const DayRangeBar: React.FC<DayRangeBarProps> = ({
  current,
  low,
  high,
  showLabels = true,
  formatFn = formatNumber,
  className = '',
}) => {
  const hasRange = low !== undefined && high !== undefined && low !== null && high !== null && high > low;

  if (!hasRange) {
    return <span className="text-gray-400 text-[11px]">—</span>;
  }

  const progress = calculateRangeProgress(current, low, high);

  return (
    <div className={`space-y-1 ${className}`}>
      {/* Progress track */}
      <div className="w-full bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Low & High text labels */}
      {showLabels && (
        <div className="flex justify-between text-[9px] text-gray-400 dark:text-gray-500 font-mono">
          <span title={`Day Low: ${formatFn(low)}`}>L: {formatFn(low)}</span>
          <span title={`Day High: ${formatFn(high)}`}>H: {formatFn(high)}</span>
        </div>
      )}
    </div>
  );
};

export default DayRangeBar;
