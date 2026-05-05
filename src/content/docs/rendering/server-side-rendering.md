---
title: Server-side Rendering
excerpt: Learn how to implement and optimize server-side rendering in your application.
---

## Overview

Server-side rendering (SSR) generates the full HTML for a page on the server instead of in the browser, providing better performance and SEO benefits.

## Implementation

### 1. Basic Setup [step]

Configure your application for SSR:

```typescript
// pages/_app.tsx
import type { AppProps } from 'next/app'

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />
}

export default MyApp
```

### 2. Data Fetching [step]

Implement server-side data fetching:

```typescript
// pages/posts/[id].tsx
export async function getServerSideProps({ params }) {
  const res = await fetch(`https://api.example.com/posts/${params.id}`);
  const post = await res.json();

  return {
    props: { post },
  };
}
```

## Features and Benefits

SSR is often the default for authenticated dashboards and pages that must always reflect the latest data.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Better SEO"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Search engines can easily crawl and index your content because the HTML is fully rendered on the server.
  </AccordionItem>
  <AccordionItem
    label="Faster First Paint"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Users see the content faster because the initial HTML is already complete when it reaches the browser.
  </AccordionItem>
  <AccordionItem
    label="Social Media Sharing"
    icon={<AccordionIcon src="/icons/prisma-logo.svg" />} 
    value="item-3"
  >
    Social media platforms can properly display preview cards because the metadata is included in the initial HTML.
  </AccordionItem>
</Accordion>

## Performance Optimization

SSR performance depends on fast data access and avoiding repeated expensive work. Start with caching and measure slow endpoints early.

<Admonition>
    Optimize your SSR implementation to maintain fast page loads and good server performance.
</Admonition>

### Caching

```typescript
// Implement caching for expensive operations
const cache = new Map();

export async function getServerSideProps({ params }) {
  const cacheKey = `post-${params.id}`;

  if (cache.has(cacheKey)) {
    return {
      props: { post: cache.get(cacheKey) },
    };
  }

  const post = await fetchPost(params.id);
  cache.set(cacheKey, post);

  return {
    props: { post },
  };
}
```

### Streaming SSR

```typescript
import { renderToNodeStream } from 'react-dom/server'

function streamingSSR(req, res) {
  const stream = renderToNodeStream(<App />)
  stream.pipe(res)
}
```

## Best Practices

Use these practices to keep SSR pages fast and predictable.

- Use appropriate caching strategies
- Optimize server-side data fetching
- Implement proper error handling
- Consider using streaming SSR for large pages
- Monitor server performance

## Common Pitfalls

SSR bugs usually come from using browser-only APIs or from inefficient fetching that creates a waterfall of requests.

:::note

Avoid these common SSR mistakes:

- Accessing browser APIs during SSR
- Not handling loading and error states
- Inefficient data fetching

:::

## Next Steps

If you do not need per-request freshness, consider ISR. If you need high interactivity, consider CSR.

<Grid>
  <Card
    title="Client-side Rendering"
    description="Learn about client-side rendering and when to use it."
    linkUrl="/docs/rendering/client-side-rendering"
    linkText="CSR Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Incremental Static Regeneration"
    description="Explore ISR for dynamic content with static benefits."
    linkUrl="/docs/rendering/incremental-static-regeneration"
    linkText="ISR Guide" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
