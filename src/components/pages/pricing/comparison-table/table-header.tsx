import { memo } from 'react';
import Link from 'next/link';

import { IPricingPlan } from '@/types/pricing';
import { getPriceInfo } from '@/lib/pricing/utils';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

import DiscountBadge from '../discount-badge';
import PriceNumber from '../price-number';

interface TableHeaderProps {
  plan?: IPricingPlan;
  planId: string;
  isFeatured: boolean;
  isAnnual: boolean;
  plansCount: number;
}

const TableHeader = memo(function TableHeader({
  plan,
  planId,
  isFeatured,
  isAnnual,
  plansCount,
}: TableHeaderProps) {
  const { name, priceType, link } = plan || {};

  const {
    display: priceDisplay,
    value: price,
    period,
  } = plan ? getPriceInfo(plan, isAnnual) : { display: '', value: 0, period: '' };

  return (
    <div
      className={cn(
        'sticky top-(--sticky-header-height) z-30 bg-background pt-5 pb-6 lg:top-[calc(var(--sticky-header-height)+3rem)]',
        'before:absolute before:-top-4 before:left-0 before:z-10 before:h-4 before:w-full before:bg-background lg:before:-top-12 lg:before:h-12',
      )}
      role="columnheader"
    >
      {isFeatured && (
        <div
          className="absolute -inset-y-0 right-4 -left-4 hidden rounded-t-xl border border-b-0 bg-muted/50 lg:block xl:right-6"
          aria-hidden
        />
      )}
      <div className="relative z-10 flex h-full flex-col pl-4 md:pr-8 md:pl-0 xl:pr-10">
        <div className="flex items-center gap-x-2">
          <h3 className="text-xl leading-snug font-semibold tracking-tight md:text-lg md:leading-snug xl:text-xl xl:leading-snug">
            {name || planId.charAt(0).toUpperCase() + planId.slice(1)}
          </h3>
          {!!plan?.monthlyPrice && !!plan?.annualPrice && (
            <DiscountBadge
              monthlyPrice={plan.monthlyPrice}
              annualPrice={plan.annualPrice}
              showSwitchDiscount={isAnnual}
            />
          )}
        </div>
        <div className="mt-1 mb-3.5">
          {priceType === 'number' ? (
            <PriceNumber
              className="part-[left]:text-muted-foreground part-[number]:text-muted-foreground"
              value={price}
              currency={plan?.currency}
              suffix={` ${period}`}
              size="md"
              animated={false}
            />
          ) : (
            <p className="text-base leading-snug tracking-tight text-muted-foreground md:text-[0.8125rem] md:leading-snug xl:text-base xl:leading-snug">
              {priceDisplay}
            </p>
          )}
        </div>
        {plan && link && (
          <Button
            className={cn('mt-auto w-full px-3.5 text-sm lg:px-5', {
              'md:max-w-48 lg:max-w-56': plansCount < 3,
            })}
            size="sm"
            variant={isFeatured ? 'default' : 'outline'}
            asChild
          >
            <Link href={link.href}>{link.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
});

export default TableHeader;
