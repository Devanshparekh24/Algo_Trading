import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { type ActiveView, useAppStore } from '../../store';
import NavbarBrand from './NavbarBrand';
import NavbarNav from './NavbarNav';
import NavMarginWidget from './NavMarginWidget';
import NavUserDropdown from './NavUserDropdown';
import MarketStatusBadge from '../common/MarketStatusBadge';

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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleNavigate = (view: ActiveView) => {
    if (onNavigate) onNavigate(view);
    setStoreView(view);
    setMobileMenuOpen(false);
  };

  return (
    <header className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 shadow-xs sticky top-0 z-50 transition-colors ${className}`}>
      <div className="flex justify-between items-center gap-4">
        {/* Left: Brand Logo & Title */}
        <NavbarBrand
          title={brandTitle}
          subtitle={brandSubtitle}
          onClick={() => handleNavigate('home')}
        />

        {/* Center: Desktop Navigation Tabs */}
        <div className="hidden md:block">
          <NavbarNav
            activeView={activeView}
            onNavigate={handleNavigate}
          />
        </div>

        {/* Right: Market Status, Margin & User Profile */}
        <div className="flex items-center space-x-3">
          {/* Live Market Status Badge (Open / Closed tooltip) */}
          <MarketStatusBadge />

          {/* Quick Available Margin display */}
          <NavMarginWidget />

          {/* User Account / Profile popover */}
          <NavUserDropdown />

          {/* Mobile Menu Hamburger Toggle */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-xl text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700/60 focus:outline-none transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
          <NavbarNav
            activeView={activeView}
            onNavigate={handleNavigate}
            isVertical={true}
          />
        </div>
      )}
    </header>
  );
};

export default Navbar;
