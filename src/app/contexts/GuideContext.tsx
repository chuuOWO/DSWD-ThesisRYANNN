import React, { createContext, useContext, useEffect, useState } from 'react';

const GUIDE_DESCRIPTIONS_STORAGE_KEY = 'dswd_show_guide_descriptions';

interface GuideContextType {
  showDescriptions: boolean;
  toggleDescriptions: () => void;
  setShowDescriptions: (value: boolean) => void;
}

const GuideContext = createContext<GuideContextType>({
  showDescriptions: false,
  toggleDescriptions: () => {},
  setShowDescriptions: () => {}
});

export function GuideProvider({ children }: { children: React.ReactNode }) {
  const [showDescriptions, setShowDescriptionsState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const stored = localStorage.getItem(GUIDE_DESCRIPTIONS_STORAGE_KEY);
      return stored === 'true';
    } catch {
      return false;
    }
  });

  const setShowDescriptions = (value: boolean) => {
    setShowDescriptionsState(value);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(GUIDE_DESCRIPTIONS_STORAGE_KEY, String(value));
      } catch {}
    }
  };

  const toggleDescriptions = () => {
    setShowDescriptions(!showDescriptions);
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === GUIDE_DESCRIPTIONS_STORAGE_KEY) {
        setShowDescriptionsState(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <GuideContext.Provider value={{ showDescriptions, toggleDescriptions, setShowDescriptions }}>
      {children}
    </GuideContext.Provider>
  );
}

export function useGuideMode() {
  return useContext(GuideContext);
}
