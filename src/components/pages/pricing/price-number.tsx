import { HTMLAttributes } from 'react';
import NumberFlow from '@number-flow/react';

import { priceNumberFormat } from '@/lib/pricing/utils';
import { cn } from '@/lib/utils';

interface PriceNumberProps extends HTMLAttributes<HTMLElement> {
  value: number;
  currency?: string;
  suffix?: string;
  prefix?: string;
  className?: string;
  animated?: boolean;
  size?: 'md' | 'lg';
}

/**
 * PriceNumber component for displaying animated prices
 *
 * A wrapper around the NumberFlow library with additional features:
 * - Tailwind integration via ::part selectors
 * - Preset sizes for different contexts
 * - Unified price formatting
 *
 * @see {@link https://number-flow.barvian.me/ NumberFlow documentation}
 *
 * @example
 * // Basic usage
 * <PriceNumber value={29} currency="USD" suffix=" per month" />
 *
 * // Display in a table
 * <PriceNumber value={29} currency="USD" size="md" />
 *
 * // Disable animation
 * <PriceNumber value={29} currency="USD" animated={false} />
 */
function PriceNumber({
  value,
  currency,
  suffix,
  prefix,
  className,
  size = 'lg',
  animated = true,
  ...props
}: PriceNumberProps) {
  const sizeClasses = {
    md: 'part-[number]:text-base part-[left]:text-base md:part-[number]:text-[0.8125rem] xl:part-[number]:text-base md:part-[suffix]:text-[0.8125rem] xl:part-[suffix]:text-base',
    lg: 'part-[number]:text-4xl part-[left]:text-4xl part-[suffix]:text-sm',
  };

  return (
    <NumberFlow
      value={value}
      className={cn(
        'mt-[calc(var(--number-flow-mask-height)*-1)]',
        'part-[suffix]:leading-tight part-[suffix]:tracking-tight part-[suffix]:text-muted-foreground',
        'part-[number]:leading-tight part-[number]:tracking-tight part-[number]:text-foreground',
        'part-[left]:leading-tight part-[left]:tracking-tight part-[left]:text-foreground',
        sizeClasses[size],
        className,
      )}
      locales={priceNumberFormat.locales}
      format={{
        ...priceNumberFormat.options,
        currency: currency || priceNumberFormat.options.currency,
      }}
      suffix={suffix}
      prefix={prefix}
      animated={animated}
      {...props}
    />
  );
}

export default PriceNumber;
