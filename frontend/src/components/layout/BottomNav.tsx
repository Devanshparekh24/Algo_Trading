import React from 'react';
import { Home, LineChart, Flame, Bot, PieChart } from 'lucide-react';
import { useAppStore, type ActiveView } from '../../store';

export interface BottomNavProps {
  className?: string;
}

export const BottomNav: React.FC<BottomNavProps> = ({ className = '' }) => {
  const activeView = useAppStore((state) => state.activeView);
  const setActiveView = useAppStore((state) => state.setActiveView);

  const navItems = [
    {
      id: 'home' as ActiveView,
      label: 'Home',
      icon: Home,
      isActive: activeView === 'home',
    },
    {
      id: 'markets' as ActiveView,
      label: 'Markets',
      icon: LineChart,
      isActive: activeView === 'markets',
    },
    {
      id: 'ai-trading' as ActiveView,
      label: 'AI Sniper',
      icon: Bot,
      isActive: activeView === 'ai-trading',
      highlight: true,
      pulse: true,
    },
    {
      id: 'fno' as ActiveView,
      label: 'F&O Movers',
      icon: Flame,
      isActive: activeView === 'fno',
      pulse: true,
    },
    {
      id: 'portfolio' as ActiveView,
      label: 'Portfolio',
      icon: PieChart,
      isActive: activeView === 'portfolio' || activeView === 'equity' || activeView === 'positions',
    },
  ];

  return (
    <nav
      aria-label="Mobile Bottom Navigation"
      className={`fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-t border-gray-200/90 dark:border-gray-800/90 shadow-[0_-4px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_-4px_24px_rgba(0,0,0,0.35)] transition-colors duration-200 ${className}`}
      style={{ paddingBottom: 'max(0.35rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center justify-around px-1.5 pt-1.5 pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.isActive;

          if (item.highlight) {
            // Elevated / Highlighted Center AI Sniper Action
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveView(item.id)}
                className="relative flex flex-col items-center justify-center -mt-3 group focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded-2xl select-none"
              >
                <div
                  className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-all duration-300 shadow-md ${
                    isActive
                      ? 'bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 text-white shadow-blue-500/40 scale-105 ring-2 ring-blue-400/50'
                      : 'bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 text-blue-600 dark:text-blue-400 hover:scale-105 border border-blue-500/30'
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform duration-200 group-active:scale-95" />
                  {item.pulse && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white dark:border-gray-900"></span>
                    </span>
                  )}
                </div>
                <span
                  className={`text-[10px] mt-1 font-bold tracking-tight transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                  }`}
                >
                  {item.label}
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              className="relative flex-1 py-1 flex flex-col items-center justify-center group focus:outline-none select-none rounded-xl"
            >
              <div className="relative">
                <div
                  className={`p-1 rounded-xl transition-all duration-200 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                      : 'text-gray-500 dark:text-gray-400 group-hover:text-gray-900 dark:group-hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5 transition-transform duration-200 group-active:scale-90" />
                </div>
                {item.pulse && (
                  <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500 animate-pulse border border-white dark:border-gray-900" />
                )}
              </div>
              <span
                className={`text-[10px] mt-0.5 tracking-tight transition-colors ${
                  isActive
                    ? 'font-bold text-blue-600 dark:text-blue-400'
                    : 'font-medium text-gray-500 dark:text-gray-400 group-hover:text-gray-700 dark:group-hover:text-gray-300'
                }`}
              >
                {item.label}
              </span>
              {isActive && (
                <span className="w-4 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-full mt-0.5 animate-in fade-in zoom-in-50 duration-200" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;

