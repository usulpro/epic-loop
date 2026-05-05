import type { ReactNode } from 'react';
import { PricingProvider } from '@/contexts/pricing-context';

interface PricingLayoutProps {
  children: ReactNode;
}

export default function PricingLayout({ children }: PricingLayoutProps) {
  return <PricingProvider>{children}</PricingProvider>;
}
