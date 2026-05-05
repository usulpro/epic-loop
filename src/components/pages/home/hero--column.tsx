import Image from 'next/image';
import Logos from '@/components/pages/logos';
import { cn } from '@/lib/utils';
import { type IHeroSection } from '@/types/landing';
import { type ReactNode } from 'react';

export interface IHeroProps extends Omit<
  IHeroSection,
  'image' | 'labelUrl' | 'labelBadge' | 'labelAdditionalText' | 'avatars'
> {
  className?: string;
  image?: IHeroSection['image'];
  label?: ReactNode;
  actions?: ReactNode;
}

function Hero({
  className,
  label,
  title,
  description,
  logosTitle,
  image,
  actions,
  logos,
}: IHeroProps) {
  const hasImage = Boolean(image);
  return (
    <section className={cn('hero py-12 md:py-14 lg:py-16 xl:py-24', className)}>
      <div className="mx-auto max-w-7xl px-5 md:px-8">
        <header
          className={cn(
            'flex w-full max-w-3xl flex-col',
            !hasImage && 'md:mx-auto md:items-center lg:max-w-3xl lg:px-8 xl:max-w-4xl',
          )}
        >
          {label}
          <h1
            className={cn(
              'font-heading text-3xl leading-tight font-semibold tracking-tight text-balance md:text-4xl md:leading-tight md:tracking-tight lg:text-5xl lg:leading-tighter xl:max-w-4xl xl:text-7xl xl:leading-tight xl:tracking-tighter',
              !hasImage && 'md:text-center lg:max-w-3xl lg:px-8',
            )}
          >
            {title}
          </h1>
          <p
            className={cn(
              'mt-3 max-w-2xl text-lg leading-normal tracking-tight text-balance text-muted-foreground md:mt-5',
              !hasImage && 'md:text-center',
            )}
          >
            {description}
          </p>
          {actions}
        </header>
        {image && (
          <div className="relative mt-10 aspect-video w-full overflow-hidden rounded-md md:mt-16 md:rounded-xl lg:mt-20">
            <Image
              className="object-cover"
              src={image.src ?? '/images/cover-4.jpg'}
              alt={image.alt ?? ''}
              fill
              sizes="(min-width: 1280px) 1216px, 100vw"
              preload
              loading="eager"
              quality={95}
            />
          </div>
        )}
        {logos && (
          <Logos
            className={cn(
              'mt-12 md:mt-14 lg:mt-20',
              !hasImage && 'mx-auto mt-16 max-w-5xl md:mt-24 lg:mt-32 xl:mt-36',
            )}
            title={logosTitle ?? 'Trusted by Creators & Businesses'}
            titlePath="logosTitle"
            variant={!hasImage ? 'column' : 'row'}
            logos={logos}
          />
        )}
      </div>
    </section>
  );
}

export default Hero;
