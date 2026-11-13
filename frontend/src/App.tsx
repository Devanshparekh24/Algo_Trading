import { Suspense, lazy } from 'react';
import Navbar from './components/layout/Navbar';
import BottomNav from './components/layout/BottomNav';
import ValidationModal from './components/common/ValidationModal';
import ErrorBoundary from './components/common/ErrorBoundary';
import { useAppStore } from './store';

// Code-split large screens for faster initial page load
const DashboardScreen = lazy(() => import('./pages/DashboardScreen'));
const MarketsScreen = lazy(() => import('./pages/MarketsScreen'));
const PortfolioScreen = lazy(() => import('./pages/PortfolioScreen'));
const FnoMoversScreen = lazy(() => import('./components/fno/FnoMoversScreen'));
const AiTradingScreen = lazy(() => import('./pages/AiTradingScreen'));

function ScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-[400px] w-full">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
        <span className="text-sm font-medium text-gray-400">Loading module...</span>
      </div>
    </div>
  );
}

function App() {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8">
        <ErrorBoundary fallbackTitle="Application Screen Error">
          <Suspense fallback={<ScreenLoader />}>
            {activeView === 'ai-trading' ? (
              <AiTradingScreen />
            ) : activeView === 'fno' ? (
              <FnoMoversScreen />
            ) : activeView === 'markets' ? (
              <MarketsScreen />
            ) : activeView === 'equity' ? (
              <PortfolioScreen initialTab="equity" />
            ) : activeView === 'portfolio' ? (
              <PortfolioScreen initialTab="equity" />
            ) : activeView === 'positions' ? (
              <PortfolioScreen initialTab="positions" />
            ) : (
              <DashboardScreen onNavigateToPortfolio={() => setActiveView('portfolio')} />
            )}
          </Suspense>
        </ErrorBoundary>
      </main>

      {/* Modern Bottom Navigation Bar for Mobile Viewports (< md) */}
      <BottomNav />

      {/* Global Action Validation Modal Popup */}
      <ValidationModal />
    </div>
  );
}

export default App;
