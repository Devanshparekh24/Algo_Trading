import React, { useState, useRef, useEffect } from 'react';
import { useUserProfile, useRMSLimit } from '../../hooks/useUserProfile';

interface NavbarProps {
  activeView?: 'home' | 'positions';
  onNavigate?: (view: 'home' | 'positions') => void;
}

export const Navbar: React.FC<NavbarProps> = ({ activeView = 'positions', onNavigate }) => {
  const { data: profile, isLoading } = useUserProfile();
  const { data: rmsData } = useRMSLimit();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const formatINR = (val?: string | number) => {
    if (val === undefined || val === null || val === '') return '₹0.00';
    const num = typeof val === 'string' ? parseFloat(val) : val;
    if (isNaN(num)) return '₹0.00';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(num);
  };

  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 sm:px-6 py-3 shadow-sm sticky top-0 z-50 flex justify-between items-center gap-4">
      {/* Brand Logo & Name */}
      <div
        onClick={() => onNavigate && onNavigate('home')}
        className="flex items-center space-x-2.5 cursor-pointer group"
      >
        <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold text-sm shadow group-hover:scale-105 transition-transform">
          ⚡
        </div>
        <div>
          <h1 className="text-base font-bold text-gray-900 dark:text-white leading-tight">
            Algo Trading
          </h1>
          <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider block -mt-0.5">
            SmartAPI Console
          </span>
        </div>
      </div>

      {/* Navbar Navigation Items */}
      <nav className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl">
        <button
          onClick={() => onNavigate && onNavigate('home')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeView === 'home'
              ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Home
        </button>

        <button
          onClick={() => onNavigate && onNavigate('positions')}
          className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
            activeView === 'positions'
              ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Positions
        </button>
      </nav>

      {/* Profile & Margin Widget */}
      <div className="relative flex items-center space-x-3" ref={dropdownRef}>
        {/* Quick Margin Display */}
        {rmsData && (
          <div className="hidden md:flex flex-col text-right px-2.5 py-1 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/80 rounded-lg">
            <span className="text-[9px] uppercase tracking-wider font-semibold text-emerald-600 dark:text-emerald-400">
              Avail Margin
            </span>
            <span className="text-xs font-bold font-mono text-emerald-700 dark:text-emerald-300">
              {formatINR(rmsData.net || rmsData.availablecash)}
            </span>
          </div>
        )}

        {isLoading ? (
          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
        ) : profile ? (
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center space-x-2 p-1 pr-3 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all text-xs focus:outline-none"
          >
            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm">
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <div className="font-bold text-gray-900 dark:text-white leading-none">{profile.name}</div>
              <div className="text-[10px] text-blue-500 font-mono mt-0.5">{profile.clientcode}</div>
            </div>
          </button>
        ) : null}

        {/* Profile & RMS Dropdown */}
        {dropdownOpen && profile && (
          <div className="absolute right-0 mt-2 top-full w-72 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 z-50 text-xs space-y-3">
            <div className="pb-2 border-b border-gray-100 dark:border-gray-700">
              <div className="font-bold text-gray-900 dark:text-white text-sm">{profile.name}</div>
              <div className="text-blue-500 font-mono text-xs">{profile.clientcode}</div>
            </div>

            {/* RMS Limits Summary */}
            {rmsData && (
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-700/50 space-y-1 border border-gray-100 dark:border-gray-700">
                <div className="text-[10px] uppercase font-bold text-gray-400">RMS Margin Limits</div>
                <div className="flex justify-between font-mono">
                  <span className="text-gray-500">Net Margin:</span>
                  <span className="font-bold text-emerald-600">{formatINR(rmsData.net)}</span>
                </div>
                <div className="flex justify-between font-mono text-[11px]">
                  <span className="text-gray-500">Avail Cash:</span>
                  <span>{formatINR(rmsData.availablecash)}</span>
                </div>
              </div>
            )}

            <div className="space-y-1 text-gray-600 dark:text-gray-300">
              <div className="flex justify-between">
                <span className="text-gray-400">Email:</span>
                <span className="font-medium truncate max-w-[170px]">{profile.email || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Mobile:</span>
                <span className="font-medium">{profile.mobileno || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Exchanges:</span>
                <span className="font-medium">{profile.exg?.join(', ') || 'N/A'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Navbar;
