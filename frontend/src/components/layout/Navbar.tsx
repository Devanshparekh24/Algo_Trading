import React from 'react';
import { type ActiveView, useAppStore } from '../../store';
import NavbarBrand from './NavbarBrand';
import NavbarNav from './NavbarNav';
import NavMarginWidget from './NavMarginWidget';
import NavUserDropdown from './NavUserDropdown';
import MarketStatusBadge from '../common/MarketStatusBadge';
import ThemeToggle from '../common/ThemeToggle';

export interface NavbarProps {
  activeView?: ActiveView;
  onNavigate?: (view: ActiveView) => void;
  brandTitle?: string;
  brandSubtitle?: string;
  className?: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeView: activeViewProp,
  onNavigate,
  brandTitle,
  brandSubtitle,
  className = '',
}) => {
  const storeView = useAppStore((state) => state.activeView);
  const setStoreView = useAppStore((state) => state.setActiveView);
  const activeView = activeViewProp || storeView;

  const handleNavigate = (view: ActiveView) => {
    if (onNavigate) onNavigate(view);
    setStoreView(view);
  };

  return (
    <header className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700/80 px-3 sm:px-6 py-2.5 sm:py-3 shadow-xs sticky top-0 z-40 transition-colors duration-200 ${className}`}>
      <div className="flex justify-between items-center gap-2 sm:gap-4 max-w-7xl mx-auto">
        {/* Left: Brand Logo & Title */}
        <NavbarBrand
          title={brandTitle}
          subtitle={brandSubtitle}
          onClick={() => handleNavigate('home')}
        />

        {/* Center: Desktop Navigation Tabs (Converted to BottomNav on Mobile) */}
        <div className="hidden md:block">
          <NavbarNav
            activeView={activeView}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Right: Live Status, Margin, Dark Mode Toggle & User Profile */}
        <div className="flex items-center space-x-1.5 sm:space-x-3">
          {/* Live Market Status Badge */}
          <div className="hidden sm:block">
            <MarketStatusBadge />
          </div>

          {/* Quick Available Margin display */}
          <div className="hidden lg:block">
            <NavMarginWidget />
          </div>

          {/* Dark Mode / Light Mode Toggle */}
          <ThemeToggle />

          {/* User Account / Profile popover */}
          <NavUserDropdown />
        </div>
      </div>
    </header>
  );
};

export default Navbar;
