'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { usePricing } from '@/contexts/pricing-context';
import { domAnimation, LazyMotion } from 'motion/react';

import { IPricingPlan, IPricingTableFeatures } from '@/types/pricing';
import { cn } from '@/lib/utils';

import FeaturesColumn from './features-column';
import TableColumn from './table-column';
import TableDivider from './table-divider';

interface ComparisonTableProps {
  className?: string;
  plans: IPricingPlan[];
  featureCategories: IPricingTableFeatures[];
}

function ComparisonTable({ className, plans, featureCategories }: ComparisonTableProps) {
  const { isAnnual } = usePricing();

  const planIds = useMemo(() => {
    const idsWithFeatures = new Set<string>();
    for (const category of featureCategories) {
      for (const feature of category.features) {
        for (const plan of feature.plans) {
          idsWithFeatures.add(plan.planId);
        }
      }
    }
    if (!plans.length) return Array.from(idsWithFeatures);
    const ordered = plans
      .map((plan) => plan.id)
      .filter((id, index, arr) => arr.indexOf(id) === index && idsWithFeatures.has(id));
    if (ordered.length) return ordered;
    return Array.from(idsWithFeatures);
  }, [plans, featureCategories]);

  const [activePlanId, setActivePlanId] = useState(() => planIds?.[0] ?? '');

  useEffect(() => {
    if (!planIds.length) {
      if (activePlanId !== '') setActivePlanId('');
      return;
    }
    if (!planIds.includes(activePlanId)) {
      setActivePlanId(planIds[0]);
    }
  }, [planIds, activePlanId]);

  if (planIds.length === 0) {
    return null;
  }

  const visiblePlans = plans.filter((plan) => planIds.includes(plan.id));

  const handlePrevPlan = () => {
    const currentIndex = planIds.indexOf(activePlanId);
    const prevIndex = currentIndex <= 0 ? planIds.length - 1 : currentIndex - 1;
    setActivePlanId(planIds[prevIndex]);
  };

  const handleNextPlan = () => {
    const currentIndex = planIds.indexOf(activePlanId);
    const nextIndex = currentIndex >= planIds.length - 1 ? 0 : currentIndex + 1;
    setActivePlanId(planIds[nextIndex]);
  };

  const totalRows =
    1 + featureCategories.reduce((sum, category) => sum + 1 + category.features.length, 0);

  const plansCount = planIds.length;

  return (
    <LazyMotion features={domAnimation}>
      <section className={cn('comparison-table py-10 md:py-16 lg:py-24', className)}>
        <div
          className={cn('mx-auto w-full px-5 md:px-8', {
            'xl:max-w-4xl': plansCount < 3,
            'max-w-6xl': plansCount === 3,
            'max-w-7xl': plansCount > 3,
          })}
        >
          <h2 className="sr-only font-heading">Feature Comparison</h2>
          <div
            className={cn(
              'relative -mt-5 grid w-full grid-cols-2',
              plansCount === 1 && 'md:grid-cols-[minmax(12rem,15rem)_minmax(1.25rem,5rem)_1fr]',
              plansCount === 2 &&
                'md:grid-cols-[12rem_repeat(2,1fr)] lg:grid-cols-[minmax(12rem,15rem)_minmax(1.25rem,5rem)_repeat(2,1fr)]',
              plansCount === 3 &&
                'md:grid-cols-[12rem_repeat(3,1fr)] lg:grid-cols-[minmax(12rem,15rem)_minmax(1.25rem,5rem)_repeat(3,1fr)]',
              plansCount === 4 &&
                'md:grid-cols-[12rem_repeat(4,1fr)] lg:grid-cols-[minmax(12rem,15rem)_minmax(1.25rem,5rem)_repeat(4,1fr)]',
              plansCount >= 5 &&
                'lg:grid-cols-[minmax(12rem,15rem)_minmax(1.25rem,5rem)_repeat(5,1fr)]',
            )}
            role="table"
            aria-rowcount={totalRows}
            aria-label="Pricing comparison table"
          >
            <FeaturesColumn
              featureCategories={featureCategories}
              totalRows={totalRows}
              handlePrevPlan={handlePrevPlan}
              handleNextPlan={handleNextPlan}
              plansCount={plansCount}
            />

            <TableDivider
              className={cn('hidden', {
                'md:grid': plansCount < 2,
                'lg:grid': plansCount >= 2,
              })}
              featureCategories={featureCategories}
              totalRows={totalRows}
            />

            {planIds.map((planId) => (
              <TableColumn
                className={cn(
                  'row-start-1 grid',
                  planId !== activePlanId &&
                    plansCount > 4 &&
                    'pointer-events-none invisible col-start-2 lg:pointer-events-auto lg:visible lg:col-start-auto',
                  planId !== activePlanId &&
                    plansCount <= 4 &&
                    'pointer-events-none invisible col-start-2 md:pointer-events-auto md:visible md:col-start-auto',
                  planId === activePlanId && 'max-md:col-start-2',
                )}
                key={planId}
                planId={planId}
                totalRows={totalRows}
                isAnnual={isAnnual}
                plans={visiblePlans}
                featureCategories={featureCategories}
              />
            ))}
          </div>
        </div>
      </section>
    </LazyMotion>
  );
}

export default React.memo(ComparisonTable);
