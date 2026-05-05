import { Fragment } from 'react';

import { IPricingTableFeatures } from '@/types/pricing';
import { cn } from '@/lib/utils';

interface TableDividerProps {
  className?: string;
  featureCategories: IPricingTableFeatures[];
  totalRows: number;
}

export default function TableDivider({
  className,
  featureCategories,
  totalRows,
}: TableDividerProps) {
  return (
    <div
      className={cn('hidden grid-rows-subgrid', className)}
      style={{
        gridRow: '1 / span ' + totalRows,
      }}
      aria-hidden
    >
      <div
        className={cn(
          'sticky top-(--sticky-header-height) z-30 min-h-32 bg-background lg:top-[calc(var(--sticky-header-height)+3rem)] xl:min-h-36',
          'before:absolute before:-top-4 before:left-0 before:z-10 before:h-4 before:w-full before:bg-background lg:before:-top-12 lg:before:h-12',
        )}
      />

      {featureCategories.map((category, index) => (
        <Fragment key={`divider-group-${category.name}`}>
          <div
            className={cn('relative z-10 min-h-12 border-b border-border', index > 0 && 'pt-11')}
          />

          {category.features.map((feature) => (
            <div className="border-b border-border py-3" key={`divider-${feature.name}`} />
          ))}
        </Fragment>
      ))}
    </div>
  );
}
