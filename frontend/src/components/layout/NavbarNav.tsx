import React from 'react';
import { Home, PieChart, Layers, Briefcase, LineChart, Flame } from 'lucide-react';
import { useAppStore, type ActiveView } from '../../store';
import NavTabItem from './NavTabItem';

export interface NavbarNavProps {
  activeView?: ActiveView;
  onNavigate?: (view: ActiveView) => void;
  className?: string;
  isVertical?: boolean;
}

export const NavbarNav: React.FC<NavbarNavProps> = ({
  activeView: activeViewProp,
  onNavigate,
  className = '',
  isVertical = false,
}) => {
  const storeView = useAppStore((state) => state.activeView);
  const setStoreView = useAppStore((state) => state.setActiveView);
  const activeView = activeViewProp || storeView;

  const handleNavigate = (view: ActiveView) => {
    if (onNavigate) onNavigate(view);
    setStoreView(view);
  };

  const navItems = [
    { id: 'home' as ActiveView, label: 'Home', icon: Home },
    { id: 'portfolio' as ActiveView, label: 'Portfolio', icon: PieChart },
    { id: 'equity' as ActiveView, label: 'Equity', icon: Layers },
    { id: 'positions' as ActiveView, label: 'Positions', icon: Briefcase },
    { id: 'markets' as ActiveView, label: 'Markets', icon: LineChart },
    { id: 'fno' as ActiveView, label: 'F&O Movers', icon: Flame, pulseDot: true },
  ];

  return (
    <nav
      className={`${
        isVertical
          ? 'flex flex-col space-y-1 w-full'
          : 'flex items-center space-x-1 bg-gray-100 dark:bg-gray-700/60 p-1 rounded-xl'
      } ${className}`}
    >
      {navItems.map((item) => (
        <NavTabItem
          key={item.id}
          id={item.id}
          label={item.label}
          icon={item.icon}
          isActive={activeView === item.id}
          onClick={() => handleNavigate(item.id)}
          pulseDot={item.pulseDot}
          className={isVertical ? 'w-full justify-start py-2.5 px-3 rounded-xl' : ''}
        />
      ))}
    </nav>
  );
};

export default NavbarNav;
