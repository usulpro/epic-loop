'use client';

import { useEffect, useState } from 'react';
import { Route } from 'next';
import { usePathname } from 'next/navigation';
import { ChevronRight } from 'lucide-react';

import { IDocsTreeNode } from '@/types/docs';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Link } from '@/components/ui/link';
import SearchBar from '@/components/ui/search-bar';
import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
} from '@/components/ui/sidebar';
import { getDocsSidebarIcon } from '@/components/pages/docs/docs-sidebar-icons';

function normalizePathSlug(p: string) {
  if (!p) return '';
  return p.replace(/\/$/, '');
}
function isSameHref(a?: string | URL | Route<string>, b?: string) {
  return normalizePathSlug(a?.toString() || '') === normalizePathSlug(b || '');
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
    if (item.href) return item.href.toString();
    if (item.children?.length) {
      const nested = findFirstHref(item.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

function SidebarMenuItemLabel({ item }: { item: IDocsTreeNode }) {
  const { icon, label, badge } = item;
  const Icon = getDocsSidebarIcon(icon);

  return (
    <span className="flex items-baseline gap-2">
      {Icon && <Icon className="relative top-[0.1875rem] size-[1.125rem] shrink-0" />}
      <span className="text-sm leading-snug font-medium tracking-tight text-pretty">
        {label}
        {badge && <SidebarMenuBadge className="h-4">{badge}</SidebarMenuBadge>}
      </span>
    </span>
  );
}

interface SidebarMenuItemComponentProps {
  item: IDocsTreeNode;
  depth: number;
  currentPath: string;
  fallbackActiveHref?: string;
}

function SidebarMenuItemComponent({
  item,
  depth,
  currentPath,
  fallbackActiveHref,
}: SidebarMenuItemComponentProps) {
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
  }, [currentPath, hasChildren, branchActive, exactActive]);

  if (isSeparator) {
    return (
      <SidebarMenuItem className="not-first:mt-4">
        <p className="mb-2 block text-sm leading-snug font-medium tracking-tight text-foreground">
          {item.label}
        </p>
      </SidebarMenuItem>
    );
  }

  if (isFolder) {
    const href = item.href;
    return (
      <Collapsible open={isOpen} onOpenChange={setIsOpen} asChild>
        <SidebarMenuItem>
          <CollapsibleTrigger asChild>
            <SidebarMenuButton className="whitespace-wrap relative h-auto min-h-8 overflow-visible">
              {href ? (
                <Link
                  className={cn(
                    'outline-hidden hover:text-link [&_svg]:size-[1.125rem]',
                    exactActive && 'font-medium text-link',
                  )}
                  href={href}
                  variant="ghost"
                  aria-current={exactActive ? 'page' : undefined}
                >
                  {depth >= 1 && exactActive && (
                    <span
                      className="absolute top-0 h-full w-px -translate-x-px bg-[hsl(var(--link))]"
                      style={{ left: `calc(0.0625rem - ${depth} * 0.6875rem)` }}
                      aria-hidden
                    />
                  )}
                  <SidebarMenuItemLabel item={item} />
                </Link>
              ) : (
                <SidebarMenuItemLabel item={item} />
              )}
              <ChevronRight
                className={cn(
                  'ml-auto size-3.5 shrink-0 transition-transform duration-200',
                  isOpen ? 'rotate-90' : 'rotate-0',
                )}
                size={14}
                strokeWidth={2.5}
                aria-hidden
              />
            </SidebarMenuButton>
          </CollapsibleTrigger>
          <CollapsibleContent className="py-0.5">
            <SidebarMenuSub className={cn(depth >= 1 ? 'border-none' : 'py-0')}>
              {item.children?.map((child, index) => (
                <SidebarMenuItemComponent
                  key={`${child.type}-${child.label}-${index}`}
                  item={child}
                  depth={depth + 1}
                  currentPath={currentPath}
                  fallbackActiveHref={fallbackActiveHref}
                />
              ))}
            </SidebarMenuSub>
          </CollapsibleContent>
        </SidebarMenuItem>
      </Collapsible>
    );
  }

  if (isPage && item.href) {
    const exactPageActive = exactActive;
    return (
      <SidebarMenuItem>
        <SidebarMenuButton className="h-auto min-h-8" asChild>
          <Link
            className={cn(
              'outline-hidden hover:text-link [&_svg]:size-[1.125rem]',
              exactPageActive && 'font-medium text-link',
            )}
            href={item.href}
            variant="ghost"
            aria-current={exactPageActive ? 'page' : undefined}
          >
            {depth >= 1 && exactPageActive && (
              <span
                className="absolute top-0 h-full w-px -translate-x-px bg-[hsl(var(--link))]"
                style={{ left: `calc(0.0625rem - ${depth} * 0.6875rem)` }}
                aria-hidden
              />
            )}
            <SidebarMenuItemLabel item={item} />
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return null;
}

interface DocsSidebarProps {
  className?: string;
  sidebar: IDocsTreeNode[];
}

function DocsSidebar({ className, sidebar }: DocsSidebarProps) {
  const pathname = usePathname();
  const anyActive = sidebar.some((node) => hasActiveDescendant(node, pathname));
  const fallbackActiveHref = anyActive ? undefined : findFirstHref(sidebar);

  return (
    <aside className={cn('relative', className)}>
      <Sidebar className="sticky top-[var(--sticky-header-height)] p-0" variant="floating">
        <SidebarContent className="-mx-1 gap-y-10 px-1 pt-8 xl:pt-10">
          <SearchBar className="shrink-0" />

          <SidebarMenu className="gap-y-0 pb-10">
            {sidebar.map((node, index) => (
              <SidebarMenuItemComponent
                key={node.href?.toString() ?? `${node.type}-${node.label}-${index}`}
                item={node}
                depth={0}
                currentPath={pathname}
                fallbackActiveHref={fallbackActiveHref}
              />
            ))}
          </SidebarMenu>
        </SidebarContent>
        <div
          className="pointer-events-none absolute bottom-0 z-0 h-10 w-full bg-linear-to-b from-transparent to-background"
          aria-hidden
        />
      </Sidebar>
    </aside>
  );
}

export { DocsSidebar };
