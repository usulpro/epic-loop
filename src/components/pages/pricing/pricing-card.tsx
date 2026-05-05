'use client';

import { usePricing } from '@/contexts/pricing-context';
import { Slot } from '@radix-ui/react-slot';
import { Info } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getPriceInfo } from '@/lib/pricing/utils';
import { cn } from '@/lib/utils';
import { IPricingPlan } from '@/types/pricing';
import DiscountBadge from './discount-badge';
import PriceNumber from './price-number';

const DEFAULT_VISIBLE_FEATURES = 7;

interface IPricingCardProps {
  className?: string;
  as?: 'div' | 'li';
  plan: IPricingPlan;
  showDescriptionAfterButton?: boolean;
  showPeriodInRow?: boolean;
}

function PricingCard({
  plan,
  className,
  as = 'div',
  showDescriptionAfterButton = false,
  showPeriodInRow = true,
}: IPricingCardProps) {
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const { isAnnual } = usePricing();
  const {
    name,
    description,
    lucideIcon,
    features,
    priceType,
    isMostPopular,
    labelBeforePrice,
    link,
    currency,
  } = plan;

  const { display: priceDisplay, value: price, period } = getPriceInfo(plan, isAnnual);

  const hasMoreFeatures = features.items.length > DEFAULT_VISIBLE_FEATURES;
  const visibleFeatures = showAllFeatures
    ? features.items
    : features.items.slice(0, DEFAULT_VISIBLE_FEATURES);

  const Component = as;

  return (
    <Component
      className={cn(
        'pricing-card row-span-5 grid grid-rows-subgrid gap-y-0 rounded-lg border border-border px-5 pt-5 pb-7',
        className,
      )}
    >
      <div className="row-start-1 grid grid-cols-2 gap-y-4">
        {lucideIcon && (
          <span
            className="flex size-12 items-center justify-center rounded-full bg-card"
            aria-hidden
          >
            <Slot className="size-5">{lucideIcon}</Slot>
          </span>
        )}
        <div
          className={cn(
            'flex items-center gap-x-2 self-start',
            lucideIcon && 'col-span-full row-start-2',
          )}
        >
          <h3 className="text-lg leading-snug font-semibold tracking-tight text-foreground">
            {name}
          </h3>
          {!!plan?.monthlyPrice && !!plan?.annualPrice && (
            <DiscountBadge
              monthlyPrice={plan.monthlyPrice}
              annualPrice={plan.annualPrice}
              showSwitchDiscount={isAnnual}
            />
          )}
        </div>
        {isMostPopular && (
          <Badge className="ml-auto h-6 self-center" variant="filled" size="md">
            Popular
          </Badge>
        )}
      </div>

      <p
        className={cn(
          'text-base leading-snug tracking-tight text-muted-foreground',
          showDescriptionAfterButton ? 'row-start-4 mt-4' : 'row-start-2 mt-3',
        )}
      >
        {description}
      </p>

      <div className={cn(showDescriptionAfterButton ? 'row-start-2 mt-5' : 'row-start-3 mt-4')}>
        <div className={cn('flex gap-x-1', showPeriodInRow ? 'flex-row items-end' : 'flex-col')}>
          <span className="flex flex-col gap-y-1">
            {labelBeforePrice && (
              <span className="text-sm leading-tight font-medium tracking-tight text-muted-foreground">
                {labelBeforePrice}
              </span>
            )}
            {priceType === 'number' && (
              <PriceNumber
                className="font-medium"
                value={price}
                currency={currency}
                suffix={` ${period}`}
                size="lg"
              />
            )}
            {priceType === 'string' && (
              <span className="text-4xl leading-tight font-medium tracking-tight text-foreground">
                {priceDisplay}
              </span>
            )}
          </span>
        </div>
      </div>

      <Button
        className={cn(
          'h-11 w-full text-base leading-none',
          showDescriptionAfterButton ? 'row-start-3 mt-5' : 'row-start-4 mt-4',
        )}
        variant={isMostPopular ? 'default' : 'outline'}
        asChild
      >
        <Link href={link.href}>{link.label}</Link>
      </Button>

      {features.items.length > 0 && (
        <div
          className={cn(
            'row-start-5 flex flex-col gap-y-2.5',
            showDescriptionAfterButton ? 'mt-4 border-t border-border pt-6' : 'mt-6',
          )}
        >
          {features.title && (
            <p className="text-sm leading-tight tracking-tight text-foreground">{features.title}</p>
          )}
          <ul className="flex flex-col gap-y-2.5">
            {visibleFeatures.map((item, index) => {
              const { label, lucideIcon, tooltip } = item;
              return (
                <li key={index} className="flex items-center text-sm">
                  {lucideIcon && <Slot className="mr-2 size-3.5 shrink-0">{lucideIcon}</Slot>}
                  <span className="leading-tight tracking-tight text-foreground">{label}</span>
                  {tooltip && (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="ml-1.5 cursor-pointer" aria-label={tooltip}>
                            <Info className="size-3.5 text-muted-foreground" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-foreground text-background">
                          <p>{tooltip}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )}
                </li>
              );
            })}
          </ul>

          {hasMoreFeatures && !showAllFeatures && (
            <Button
              className="size-fit p-0 text-left text-sm leading-tight font-normal text-foreground"
              variant="link"
              onClick={() => setShowAllFeatures(!showAllFeatures)}
            >
              And more...
            </Button>
          )}
        </div>
      )}
    </Component>
  );
}

export default PricingCard;
