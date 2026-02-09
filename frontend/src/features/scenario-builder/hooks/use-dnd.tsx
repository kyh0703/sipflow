import { createContext, useContext, useState, type ReactNode } from 'react';

interface DnDContextValue {
  type: string | null;
  setType: (type: string | null) => void;
}

const DnDContext = createContext<DnDContextValue | undefined>(undefined);

interface DnDProviderProps {
  children: ReactNode;
}

export function DnDProvider({ children }: DnDProviderProps) {
  const [type, setType] = useState<string | null>(null);

  return (
    <DnDContext.Provider value={{ type, setType }}>
      {children}
    </DnDContext.Provider>
  );
}

export function useDnD() {
  const context = useContext(DnDContext);
  if (context === undefined) {
    throw new Error('useDnD must be used within a DnDProvider');
  }
  return context;
}
