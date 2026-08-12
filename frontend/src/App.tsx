import React, { useState } from 'react';
import Navbar from './components/layout/Navbar';
import PositionsTable from './components/portfolio/PositionsTable';
import UserProfileCard from './components/common/UserProfileCard';

function App() {
  const [activeView, setActiveView] = useState<'home' | 'positions'>('positions');

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans">
      <Navbar activeView={activeView} onNavigate={(view) => setActiveView(view)} />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {activeView === 'positions' ? (
          <PositionsTable />
        ) : (
          <div className="max-w-md mx-auto space-y-4 pt-4">
            <h2 className="text-xl font-bold text-center">Account Profile</h2>
            <UserProfileCard />
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
