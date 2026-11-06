import Navbar from './components/layout/Navbar';
import BottomNav from './components/layout/BottomNav';
import PortfolioScreen from './pages/PortfolioScreen';
import MarketsScreen from './pages/MarketsScreen';
import DashboardScreen from './pages/DashboardScreen';
import FnoMoversScreen from './components/fno/FnoMoversScreen';
import AiTradingScreen from './pages/AiTradingScreen';
import ValidationModal from './components/common/ValidationModal';
import { useAppStore } from './store';

function App() {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans transition-colors duration-200 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-6 py-4 sm:py-6 pb-24 md:pb-8">
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
      </main>

      {/* Modern Bottom Navigation Bar for Mobile Viewports (< md) */}
      <BottomNav />

      {/* Global Action Validation Modal Popup */}
      <ValidationModal />
    </div>
  );
}

export default App;
