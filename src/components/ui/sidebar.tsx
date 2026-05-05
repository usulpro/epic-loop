'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva } from 'class-variance-authority';
import { PanelLeft } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const SIDEBAR_COOKIE_NAME = 'sidebar:state';
const SIDEBAR_COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
const SIDEBAR_WIDTH = '14rem';

const SIDEBAR_WIDTH_ICON = '3rem';
const SIDEBAR_KEYBOARD_SHORTCUT = 'b';

type SidebarContext = {
  state: 'expanded' | 'collapsed';
  open: boolean;
  setOpen: (open: boolean) => void;
  openMobile: boolean;
  setOpenMobile: (open: boolean) => void;
  isMobile: boolean;
  toggleSidebar: () => void;
};

const SidebarContext = React.createContext<SidebarContext | null>(null);

function useSidebar() {
  const context = React.useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider.');
  }

  return context;
}

const SidebarProvider = ({
  defaultOpen = true,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) => {
  const isMobile = useIsMobile();
  const [openMobile, setOpenMobile] = React.useState(false);

  const [_open, _setOpen] = React.useState(defaultOpen);
  const open = openProp ?? _open;
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === 'function' ? value(open) : value;
      if (setOpenProp) {
        setOpenProp(openState);
      } else {
        _setOpen(openState);
      }

      document.cookie = `${SIDEBAR_COOKIE_NAME}=${openState}; path=/; max-age=${SIDEBAR_COOKIE_MAX_AGE}`;
    },
    [setOpenProp, open],
  );

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open);
  }, [isMobile, setOpen, setOpenMobile]);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === SIDEBAR_KEYBOARD_SHORTCUT && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        toggleSidebar();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  const state = open ? 'expanded' : 'collapsed';

  const contextValue = React.useMemo<SidebarContext>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
    }),
    [state, open, setOpen, isMobile, openMobile, setOpenMobile, toggleSidebar],
  );

  return (
    <SidebarContext.Provider value={contextValue}>
      <TooltipProvider delayDuration={0}>
        <div
          style={
            {
              '--sidebar-width': SIDEBAR_WIDTH,
              '--sidebar-width-icon': SIDEBAR_WIDTH_ICON,
              ...style,
            } as React.CSSProperties
          }
          className={cn(
            'group/sidebar-wrapper flex min-h-svh w-full has-data-[variant=inset]:bg-muted',
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </TooltipProvider>
    </SidebarContext.Provider>
  );
};
SidebarProvider.displayName = 'SidebarProvider';

const Sidebar = ({
  side = 'left',
  variant = 'sidebar',
  collapsible = 'offcanvas',
  className,
  children,
  ...props
}: React.ComponentProps<'div'> & {
  side?: 'left' | 'right';
  variant?: 'sidebar' | 'floating' | 'inset';
  collapsible?: 'none' | 'offcanvas';
}) => {
  const { state } = useSidebar();

  if (collapsible === 'none') {
    return (
      <div
        className={cn(
          'flex h-full w-(--sidebar-width) flex-col bg-muted text-foreground',
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className="group peer hidden h-full text-foreground md:block"
      data-state={state}
      data-collapsible={state === 'collapsed' ? collapsible : ''}
      data-variant={variant}
      data-side={side}
    >
      <div
        className={cn(
          'relative h-svh w-(--sidebar-width) bg-transparent transition-[width] duration-200 ease-linear',
          'group-data-[collapsible=offcanvas]:w-0',
          'group-data-[side=right]:rotate-180',
          variant === 'inset'
            ? 'group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4)))]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon)',
          variant === 'floating' && 'hidden',
        )}
      />
      <div
        className={cn(
          'fixed inset-y-0 z-10 hidden h-svh w-(--sidebar-width) transition-all duration-200 ease-linear md:flex',
          side === 'left'
            ? 'left-0 group-data-[collapsible=offcanvas]:left-[calc(var(--sidebar-width)*-1)]'
            : 'right-0 group-data-[collapsible=offcanvas]:right-[calc(var(--sidebar-width)*-1)]',

          variant === 'floating' || variant === 'inset'
            ? 'p-2 group-data-[collapsible=icon]:w-[calc(var(--sidebar-width-icon)+(--spacing(4))+2px)]'
            : 'group-data-[collapsible=icon]:w-(--sidebar-width-icon) group-data-[side=left]:border-r group-data-[side=right]:border-l',
          className,
        )}
        {...props}
      >
        <div data-sidebar="sidebar" className="flex size-full flex-col">
          {children}
        </div>
      </div>
    </div>
  );
};
Sidebar.displayName = 'Sidebar';

const SidebarTrigger = ({ className, onClick, ...props }: React.ComponentProps<typeof Button>) => {
  const { toggleSidebar } = useSidebar();

  return (
    <Button
      data-sidebar="trigger"
      variant="ghost"
      size="icon"
      className={cn('size-7', className)}
      onClick={(event) => {
        onClick?.(event);
        toggleSidebar();
      }}
      {...props}
    >
      <PanelLeft />
      <span className="sr-only">Toggle Sidebar</span>
    </Button>
  );
};
SidebarTrigger.displayName = 'SidebarTrigger';

const SidebarRail = ({ className, ...props }: React.ComponentProps<'button'>) => {
  const { toggleSidebar } = useSidebar();

  return (
    <button
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onClick={toggleSidebar}
      title="Toggle Sidebar"
      className={cn(
        'absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all duration-200 ease-linear group-data-[side=left]:-right-4 group-data-[side=right]:left-0 after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-border sm:flex',
        'in-data-[side=left][data-state=collapsed]_&]:cursor-e-resize in-data-[side=right][data-state=collapsed]_&]:cursor-w-resize',
        'group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-muted',
        '[[data-side=left][data-collapsible=offcanvas]_&]:-right-2',
        '[[data-side=right][data-collapsible=offcanvas]_&]:-left-2',
        className,
      )}
      {...props}
    />
  );
};
SidebarRail.displayName = 'SidebarRail';

const SidebarInset = ({ className, ...props }: React.ComponentProps<'main'>) => {
  return (
    <main
      className={cn(
        'relative flex min-h-svh flex-1 flex-col bg-background',
        'peer-data-[variant=inset]:min-h-[calc(100svh-(--spacing(4)))] md:peer-data-[variant=inset]:m-2 md:peer-data-[variant=inset]:ml-0 md:peer-data-[variant=inset]:rounded-xl md:peer-data-[variant=inset]:shadow-sm md:peer-data-[variant=inset]:peer-data-[state=collapsed]:ml-2',
        className,
      )}
      {...props}
    />
  );
};
SidebarInset.displayName = 'SidebarInset';

const SidebarHeader = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div data-sidebar="header" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
  );
};
SidebarHeader.displayName = 'SidebarHeader';

const SidebarFooter = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div data-sidebar="footer" className={cn('flex flex-col gap-2 p-2', className)} {...props} />
  );
};
SidebarFooter.displayName = 'SidebarFooter';

