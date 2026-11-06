import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useAppStore } from '../../store';

export interface ThemeToggleProps {
  className?: string;
  compact?: boolean;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = '', compact = false }) => {
  const { theme, toggleTheme } = useAppStore();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={`relative inline-flex items-center justify-center rounded-xl p-2 transition-all duration-200 focus:outline-none select-none ${
        isDark
          ? 'bg-gray-800/80 hover:bg-gray-700/80 text-amber-400 border border-gray-700/80 shadow-inner'
          : 'bg-gray-100 hover:bg-gray-200 text-indigo-600 border border-gray-200 shadow-xs'
      } ${className}`}
      title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      aria-label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100 text-amber-400" />
        ) : (
          <Moon className="w-4 h-4 transition-transform duration-300 rotate-0 scale-100 text-indigo-600" />
        )}
      </div>

      {!compact && (
        <span className="sr-only">
          {isDark ? 'Dark Mode Active (Click to switch)' : 'Light Mode Active (Click to switch)'}
        </span>
      )}
    </button>
  );
};

export default ThemeToggle;

