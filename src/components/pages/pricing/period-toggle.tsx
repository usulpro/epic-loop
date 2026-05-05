'use client';

import { useMemo } from 'react';
import { usePricing } from '@/contexts/pricing-context';
import { domAnimation, LazyMotion } from 'motion/react';
import * as m from 'motion/react-m';

import { PricingPeriod } from '@/types/common';
import { type IPricingPlan } from '@/types/pricing';
import { cn } from '@/lib/utils';

import DiscountBadge from './discount-badge';

interface IPeriodToggleProps {
  className?: string;
  pricingPlans: IPricingPlan[];
  variant?: 'switch' | 'tabs';
  showDiscountInside?: boolean;
}

function PeriodToggle({
  className,
  pricingPlans,
  variant = 'switch',
  showDiscountInside = false,
}: IPeriodToggleProps) {
  const { pricingPeriod, setPricingPeriod } = usePricing();

  const discountPercentage = useMemo(() => {
    const plansWithBothPrices = pricingPlans.filter(
      (plan) => plan.monthlyPrice && plan.annualPrice,
    );

    if (plansWithBothPrices.length === 0) return 0;

    const totalDiscount = plansWithBothPrices.reduce((sum, plan) => {
      if (!plan.monthlyPrice || !plan.annualPrice) return sum;
      const discount = ((plan.monthlyPrice - plan.annualPrice) / plan.monthlyPrice) * 100;
      return sum + discount;
    }, 0);

    return Math.round(totalDiscount / plansWithBothPrices.length);
  }, [pricingPlans]);

  const showSwitchDiscount = discountPercentage > 0 && pricingPeriod === PricingPeriod.Annually;

  if (variant === 'switch') {
    return (
      <div className={cn('flex items-center justify-center', className)}>
        <div className="relative flex w-fit items-center gap-2.5">
          <button
            className={cn(
              'cursor-pointer rounded text-base leading-none font-medium tracking-tight',
              pricingPeriod === PricingPeriod.Monthly ? 'text-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setPricingPeriod(PricingPeriod.Monthly)}
          >
            {PricingPeriod.Monthly}
          </button>

          <button
            className="relative inline-flex h-7 min-w-13 shrink-0 cursor-pointer items-center rounded-full border border-border px-1 transition-colors"
            type="button"
            role="switch"
            aria-checked={pricingPeriod === PricingPeriod.Annually}
            aria-label={`Toggle to ${
              pricingPeriod === PricingPeriod.Annually ? 'monthly' : 'annual'
            } period`}
            onClick={() =>
              setPricingPeriod(
                pricingPeriod === PricingPeriod.Monthly
                  ? PricingPeriod.Annually
                  : PricingPeriod.Monthly,
              )
            }
          >
            <span
              className={cn(
                'pointer-events-none block size-5 rounded-full bg-foreground shadow-lg ring-0 transition-transform',
                pricingPeriod === PricingPeriod.Annually ? 'translate-x-6' : 'translate-x-0',
              )}
              aria-hidden="true"
            />
          </button>

          <button
            className={cn(
              'cursor-pointer rounded text-base leading-none font-medium tracking-tight',
              pricingPeriod === PricingPeriod.Annually
                ? 'text-foreground'
                : 'text-muted-foreground',
            )}
            type="button"
            onClick={() => setPricingPeriod(PricingPeriod.Annually)}
          >
            {PricingPeriod.Annually}
          </button>

          <DiscountBadge
            className="absolute left-full ml-2"
            discountPercentage={discountPercentage}
            showSwitchDiscount={showSwitchDiscount}
          />
        </div>
      </div>
    );
  }

  const showExternalTabsDiscount =
    !showDiscountInside && discountPercentage > 0 && pricingPeriod === PricingPeriod.Annually;

  return (
    <div className={cn('flex items-center justify-center', className)}>
      <div className="relative flex items-center gap-1 rounded-md border border-border bg-primary-foreground p-1">
        <LazyMotion features={domAnimation}>
          {Object.values(PricingPeriod).map((period) => {
            const isSelected = pricingPeriod === period;
            const isAnnual = period === PricingPeriod.Annually;
            const showInternalDiscount = showDiscountInside && discountPercentage > 0 && isAnnual;

            return (
              <button
                className={cn(
                  'relative flex h-7 cursor-pointer items-center justify-center gap-x-1.5 px-2 text-sm leading-none font-medium tracking-tight transition-colors delay-100 duration-200',
                  isSelected ? 'text-primary-foreground' : 'text-muted-foreground',
                  showDiscountInside && isAnnual && 'pr-1',
                  showDiscountInside ? 'rounded' : 'rounded-md',
                )}
                key={period}
                onClick={() => setPricingPeriod(period)}
              >
                <span className="relative z-10">{period}</span>
                {showInternalDiscount && (
                  <DiscountBadge
                    className="relative z-10 bg-secondary"
                    discountPercentage={discountPercentage}
                  />
                )}
                {isSelected ? (
                  <m.div
                    className={cn(
                      'absolute inset-0 z-0 bg-secondary-foreground',
                      showDiscountInside ? 'rounded-md' : 'rounded',
                    )}
                    aria-hidden="true"
                    layoutId="period-toggle"
                  />
                ) : null}
              </button>
            );
          })}
        </LazyMotion>
        {showExternalTabsDiscount && (
          <DiscountBadge
            className="absolute left-full translate-x-2.5"
            discountPercentage={discountPercentage}
          />
        )}
      </div>
    </div>
  );
}

export default PeriodToggle;
