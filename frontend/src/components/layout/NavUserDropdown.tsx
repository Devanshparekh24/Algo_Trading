import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Mail, Phone, Layers, ShieldCheck } from 'lucide-react';
import { useUserProfile, useRMSLimit } from '../../hooks/useUserProfile';
import { formatINR } from '../../utils/formatters';

export interface NavUserDropdownProps {
  className?: string;
}

export const NavUserDropdown: React.FC<NavUserDropdownProps> = ({ className = '' }) => {
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

  if (isLoading) {
    return <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />;
  }

  if (!profile) {
    return null;
  }

  const initial = profile.name ? profile.name.charAt(0).toUpperCase() : 'U';

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        type="button"
        className="flex items-center space-x-2 p-1 pr-2.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 transition-all text-xs focus:outline-none"
        aria-expanded={dropdownOpen}
      >
        <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-sm flex-shrink-0">
          {initial}
        </div>
        <div className="text-left hidden sm:block">
          <div className="font-bold text-gray-900 dark:text-white leading-none">{profile.name}</div>
          <div className="text-[10px] text-blue-500 font-mono mt-0.5">{profile.clientcode}</div>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
      </button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 top-full w-72 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 p-4 z-50 text-xs space-y-3">
          {/* Header */}
          <div className="pb-2 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <div>
              <div className="font-bold text-gray-900 dark:text-white text-sm">{profile.name}</div>
              <div className="text-blue-500 font-mono text-xs">{profile.clientcode}</div>
            </div>
            <span className="flex items-center gap-1 text-[10px] bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
              <ShieldCheck className="w-3 h-3" />
              Active
            </span>
          </div>

          {/* RMS Limits Summary */}
          {rmsData && (
            <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-700/50 space-y-1.5 border border-gray-100 dark:border-gray-700">
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

          {/* Contact & Broker Info */}
          <div className="space-y-1.5 text-gray-600 dark:text-gray-300">
            {profile.email && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Mail className="w-3 h-3" />
                  Email:
                </span>
                <span className="font-medium truncate max-w-[170px]">{profile.email}</span>
              </div>
            )}
            {profile.mobileno && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Phone className="w-3 h-3" />
                  Mobile:
                </span>
                <span className="font-medium">{profile.mobileno}</span>
              </div>
            )}
            {profile.exg && profile.exg.length > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-gray-400 flex items-center gap-1.5">
                  <Layers className="w-3 h-3" />
                  Exchanges:
                </span>
                <span className="font-medium">{profile.exg.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NavUserDropdown;