const SidebarSeparator = ({ className, ...props }: React.ComponentProps<typeof Separator>) => {
  return (
    <Separator
      data-sidebar="separator"
      className={cn('mx-2 w-auto bg-border', className)}
      {...props}
    />
  );
};
SidebarSeparator.displayName = 'SidebarSeparator';

const SidebarContent = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-sidebar="content"
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-2 overflow-auto group-data-[collapsible=icon]:overflow-hidden',
        className,
      )}
      {...props}
    />
  );
};
SidebarContent.displayName = 'SidebarContent';

const SidebarGroup = ({ className, ...props }: React.ComponentProps<'div'>) => {
  return (
    <div
      data-sidebar="group"
      className={cn('relative flex w-full min-w-0 flex-col', className)}
      {...props}
    />
  );
};
SidebarGroup.displayName = 'SidebarGroup';

const SidebarGroupLabel = ({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'div'> & {
  asChild?: boolean;
}) => {
  const Comp = asChild ? Slot : 'div';

  return (
    <Comp
      data-sidebar="group-label"
      className={cn(
        'flex h-8 shrink-0 items-center rounded-md px-2 text-xs font-medium text-foreground/70 outline-hidden transition-[margin,opacity] duration-200 ease-linear',
        'group-data-[collapsible=icon]:-mt-8 group-data-[collapsible=icon]:opacity-0',
        className,
      )}
      {...props}
    />
  );
};
SidebarGroupLabel.displayName = 'SidebarGroupLabel';

const SidebarGroupAction = ({
  className,
  asChild = false,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
}) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-sidebar="group-action"
      className={cn(
        'absolute top-3.5 right-3 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-foreground outline-hidden transition-all duration-200 hover:text-muted-foreground',

        'after:absolute after:-inset-2 md:after:hidden',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
};
SidebarGroupAction.displayName = 'SidebarGroupAction';

const SidebarGroupContent = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div data-sidebar="group-content" className={cn('w-full text-sm', className)} {...props} />
);
SidebarGroupContent.displayName = 'SidebarGroupContent';

const SidebarMenu = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul
    data-sidebar="menu"
    className={cn('flex w-full min-w-0 flex-col gap-1', className)}
    {...props}
  />
);
SidebarMenu.displayName = 'SidebarMenu';

const SidebarMenuItem = ({ className, ...props }: React.ComponentProps<'li'>) => (
  <li data-sidebar="menu-item" className={cn('group/menu-item relative', className)} {...props} />
);
SidebarMenuItem.displayName = 'SidebarMenuItem';

