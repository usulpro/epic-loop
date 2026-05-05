import { ThumbsDown, ThumbsUp } from 'lucide-react';

import { IDocsTreeNode } from '@/types/docs';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Link } from '@/components/ui/link';
import { Separator } from '@/components/ui/separator';

interface FooterProps {
  className?: string;
  previousLink?: IDocsTreeNode;
  nextLink?: IDocsTreeNode;
}

function Footer({ className, previousLink, nextLink }: FooterProps) {
  return (
    <footer className={cn('footer', className)}>
      <div className="flex flex-col justify-between gap-y-6 md:flex-row">
        <div className="flex items-center">
          <p className="mr-6 text-sm leading-none font-medium tracking-tight text-muted-foreground">
            Was this page helpful?
          </p>
          <Button
            className="gap-x-1.5 pr-3.5 pl-3 text-[0.8125rem] [&_svg]:size-3.5"
            variant="outline"
            size="sm"
          >
            <ThumbsUp size={14} />
            Yes
          </Button>
          <Button
            className="ml-2.5 gap-x-1.5 pr-3.5 pl-3 text-[0.8125rem] [&_svg]:size-3.5"
            variant="outline"
            size="sm"
          >
            <ThumbsDown size={14} />
            No
          </Button>
        </div>
      </div>
      {(previousLink || nextLink) && (
        <>
          <Separator className="my-7" />
          <div className="flex justify-between">
            {previousLink && previousLink.href && (
              <p className="flex flex-col gap-y-3">
                <span className="text-[0.8125rem] leading-none font-medium tracking-tight text-muted-foreground">
                  Previous
                </span>
                <Link
                  className="text-sm leading-none"
                  variant="foreground"
                  href={previousLink.href}
                >
                  {previousLink.label}
                </Link>
              </p>
            )}
            {nextLink && nextLink.href && (
              <p className="ml-auto flex flex-col gap-y-3 text-right">
                <span className="text-[0.8125rem] leading-none font-medium tracking-tight text-muted-foreground">
                  Next
                </span>
                <Link className="text-sm leading-none" variant="foreground" href={nextLink.href}>
                  {nextLink.label}
                </Link>
              </p>
            )}
          </div>
        </>
      )}
    </footer>
  );
}

export default Footer;
