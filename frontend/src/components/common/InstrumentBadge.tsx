import React from 'react';

export interface InstrumentBadgeProps {
  type: 'CE' | 'PE' | 'FUT' | 'INDEX' | string;
  size?: 'sm' | 'md';
  className?: string;
}

export const InstrumentBadge: React.FC<InstrumentBadgeProps> = ({
  type,
  size = 'sm',
  className = '',
}) => {
  const normalizedType = type.toUpperCase();

  const sizeClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  const typeStyles: Record<string, string> = {
    CE: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700/60',
    PE: 'bg-rose-100 text-rose-800 dark:bg-rose-900/40 dark:text-rose-300 border-rose-300 dark:border-rose-700/60',
    FUT: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300 dark:border-blue-700/60',
    INDEX: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700/60',
  };

  const currentStyle =
    typeStyles[normalizedType] ||
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-gray-300 dark:border-gray-700';

  return (
    <span
      className={`inline-block font-extrabold rounded-md border tracking-wide uppercase ${sizeClasses} ${currentStyle} ${className}`}
    >
      {type}
    </span>
  );
};

export default InstrumentBadge;
