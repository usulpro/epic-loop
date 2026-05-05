import { ReactNode } from 'react';
import { ChevronRightIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Link } from '@/components/ui/link';

interface CardProps {
  className?: string;
  title: string;
  description: string;
  linkUrl: string;
  linkText?: string;
  icon?: ReactNode;
  number?: number;
  asLink?: boolean;
}

function Card({
  title,
  description,
  linkUrl,
  linkText,
  icon,
  number,
  asLink = true,
  className,
  ...props
}: CardProps) {
  const hasLink = linkUrl && linkText;
  const Component = asLink ? Link : 'div';

  return (
    <Component
      className={cn(
        'group flex h-full flex-col items-start justify-between rounded-lg bg-card p-4',
        className,
      )}
      href={linkUrl ?? undefined}
      {...props}
    >
      {(icon || number) && (
        <div
          className={cn(
            'mb-3.5',
            number &&
              'flex size-9 shrink-0 items-center justify-center rounded-lg border border-border',
          )}
        >
          {icon ? (
            icon
          ) : (
            <span className="text-sm leading-none font-medium text-foreground">{number}</span>
          )}
        </div>
      )}
      <h3
        className={cn(
          'mb-1.5 text-lg leading-snug font-medium tracking-tight text-foreground transition-colors duration-300',
          asLink && 'group-hover:text-foreground/85',
        )}
      >
        {title}
      </h3>
      <p
        className={cn(
          'mt-1.5 line-clamp-6 text-sm leading-snug tracking-tight text-muted-foreground',
          hasLink && 'mb-2.5',
          !hasLink && 'mb-auto',
        )}
      >
        {description}
      </p>
      {hasLink && !asLink && (
        <Link className="group/link mt-auto w-fit leading-none" href={linkUrl} size="sm">
          {linkText}
          <ChevronRightIcon
            className="-mx-0.5 transition-transform duration-300 group-hover/link:translate-x-0.5"
            size={12}
          />
        </Link>
      )}
      {asLink && hasLink && (
        <span className="mt-auto flex w-fit gap-x-1.5 text-sm leading-none font-medium tracking-tight">
          {linkText}
          <ChevronRightIcon
            className="-mx-0.5 transition-transform duration-300 group-hover:translate-x-0.5"
            size={12}
          />
        </span>
      )}
    </Component>
  );
}

export default Card;
