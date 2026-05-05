import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { type IBentoSection } from '@/types/landing';
import { type ReactNode } from 'react';

export interface IBentoProps extends IBentoSection {
  className?: string;
  actions?: ReactNode;
}

function Bento({ className, label, title, description, actions, items }: IBentoProps) {
  if (!items || items.length === 0) {
    return null;
  }

  return (
    <section className={cn('bento py-12 md:py-14 lg:py-16 xl:py-24', className)}>
      <div className="mx-auto max-w-lg px-5 md:max-w-3xl md:px-8 lg:max-w-5xl xl:max-w-6xl">
        <header className="flex max-w-3xl flex-col md:mx-auto md:items-center xl:max-w-4xl xl:px-8">
          {label && <Badge className="mb-5 lg:mb-9">{label}</Badge>}
          <h2 className="font-heading text-3xl leading-tight font-semibold tracking-tight text-balance md:text-center md:text-4xl md:leading-tight lg:text-5xl lg:leading-tighter">
            {title}
          </h2>
          <p className="mt-3 max-w-2xl text-lg leading-normal tracking-tight text-balance text-muted-foreground md:mt-5 md:text-center">
            {description}
          </p>
          {actions}
        </header>

        <ul className="mt-10 grid auto-rows-fr grid-cols-1 gap-5 md:mt-14 md:grid-cols-2 lg:mt-20 lg:flex lg:flex-wrap">
          {items.map(
            ({ label: cardLabel, title: cardTitle, description: cardDescription }, index) => (
              <li
                className={cn(
                  'relative grid h-120 w-full grow grid-cols-1 grid-rows-1 overflow-hidden rounded-xl lg:h-auto',
                  index === 0 || index === 3 || index === 4
                    ? 'col-span-full lg:aspect-[1.333333] lg:max-w-139 xl:max-w-160'
                    : 'lg:aspect-[0.891666] lg:max-w-96 xl:max-w-107',
                )}
                key={index}
              >
                <div className="col-span-full row-span-full bg-card"></div>
                <div className="relative z-10 col-span-full row-span-full">
                  <div className="flex h-full flex-col justify-end p-5 md:p-6">
                    {cardLabel && (
                      <Badge className="mb-auto" variant="filled">
                        {cardLabel}
                      </Badge>
                    )}

                    <p className="text-base leading-normal tracking-tight text-pretty md:text-lg md:leading-normal [&_a]:text-link [&_a:hover]:text-link/85 [&_strong]:font-semibold">
                      <strong className="font-semibold text-foreground">{cardTitle}</strong>
                      {` `}
                      <span className="text-muted-foreground">{cardDescription}</span>
                    </p>
                  </div>
                </div>
              </li>
            ),
          )}
        </ul>
      </div>
    </section>
  );
}

export default Bento;
