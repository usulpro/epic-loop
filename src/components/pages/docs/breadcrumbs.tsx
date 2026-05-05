import { ChevronRightIcon } from 'lucide-react';

import { IBreadcrumbItem } from '@/types/common';
import { cn } from '@/lib/utils';
import { Link } from '@/components/ui/link';

interface IBreadcrumbsProps {
  className?: string;
  items: IBreadcrumbItem[];
}

function Breadcrumbs({ className, items }: IBreadcrumbsProps) {
  if (!items || items.length === 0) {
    return null;
  }

  const visibleItems = items.slice(-3);

  return (
    <nav className={cn('flex w-[calc(100%-2rem)]', className)} aria-label="Breadcrumb">
      <ol className="flex flex-wrap items-center gap-y-3">
        {visibleItems.map(({ label, href }, index) => {
          const isLast = index === visibleItems.length - 1;
          return (
            <li
              className="flex items-center text-sm tracking-tight text-muted-foreground"
              key={index}
            >
              {href ? (
                <Link className="leading-none whitespace-nowrap" variant="muted" href={href}>
                  {label}
                </Link>
              ) : (
                <span
                  className={cn(
                    'leading-none whitespace-nowrap',
                    isLast ? 'font-medium text-foreground' : 'text-muted-foreground',
                  )}
                  aria-current={isLast ? 'page' : undefined}
                >
                  {label}
                </span>
              )}
              {!isLast && (
                <ChevronRightIcon
                  className="mx-2.5 shrink-0 text-muted-foreground"
                  size={14}
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default Breadcrumbs;
