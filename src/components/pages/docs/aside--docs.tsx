'use client';

import { ITableOfContentsItem } from '@/types/common';
import { cn } from '@/lib/utils';
import { Link } from '@/components/ui/link';
import { Separator } from '@/components/ui/separator';
import { Icons } from '@/components/icons';

import BackToTop from '../back-to-top';
import TableOfContents from '../table-of-contents';

interface IAsideProps {
  className?: string;
  tableOfContents: ITableOfContentsItem[];
  editUrl: string;
  sticky?: boolean;
}

function Aside({ className, tableOfContents, editUrl, sticky = false }: IAsideProps) {
  return (
    <aside
      className={cn(
        'aside py-12 leading-none',
        !!sticky && 'sticky top-[var(--sticky-header-height)]',
        className,
      )}
    >
      {tableOfContents.length > 0 && (
        <>
          <TableOfContents title="On this page" items={tableOfContents} />
          <Separator className="my-3.5" orientation="horizontal" />
        </>
      )}
      <Link
        className="gap-x-2 leading-none font-normal tracking-tight [&_svg]:size-5"
        href={editUrl}
        size="sm"
        variant="muted"
        rel="noopener noreferrer"
        target="_blank"
      >
        <Icons.github size={20} />
        Suggest edits <span className="sr-only">on GitHub</span>
      </Link>
      <BackToTop className="mt-3.5 leading-none" />
    </aside>
  );
}

export default Aside;
