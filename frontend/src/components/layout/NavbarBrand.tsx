import React from 'react';
import { Zap } from 'lucide-react';

export interface NavbarBrandProps {
  title?: string;
  subtitle?: string;
  onClick?: () => void;
  className?: string;
}

export const NavbarBrand: React.FC<NavbarBrandProps> = ({
  title = 'Algo Trading',
  subtitle = 'SmartAPI Console',
  onClick,
  className = '',
}) => {
  return (
    <div
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          onClick?.();
        }
      }}
      className={`flex items-center space-x-2 sm:space-x-2.5 cursor-pointer group select-none focus:outline-none ${className}`}
    >
      <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform flex-shrink-0">
        <Zap className="w-3.5 h-3.5 sm:w-4 sm:h-4 fill-current" />
      </div>
      <div className="flex flex-col min-w-0">
        <h1 className="text-sm sm:text-base font-bold text-gray-900 dark:text-white leading-tight truncate">
          {title}
        </h1>
        <span className="text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider -mt-0.5 hidden xs:block">
          {subtitle}
        </span>
      </div>
    </div>
  );
};

export default NavbarBrand;
