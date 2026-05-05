'use client';

import { ReactNode } from 'react';

import { CodeLanguageProvider } from './code-language-context';

import { CookieBannerProvider } from './cookie-banner-context';
interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <>
      <CookieBannerProvider>
        <CodeLanguageProvider>{children}</CodeLanguageProvider>
      </CookieBannerProvider>
    </>
  );
}
