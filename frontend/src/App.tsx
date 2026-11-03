import Navbar from './components/layout/Navbar';
import PortfolioScreen from './pages/PortfolioScreen';
import MarketsScreen from './pages/MarketsScreen';
import DashboardScreen from './pages/DashboardScreen';
import FnoMoversScreen from './components/fno/FnoMoversScreen';
import AiTradingScreen from './pages/AiTradingScreen';
import { useAppStore } from './store';

function App() {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
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
    </div>
  );
}

export default App;
