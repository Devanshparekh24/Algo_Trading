import { create } from 'zustand';

export type ActiveView = 'home' | 'portfolio' | 'equity' | 'positions' | 'markets' | 'fno' | 'ai-trading';
export type AppTheme = 'dark' | 'light';

export interface ValidationModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  type?: 'warning' | 'error' | 'info';
  suggestion?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export interface AppState {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  marketBannerDismissed: boolean;
  dismissMarketBanner: () => void;
  restoreMarketBanner: () => void;
  theme: AppTheme;
  toggleTheme: () => void;
  setTheme: (theme: AppTheme) => void;
  validationModal: ValidationModalConfig | null;
  showValidationModal: (config: Omit<ValidationModalConfig, 'isOpen'>) => void;
  closeValidationModal: () => void;
}

const getInitialTheme = (): AppTheme => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem('algo_theme');
    if (stored === 'light' || stored === 'dark') {
      return stored;
    }
  } catch {}
  return 'dark';
};

export const applyThemeToDocument = (theme: AppTheme) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'dark') {
    root.classList.add('dark');
    root.style.colorScheme = 'dark';
  } else {
    root.classList.remove('dark');
    root.style.colorScheme = 'light';
  }
  try {
    localStorage.setItem('algo_theme', theme);
  } catch {}
};

// Initialize immediately upon module evaluation
const initialTheme = getInitialTheme();
applyThemeToDocument(initialTheme);

export const useAppStore = create<AppState>((set) => ({
  activeView: 'fno',
  setActiveView: (view: ActiveView) => set({ activeView: view }),
  marketBannerDismissed: false,
  dismissMarketBanner: () => set({ marketBannerDismissed: true }),
  restoreMarketBanner: () => set({ marketBannerDismissed: false }),
  theme: initialTheme,
  toggleTheme: () =>
    set((state) => {
      const nextTheme: AppTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyThemeToDocument(nextTheme);
      return { theme: nextTheme };
    }),
  setTheme: (theme: AppTheme) => {
    applyThemeToDocument(theme);
    set({ theme });
  },
  validationModal: null,
  showValidationModal: (config) =>
    set({
      validationModal: {
        ...config,
        isOpen: true,
      },
    }),
  closeValidationModal: () =>
    set({
      validationModal: null,
    }),
}));

export default useAppStore;
