'use client';

import { createContext, ReactNode, useContext, useState } from 'react';

import { PricingPeriod } from '@/types/common';

interface PricingContextType {
  pricingPeriod: PricingPeriod;
  setPricingPeriod: (period: PricingPeriod) => void;
  isAnnual: boolean;
}

const PricingContext = createContext<PricingContextType | undefined>(undefined);

export function PricingProvider({ children }: { children: ReactNode }) {
  const [pricingPeriod, setPricingPeriod] = useState<PricingPeriod>(PricingPeriod.Monthly);

  return (
    <PricingContext.Provider
      value={{
        pricingPeriod,
        setPricingPeriod,
        isAnnual: pricingPeriod === PricingPeriod.Annually,
      }}
    >
      {children}
    </PricingContext.Provider>
  );
}

export function usePricing() {
  const context = useContext(PricingContext);

  if (context === undefined) {
    throw new Error('usePricing must be used within a PricingProvider');
  }

  return context;
}
