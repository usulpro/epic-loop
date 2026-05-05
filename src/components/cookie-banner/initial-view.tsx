import { useState } from 'react';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface InitialViewProps {
  allowSettingsCustomization: boolean;
  handleOpenCookieSettings?: () => void;
  handleDeclineClick: () => void;
  handleAcceptClick: () => void;
  description: React.ReactNode;
  isInitiallyExpanded: boolean;
}

export default function InitialView({
  allowSettingsCustomization,
  handleOpenCookieSettings,
  handleDeclineClick,
  handleAcceptClick,
  description,
  isInitiallyExpanded,
}: InitialViewProps) {
  const [isExpanded, setIsExpanded] = useState(isInitiallyExpanded);

  return (
    <div
      className={cn(
        'flex flex-col gap-7',
        !allowSettingsCustomization && 'sm:flex-row sm:items-center sm:justify-between',
      )}
    >
      <div>
        <div
          className={cn(
            'flex flex-col gap-y-5 text-sm leading-normal tracking-tight text-pretty text-popover-foreground/70',
            !isExpanded && 'line-clamp-3',
          )}
        >
          {description}
        </div>
        {!isExpanded && allowSettingsCustomization && (
          <button
            className="tracking-none mt-2.5 text-[0.8125rem] leading-snug font-medium text-popover-foreground transition-colors duration-300 hover:text-popover-foreground/85"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? 'Read less' : 'Read more'}
          </button>
        )}
      </div>

      <div className="flex items-center justify-end gap-x-5">
        {allowSettingsCustomization && handleOpenCookieSettings && (
          <Button
            className="px-0 text-popover-foreground underline decoration-popover-foreground/35 underline-offset-[0.375rem] hover:decoration-popover-foreground"
            variant="link"
            size="sm"
            onClick={handleOpenCookieSettings}
          >
            Cookies settings
          </Button>
        )}
        <div className={cn('flex gap-x-3.5', !allowSettingsCustomization && 'ml-auto')}>
          <Button variant="outline" size="sm" onClick={handleDeclineClick}>
            Reject
          </Button>
          <Button size="sm" onClick={handleAcceptClick}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
