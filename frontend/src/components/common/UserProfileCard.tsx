import React from 'react';
import { useUserProfile } from '../../hooks/useUserProfile';

export const UserProfileCard: React.FC = () => {
  const { data: profile, isLoading, isError, error, refetch, isFetching } = useUserProfile();

  if (isLoading) {
    return (
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-100 dark:border-gray-700 animate-pulse">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 bg-gray-300 dark:bg-gray-700 rounded w-3/4"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-1/2"></div>
          </div>
        </div>
        <div className="mt-6 space-y-3">
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-md w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-6 shadow-lg">
        <div className="flex items-center space-x-3 text-red-600 dark:text-red-400">
          <svg className="w-6 h-6 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="font-semibold text-lg">Failed to load profile</h3>
        </div>
        <p className="mt-2 text-sm text-red-700 dark:text-red-300">
          {error?.message || 'Unable to connect to SmartAPI backend server.'}
        </p>
        <button
          onClick={() => refetch()}
          className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors duration-150 shadow-md flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 overflow-hidden transition-all hover:shadow-2xl">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 h-24 p-4 flex justify-end items-start">
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          title="Refresh Profile"
          className="text-white/80 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          <svg className={`w-5 h-5 ${isFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="px-6 pb-6 pt-0 relative">
        {/* Avatar */}
        <div className="-mt-12 mb-4 flex justify-between items-end">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-indigo-500 to-purple-600 border-4 border-white dark:border-gray-800 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
            {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
          </div>
          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs font-semibold rounded-full border border-green-200 dark:border-green-800 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            Connected
          </span>
        </div>

        {/* User Info Header */}
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{profile.name}</h2>
          <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Client Code: {profile.clientcode}</p>
        </div>

        {/* Details List */}
        <div className="mt-5 space-y-3 border-t border-gray-100 dark:border-gray-700/60 pt-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            <span className="truncate">{profile.email || 'N/A'}</span>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-300">
            <svg className="w-4 h-4 mr-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1.001 1.001 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
            <span>{profile.mobileno || 'N/A'}</span>
          </div>

          <div className="flex items-start text-sm text-gray-600 dark:text-gray-300">
            <svg className="w-4 h-4 mr-3 mt-0.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <div>
              <span className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Exchanges Allowed</span>
              <div className="flex flex-wrap gap-1.5">
                {profile.exg && profile.exg.length > 0 ? (
                  profile.exg.map((ex) => (
                    <span key={ex} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs font-medium rounded border border-blue-200 dark:border-blue-800">
                      {ex}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-gray-400">None</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer info */}
        {profile.lastaccesstime && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700/60 text-xs text-gray-400 flex justify-between items-center">
            <span>Last session access:</span>
            <span className="font-mono text-gray-500 dark:text-gray-400">{profile.lastaccesstime}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileCard;
