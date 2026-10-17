import React from 'react';
import { ArrowUpRight, ArrowDownRight, Minus } from 'lucide-react';
import { formatPercent } from '../../utils/formatters';

export interface ChangePillProps {
  value: number;
  absoluteValue?: number;
  size?: 'xs' | 'sm' | 'md';
  showIcon?: boolean;
  className?: string;
}

export const ChangePill: React.FC<ChangePillProps> = ({
  value,
  absoluteValue,
  size = 'sm',
  showIcon = true,
  className = '',
}) => {
  const isUp = value > 0;
  const isZero = value === 0;

  const sizeClasses = {
    xs: 'text-[10px] px-1.5 py-0.5 gap-0.5',
    sm: 'text-xs px-2.5 py-1 gap-1',
    md: 'text-sm px-3 py-1.5 gap-1.5',
  }[size];

  const iconSizes = {
    xs: 'w-2.5 h-2.5',
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
  }[size];

  const colorClasses = isZero
    ? 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700'
    : isUp
    ? 'bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
    : 'bg-rose-100 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60';

  return (
    <span
      className={`inline-flex items-center font-extrabold font-mono rounded-lg border shadow-xs transition-colors ${sizeClasses} ${colorClasses} ${className}`}
    >
      {showIcon && (
        isZero ? (
          <Minus className={iconSizes} />
        ) : isUp ? (
          <ArrowUpRight className={iconSizes} />
        ) : (
          <ArrowDownRight className={iconSizes} />
        )
      )}
      <span>{formatPercent(value, true)}</span>
      {absoluteValue !== undefined && (
        <span className="opacity-80 text-[10px] font-medium ml-1">
          ({isUp ? '+' : ''}{absoluteValue.toFixed(2)})
        </span>
      )}
    </span>
  );
};

export default ChangePill;
