import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ComparisonContextType {
  selectedScanIds: string[];
  toggleScanSelection: (scanId: string) => void;
  clearSelection: () => void;
  isComparisonReady: boolean;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [selectedScanIds, setSelectedScanIds] = useState<string[]>([]);

  const toggleScanSelection = (scanId: string) => {
    setSelectedScanIds((prev) => {
      if (prev.includes(scanId)) {
        return prev.filter((id) => id !== scanId);
      }
      if (prev.length >= 4) return prev; // Limit to 4 cards for grid-view constraints
      return [...prev, scanId];
    });
  };

  const clearSelection = () => setSelectedScanIds([]);
  const isComparisonReady = selectedScanIds.length >= 2;

  return (
    <ComparisonContext.Provider
      value={{
        selectedScanIds,
        toggleScanSelection,
        clearSelection,
        isComparisonReady,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
}