const sidebarMenuButtonVariants = cva(
  'peer/menu-button text-muted-foreground outline-hidden hover:text-link active:text-link data-[active=true]:text-link data-[state=open]:hover:text-link flex w-full items-center gap-2 overflow-hidden rounded-md px-0 py-0.5 text-left text-sm transition-all duration-200 disabled:pointer-events-none disabled:opacity-50 group-has-[[data-sidebar=menu-action]]/menu-item:pr-8 aria-disabled:pointer-events-none aria-disabled:opacity-50 data-[active=true]:font-medium group-data-[collapsible=icon]:!size-8 group-data-[collapsible=icon]:!p-2',
  {
    variants: {
      variant: {
        default: 'hover:text-link',
        outline:
          'bg-background hover:text-muted-foreground shadow-[0_0_0_1px_hsl(var(--sidebar-border))] hover:shadow-[0_0_0_1px_hsl(var(--sidebar-accent))]',
      },
      size: {
        default: 'h-8 text-sm',
        sm: 'h-7 text-xs',
        lg: 'group-data-[collapsible=icon]:p-0! h-12 text-sm',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
);

const SidebarMenuButton = ({
  asChild = false,
  isActive = false,
  variant = 'default',
  size = 'default',
  tooltip,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  isActive?: boolean;
  variant?: 'default' | 'outline';
  size?: 'default' | 'sm' | 'lg';
  tooltip?: React.ReactNode;
  className?: string;
}) => {
  const Comp = asChild ? Slot : 'button';
  const { isMobile, state } = useSidebar();

  const button = (
    <Comp
      data-sidebar="menu-button"
      data-size={size}
      data-active={isActive}
      className={cn(sidebarMenuButtonVariants({ variant, size }), className)}
      {...props}
    />
  );

  const contentProps =
    typeof tooltip === 'object' && tooltip !== null && !React.isValidElement(tooltip)
      ? tooltip
      : { children: tooltip };

  return (
    <Tooltip>
      <TooltipTrigger asChild>{button}</TooltipTrigger>
      <TooltipContent
        side="right"
        align="center"
        hidden={state !== 'collapsed' || isMobile}
        {...contentProps}
      />
    </Tooltip>
  );
};
SidebarMenuButton.displayName = 'SidebarMenuButton';

const SidebarMenuAction = ({
  className,
  asChild = false,
  showOnHover = false,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  showOnHover?: boolean;
}) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-sidebar="menu-action"
      className={cn(
        'absolute top-1.5 right-1 flex aspect-square w-5 items-center justify-center rounded-md p-0 text-muted-foreground outline-hidden transition-all duration-200 peer-hover/menu-button:text-muted-foreground hover:text-primary',

        'after:absolute after:-inset-2 md:after:hidden',
        'peer-data-[size=sm]/menu-button:top-1',
        'peer-data-[size=default]/menu-button:top-1.5',
        'peer-data-[size=lg]/menu-button:top-2.5',
        'group-data-[collapsible=icon]:hidden',
        showOnHover &&
          'group-focus-within/menu-item:opacity-100 group-hover/menu-item:opacity-100 peer-data-[active=true]/menu-button:text-muted-foreground data-[state=open]:opacity-100 md:opacity-0',
        className,
      )}
      {...props}
    />
  );
};
SidebarMenuAction.displayName = 'SidebarMenuAction';

const SidebarMenuBadge = ({ className, ...props }: React.ComponentProps<'span'>) => (
  <span
    data-sidebar="menu-badge"
    className={cn(
      'pointer-events-none ml-2 inline-flex items-center justify-center rounded-full bg-muted-foreground px-1.5 py-0.5 text-xs font-medium text-secondary tabular-nums select-none',
      'group-data-[collapsible=icon]:hidden',
      className,
    )}
    {...props}
  />
);
SidebarMenuBadge.displayName = 'SidebarMenuBadge';

const SidebarMenuSub = ({ className, ...props }: React.ComponentProps<'ul'>) => (
  <ul
    data-sidebar="menu-sub"
    className={cn(
      'flex min-w-0 translate-x-px flex-col gap-1 border-l border-border py-0.5 pr-0 pl-2.5',
      'group-data-[collapsible=icon]:hidden',
      className,
    )}
    {...props}
  />
);
SidebarMenuSub.displayName = 'SidebarMenuSub';

const SidebarMenuSubItem = ({ ...props }: React.ComponentProps<'li'>) => <li {...props} />;
SidebarMenuSubItem.displayName = 'SidebarMenuSubItem';

const SidebarMenuSubButton = ({
  asChild = false,
  size = 'md',
  isActive,
  className,
  ...props
}: React.ComponentProps<'button'> & {
  asChild?: boolean;
  size?: 'md' | 'sm';
  isActive?: boolean;
  className?: string;
}) => {
  const Comp = asChild ? Slot : 'button';

  return (
    <Comp
      data-sidebar="menu-sub-button"
      data-size={size}
      data-active={isActive}
      className={cn(
        'flex h-7 min-w-0 -translate-x-px items-center gap-2 overflow-hidden rounded-md px-2 text-foreground outline-hidden hover:text-link active:text-link disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&>svg]:text-muted-foreground',
        'data-[active=true]:text-link',
        size === 'sm' && 'text-xs',
        size === 'md' && 'text-sm',
        'group-data-[collapsible=icon]:hidden',
        className,
      )}
      {...props}
    />
  );
};
SidebarMenuSubButton.displayName = 'SidebarMenuSubButton';

export {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
};
