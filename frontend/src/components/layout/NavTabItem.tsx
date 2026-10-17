import React from 'react';
import type { LucideIcon } from 'lucide-react';

export interface NavTabItemProps {
  id: string;
  label: string;
  icon: LucideIcon;
  isActive: boolean;
  onClick: () => void;
  badge?: React.ReactNode;
  pulseDot?: boolean;
  className?: string;
}

export const NavTabItem: React.FC<NavTabItemProps> = ({
  label,
  icon: Icon,
  isActive,
  onClick,
  badge,
  pulseDot,
  className = '',
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 focus:outline-none select-none ${
        isActive
          ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
      } ${className}`}
    >
      <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      <span>{label}</span>
      {pulseDot && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse flex-shrink-0" />}
      {badge}
    </button>
  );
};

export default NavTabItem;
