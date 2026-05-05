import { Check, X } from 'lucide-react';

import type { IPricingTableFeatureRow } from '@/types/pricing';

interface TableCellProps {
  feature: IPricingTableFeatureRow;
  planId: string;
}

export default function TableCell({ feature, planId }: TableCellProps) {
  const value = feature.plans.find((plan) => plan.planId === planId)?.value;

  return (
    <div
      className="relative z-10 flex min-h-11 flex-col items-start gap-y-0.5 border-b border-border py-3 pr-5 pl-4 md:pl-0"
      role="cell"
      aria-label={`${feature.name} for ${planId} plan`}
    >
      {typeof value === 'boolean' ? (
        value ? (
          <Check className="mt-1 text-foreground/80" size={16} aria-label="Available" />
        ) : (
          <X className="mt-1 text-muted-foreground/80" size={16} aria-label="Not available" />
        )
      ) : typeof value === 'string' ? (
        <span className="mt-0.5 text-sm leading-tight tracking-tight">{value}</span>
      ) : value && typeof value === 'object' ? (
        <>
          <span className="mt-0.5 text-sm leading-tight tracking-tight">{value.title}</span>
          <span className="text-xs leading-snug tracking-tight text-muted-foreground">
            {value.description}
          </span>
        </>
      ) : null}
    </div>
  );
}
