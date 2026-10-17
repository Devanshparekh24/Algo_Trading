import React from 'react';
import Navbar from './components/layout/Navbar';
import PositionsTable from './components/portfolio/PositionsTable';
import MarketsScreen from './pages/MarketsScreen';
import DashboardScreen from './pages/DashboardScreen';
import FnoMoversScreen from './components/fno/FnoMoversScreen';
import { useAppStore } from './store';

function App() {
  const { activeView, setActiveView } = useAppStore();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeView === 'fno' ? (
          <FnoMoversScreen />
        ) : activeView === 'markets' ? (
          <MarketsScreen />
        ) : activeView === 'positions' ? (
          <PositionsTable />
        ) : (
          <DashboardScreen onNavigateToPortfolio={() => setActiveView('positions')} />
        )}
      </main>
    </div>
  );
}

export default App;
