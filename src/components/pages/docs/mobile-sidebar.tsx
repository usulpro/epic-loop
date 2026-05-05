'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import config from '@/configs/website-config';
import { ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';

import { IDocsTreeNode } from '@/types/docs';
import { cn } from '@/lib/utils';
import { useMetaColor } from '@/hooks/use-meta-color';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Drawer, DrawerContent, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer';

interface MobileSidebarProps {
  className?: string;
  title: string;
  items: IDocsTreeNode[];
}

function normalizePathSlug(p?: string) {
  if (!p) return '';
  return p.replace(/\/$/, '');
}

function isSameHref(a?: string, b?: string) {
  return normalizePathSlug(a) === normalizePathSlug(b);
}

function hasActiveDescendant(item: IDocsTreeNode, currentPath: string): boolean {
  if (item.href && isSameHref(item.href, currentPath)) return true;
  if (item.children) {
    return item.children.some((child) => hasActiveDescendant(child, currentPath));
  }
  return false;
}

function hasHrefDescendant(item: IDocsTreeNode, href: string): boolean {
  if (item.href && isSameHref(item.href, href)) return true;
  if (!item.children?.length) return false;
  return item.children.some((child) => hasHrefDescendant(child, href));
}

function findFirstHref(items: IDocsTreeNode[]): string | undefined {
  for (const item of items) {
    if (item.href) return item.href;
    if (item.children?.length) {
      const nested = findFirstHref(item.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

interface RecursiveMenuItemComponentProps {
  item: IDocsTreeNode;
  depth: number;
  currentPath: string;
  fallbackActiveHref?: string;
}

function RecursiveMenuItemComponent({
  item,
  depth,
  currentPath,
  fallbackActiveHref,
}: RecursiveMenuItemComponentProps) {
  const hasChildren = !!item.children?.length;
  const isSeparator = item.type === 'separator';
  const isFolder = item.type === 'folder';
  const isPage = item.type === 'page';

  const pathActive = isSameHref(item.href, currentPath);
  const fallbackActive = !!fallbackActiveHref && isSameHref(item.href, fallbackActiveHref);
  const exactActive = pathActive || fallbackActive;
  const branchActive =
    hasActiveDescendant(item, currentPath) ||
    (!!fallbackActiveHref && hasHrefDescendant(item, fallbackActiveHref));

  const [isOpen, setIsOpen] = useState(
    hasChildren && (branchActive || exactActive || item?.defaultOpen === true),
  );

  useEffect(() => {
    if (hasChildren && (branchActive || exactActive)) {
      setIsOpen(true);
    }
  }, [hasChildren, branchActive, exactActive, currentPath]);

  if (isSeparator) {
    return (
      <li className="not-first:mt-4">
        <span className="mb-1.5 inline-block text-base leading-snug font-medium tracking-tight text-muted-foreground">
          {item.label}
        </span>
      </li>
    );
  }

  if (isFolder) {
    const href = item.href;
    return (
      <li>
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <CollapsibleTrigger className="group flex h-9 w-full items-center justify-between rounded px-0 text-left text-sm font-medium transition-colors hover:text-foreground/80 [&[data-state=open]>svg]:rotate-90">
            {href ? (
              <Link
                className={cn(
                  'text-base leading-snug font-medium tracking-tight outline-hidden hover:text-link',
                  exactActive && 'text-link',
                )}
                href={href}
                aria-current={exactActive ? 'page' : undefined}
              >
                {item.label}
              </Link>
            ) : (
              <span className="text-base leading-snug font-medium tracking-tight">
                {item.label}
              </span>
            )}
            <ChevronRight className="size-4 shrink-0 transition-transform duration-200" />
          </CollapsibleTrigger>

          <CollapsibleContent className={cn(!branchActive && !exactActive && 'overflow-hidden')}>
            <RecursiveMenu
              items={item.children!}
              depth={depth + 1}
              fallbackActiveHref={fallbackActiveHref}
            />
          </CollapsibleContent>
        </Collapsible>
      </li>
    );
  }

  if (isPage) {
    return (
      <li>
        <Link
          className={cn(
            'relative flex h-9 flex-1 items-center text-base leading-snug font-medium tracking-tight outline-hidden hover:text-link',
            exactActive ? 'text-link' : 'text-foreground',
          )}
          href={item.href ?? '#'}
          aria-current={exactActive ? 'page' : undefined}
        >
          {depth >= 1 && exactActive && (
            <span
              className="absolute top-0 h-full w-px -translate-x-px bg-[hsl(var(--link))]"
              style={{ left: `calc(-${depth} * 1rem)` }}
              aria-hidden
            />
          )}
          {item.label}
        </Link>
      </li>
    );
  }

  return null;
}

function RecursiveMenu({
  items,
  depth = 0,
  fallbackActiveHref,
}: {
  items: IDocsTreeNode[];
  depth?: number;
  fallbackActiveHref?: string;
}) {
  const pathname = usePathname();

  return (
    <ul
      className={cn('flex flex-col', depth === 1 && 'border-l border-border', depth > 0 && 'pl-4')}
    >
      {items.map((item, idx) => (
        <RecursiveMenuItemComponent
          key={item.href ?? `${item.type}-${item.label}-${idx}`}
          item={item}
          depth={depth}
          currentPath={pathname}
          fallbackActiveHref={fallbackActiveHref}
        />
      ))}
    </ul>
  );
}

function MobileSidebar({ items, className, title = 'Documentation' }: MobileSidebarProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const anyActive = items.some((node) => hasActiveDescendant(node, pathname));
  const fallbackActiveHref = anyActive ? undefined : findFirstHref(items);
  const { setMetaColor, metaColor } = useMetaColor();

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const onOpenChange = useCallback(
    (open: boolean) => {
      setOpen(open);
      setMetaColor(open ? config.metaThemeColors.dark : metaColor);
    },
    [setMetaColor, metaColor],
  );

  if (!items || items.length === 0) return null;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      shouldScaleBackground={false}
      preventScrollRestoration
    >
      <DrawerTrigger
        className={cn(
          'fixed inset-x-0 bottom-0 z-30 flex h-14 items-center border-t border-border bg-background px-5 md:px-8',
          className,
        )}
        data-slot="documentation-menu-trigger"
      >
        <CornerDownRight className="mr-2.5 size-3.5 shrink-0" />
        <span className="text-base leading-snug font-medium tracking-tight text-foreground">
          {title}
        </span>
        <ChevronDown className="ml-auto size-5 shrink-0 transition-transform duration-200" />
      </DrawerTrigger>

      <DrawerContent className="flex h-[75dvh] flex-col rounded-t-xl p-0 lg:hidden">
        <DrawerTitle className="sr-only">Documentation menu</DrawerTitle>

        <div className="flex-1 overflow-y-auto px-5 pt-6 pb-12 md:px-8">
          <RecursiveMenu items={items} depth={0} fallbackActiveHref={fallbackActiveHref} />
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20 w-full bg-linear-to-b from-transparent to-background"
          aria-hidden
        />
      </DrawerContent>
    </Drawer>
  );
}

export default MobileSidebar;
