import { Fragment, memo } from 'react';
import { ChevronLeft, ChevronRight, Info } from 'lucide-react';

import { IPricingTableFeatures } from '@/types/pricing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FeaturesColumnProps {
  featureCategories: IPricingTableFeatures[];
  totalRows: number;
  handlePrevPlan: () => void;
  handleNextPlan: () => void;
  plansCount: number;
}

const FeaturesColumn = memo(function FeaturesColumn({
  featureCategories,
  totalRows,
  handlePrevPlan,
  handleNextPlan,
  plansCount,
}: FeaturesColumnProps) {
  return (
    <div
      className="relative grid grid-rows-subgrid border-muted/30 bg-background"
      style={{
        gridRow: '1 / span ' + totalRows,
      }}
    >
      <div
        className={cn(
          'sticky top-(--sticky-header-height) z-30 flex min-h-32 flex-col justify-end bg-background pb-6 md:pb-5 lg:top-[calc(var(--sticky-header-height)+3rem)] xl:min-h-36',
          'before:absolute before:-top-4 before:left-0 before:z-10 before:h-4 before:w-full before:bg-background lg:before:-top-12 lg:before:h-12',
        )}
      >
        <div
          className={cn(
            'flex touch-manipulation items-end gap-x-1',
            plansCount === 1 && 'hidden',
            plansCount <= 4 && 'md:hidden',
            plansCount > 4 && 'lg:hidden',
          )}
        >
          <Button
            className="size-8"
            variant="outline"
            size="icon"
            onClick={handlePrevPlan}
            aria-label="Previous plan"
          >
            <ChevronLeft className="shrink-0" size={18} />
          </Button>

          <Button
            className="size-8"
            variant="outline"
            size="icon"
            onClick={handleNextPlan}
            aria-label="Next plan"
          >
            <ChevronRight className="shrink-0" size={18} />
          </Button>
        </div>
      </div>

      {featureCategories.map((category, index) => (
        <Fragment key={`feature-group-${category.name}`}>
          <div
            className={cn('border-b border-border pb-6', index > 0 && 'pt-11')}
            key={`category-${category.name}`}
          >
            <span className="inline-block text-xl leading-snug font-semibold tracking-tight text-foreground">
              {category.name}
            </span>
          </div>

          {category.features.map(({ name, description, tooltip }) => (
            <div
              className="flex flex-col gap-y-0.5 border-b border-border bg-background py-3 pr-4 text-left text-sm font-medium tracking-tight text-foreground"
              key={`feature-${name}`}
            >
              <span className="flex max-w-64 items-center text-base leading-snug font-medium tracking-tight text-foreground">
                {name}
                {tooltip && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="ml-1.5 cursor-pointer">
                          <Info className="size-3.5 text-muted-foreground/60" />
                        </span>
                      </TooltipTrigger>
                      <TooltipContent className="bg-foreground text-background">
                        <p>{tooltip}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </span>
              {description && (
                <span className="max-w-60 text-[0.8125rem] leading-snug tracking-tight text-muted-foreground">
                  {description}
                </span>
              )}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  );
});

export default FeaturesColumn;
