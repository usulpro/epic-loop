import { ReactNode } from 'react';

import { getSidebar } from '@/lib/docs/page-tree';
import { SidebarProvider } from '@/components/ui/sidebar';
import { DocsSidebar } from '@/components/pages/docs/docs-sidebar';
import MobileSidebar from '@/components/pages/docs/mobile-sidebar';

export default async function DocsLayout({ children }: { children: ReactNode }) {
  const sidebar = await getSidebar();
  return (
    <SidebarProvider>
      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 gap-x-8 px-5 md:px-8 lg:grid-cols-[14rem_auto] xl:gap-x-16">
        <DocsSidebar className="hidden lg:block" sidebar={sidebar} />
        <MobileSidebar className="lg:hidden" items={sidebar} title="Documentation" />

        <main className="relative">{children}</main>
      </div>
    </SidebarProvider>
  );
}
