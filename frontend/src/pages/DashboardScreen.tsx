import React from 'react';
import UserProfileCard from '../components/common/UserProfileCard';

interface DashboardScreenProps {
  onNavigateToPortfolio: () => void;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({ onNavigateToPortfolio }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-8 font-sans">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <span className="px-3 py-1 bg-white/20 backdrop-blur-md rounded-full text-xs font-semibold uppercase tracking-wider text-white">
            Algorithmic Trading Workspace
          </span>
          <h2 className="text-2xl sm:text-3xl font-extrabold mt-3">
            Welcome to Angel One SmartAPI Trading Console
          </h2>
          <p className="mt-2 text-sm text-blue-100 max-w-xl">
            Monitor real-time market positions, manage live strategy orders, and track your equity portfolio seamlessly.
          </p>
        </div>

        <button
          onClick={onNavigateToPortfolio}
          className="px-6 py-3 bg-white text-blue-600 hover:bg-blue-50 font-bold text-sm rounded-2xl shadow-lg transition-all transform hover:-translate-y-0.5 flex items-center space-x-2 flex-shrink-0"
        >
          <span>View Portfolio Positions</span>
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>

      {/* Grid: Quick Actions & Profile Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
        {/* User Profile Overview */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>👤 Connected User Account</span>
          </h3>
          <UserProfileCard />
        </div>

        {/* Quick Links Card */}
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <span>⚡ Direct Navigation & Features</span>
          </h3>

          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700/80 rounded-2xl p-6 shadow-sm space-y-4">
            <div
              onClick={onNavigateToPortfolio}
              className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-blue-50 dark:hover:bg-blue-900/30 border border-gray-200 dark:border-gray-700 transition-all cursor-pointer group"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">💼</span>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400">
                      Portfolio Positions & Holdings
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Endpoint: <code className="font-mono text-[11px]">/api/v1/portfolio/positions</code>
                    </p>
                  </div>
                </div>
                <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <span className="text-2xl">📈</span>
                  <div>
                    <h4 className="font-bold text-sm text-gray-900 dark:text-white">
                      Market Watch & Quotes
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Fullmode & LTP live market stream
                    </p>
                  </div>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 font-semibold rounded">
                  Coming Soon
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardScreen;
