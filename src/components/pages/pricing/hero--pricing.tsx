import NextLink from 'next/link';

import { type ILogo } from '@/types/common';
import { type IPricingPlan } from '@/types/pricing';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Logos from '@/components/pages/logos';

import PeriodToggle from './period-toggle';
import PricingCard from './pricing-card';

interface IHeroProps {
  className?: string;
  title: string;
  description: string;
  plans: IPricingPlan[];
  logos?: ILogo[];
  logosTitle?: string;
  cta?: {
    title: string;
    description: string;
    buttonText: string;
    buttonUrl: string;
  };
}

function Hero({ className, title, description, plans, logos, logosTitle, cta }: IHeroProps) {
  return (
    <section className={cn('hero py-10 md:py-16 lg:py-24', className)}>
      <div
        className={cn(
          'mx-auto w-full max-w-3xl px-5 md:px-8',
          plans.length < 3 && 'lg:px-0 xl:max-w-4xl xl:px-8',
          plans.length === 4 && 'lg:px-0 xl:max-w-7xl xl:px-8',
          (plans.length === 3 || plans.length > 4) && 'lg:max-w-5xl',
        )}
      >
        <header className="text-center">
          <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance text-foreground sm:text-5xl sm:leading-tighter lg:text-6xl lg:leading-tighter">
            {title}
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg leading-snug tracking-tight text-balance text-muted-foreground">
            {description}
          </p>
          <PeriodToggle className="mx-auto mt-9" pricingPlans={plans} variant="switch" />
        </header>

        <h2 className="sr-only font-heading">Pricing plans</h2>
        {plans.length > 0 && (
          <ul
            className={cn(
              'mx-auto mt-12 grid gap-5 sm:grid-cols-2',
              plans.length === 4 && 'xl:grid-cols-4',
              (plans.length === 3 || plans.length > 4) && 'lg:grid-cols-3',
              'auto-rows-min grid-rows-[auto_auto_auto_auto_1fr]',
            )}
          >
            {plans.map((plan) => (
              <PricingCard key={plan.id} plan={plan} as="li" />
            ))}
          </ul>
        )}
        {logos && (
          <Logos
            className="mt-16 items-center lg:mt-20"
            title={logosTitle ?? 'Trusted by Creators & Businesses'}
            titlePath="logosTitle"
            logos={logos}
          />
        )}

        {cta && cta.title && cta.description && cta.buttonText && cta.buttonUrl && (
          <div className="mx-auto mt-16 flex w-full max-w-3xl flex-col items-start justify-between gap-x-10 gap-y-5 rounded-lg border border-border bg-background px-8 py-6 pb-7 sm:flex-row sm:items-center sm:pb-6 lg:mt-20">
            <div className="flex flex-col">
              <h3 className="text-2xl leading-snug font-semibold tracking-tight text-foreground">
                {cta.title}
              </h3>
              <p className="mt-1 max-w-lg text-base leading-snug tracking-tight text-pretty text-muted-foreground">
                {cta.description}
              </p>
            </div>
            <Button className="h-11 w-full min-w-44 text-base sm:-mt-1 sm:w-fit">
              <NextLink href={cta.buttonUrl}>{cta.buttonText}</NextLink>
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

export default Hero;
