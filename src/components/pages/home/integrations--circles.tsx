import Image from 'next/image';
import { cn } from '@/lib/utils';
import { type ILogo } from '@/types/common';
import { type IIntegrationsSectionBase } from '@/types/landing';
import { type ReactNode } from 'react';

interface IIntegrationsProps extends IIntegrationsSectionBase {
  className?: string;
  logos: ILogo[];
  actions?: ReactNode;
}

function Integrations({
  className,
  title,
  description,
  logos,
  content,
  actions,
}: IIntegrationsProps) {
  if (!logos || logos.length === 0) return null;

  return (
    <section
      className={cn('integrations overflow-hidden py-12 md:py-14 lg:py-16 xl:py-24', className)}
    >
      <div className="mx-auto w-full px-5 md:max-w-4xl md:px-8">
        <header className="flex max-w-2xl flex-col self-start md:mx-auto md:items-center md:self-center lg:max-w-176">
          <h2 className="max-w-2xl font-heading text-3xl leading-tight font-semibold tracking-tight text-balance text-foreground md:text-center md:text-4xl md:leading-tight lg:max-w-full lg:text-5xl lg:leading-[1.125]">
            {title}
          </h2>
          <p className="mt-2 max-w-xl text-base leading-snug tracking-tight text-balance text-muted-foreground md:mt-3 md:max-w-2xl md:text-center lg:mt-4 lg:max-w-full lg:text-lg lg:leading-normal">
            {description}
          </p>
          {actions}
        </header>

        <ul className="relative mt-10 -ml-px flex w-fit items-center md:left-1/2 md:mt-14 md:-ml-4 md:-translate-x-1/2 lg:mt-18">
          {logos.map(({ src, alt, width, height }, index) => (
            <li
              className="-mr-4 flex size-13.5 shrink-0 items-center justify-center rounded-full border-2 border-background bg-card md:-mr-7.5 md:size-26 md:border-4 lg:size-29"
              key={index}
            >
              <Image
                className="h-5 w-auto object-contain md:h-10"
                src={src}
                alt={alt}
                width={width}
                height={height ?? 40}
              />
            </li>
          ))}
        </ul>

        {content && (
          <p
            className="mx-auto mt-8 text-base leading-snug tracking-tight text-muted-foreground md:mt-13 md:text-center lg:mt-18 lg:text-lg lg:leading-normal [&_a]:font-medium [&_a]:text-link [&_a]:hover:text-link/85"
            dangerouslySetInnerHTML={{ __html: content }}
          />
        )}
      </div>
    </section>
  );
}

export default Integrations;
