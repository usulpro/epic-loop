---
title: Incremental Static Regeneration
excerpt: Learn how to implement Incremental Static Regeneration (ISR) for optimal performance and freshness.
---

## Overview

Incremental Static Regeneration (ISR) allows you to create or update static pages after you've built your site. This combines the benefits of static generation with the ability to handle dynamic content.

## Implementation

### 1. Basic ISR Setup [step]

Configure a page with ISR:

```typescript
// pages/posts/[id].tsx
export async function getStaticProps({ params }) {
  const post = await fetchPost(params.id);

  return {
    props: { post },
    revalidate: 60, // Regenerate page every 60 seconds
  };
}

export async function getStaticPaths() {
  return {
    paths: [],
    fallback: 'blocking',
  };
}
```

### 1. On-demand Revalidation [step]

Implement on-demand revalidation:

```typescript
// pages/api/revalidate.ts
export default async function handler(req, res) {
  try {
    await res.revalidate('/path-to-revalidate');
    return res.json({ revalidated: true });
  } catch (err) {
    return res.status(500).send('Error revalidating');
  }
}
```

## Features and Benefits

ISR is a practical middle ground: you get the speed of static pages and the ability to keep content fresh over time.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Static Performance"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Pages are served statically from the edge, providing optimal performance.
  </AccordionItem>
  <AccordionItem
    label="Dynamic Content"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Content updates automatically in the background without rebuilding the entire site.
  </AccordionItem>
  <AccordionItem
    label="Fallback Pages"
    icon={<AccordionIcon src="/icons/prisma-logo.svg" />} 
    value="item-3"
  >
    Handle new paths without needing to rebuild the application.
  </AccordionItem>
</Accordion>

## Advanced Configuration

Once ISR works, tuning is mostly about cache behavior and choosing the right revalidation strategy.

<Admonition>
    Configure ISR based on your content update patterns and traffic requirements.
</Admonition>

### Custom Cache Control

```typescript
export async function getStaticProps() {
  return {
    props: {
      data: await fetchData(),
    },
    revalidate: 60,
    headers: {
      'Cache-Control': 's-maxage=1, stale-while-revalidate=59',
    },
  };
}
```

### Conditional Revalidation

```typescript
export async function getStaticProps({ params }) {
  const data = await fetchData(params.id);

  return {
    props: { data },
    revalidate: data.type === 'frequent' ? 60 : 3600,
  };
}
```

## Best Practices

These defaults work well for most content-driven pages.

- Choose appropriate revalidation intervals
- Implement fallback pages for better UX
- Use on-demand revalidation when needed
- Monitor revalidation patterns
- Consider cache strategies

## Common Patterns

### Hybrid Approach

```typescript
export async function getStaticProps({ params }) {
  const data = await fetchData(params.id);

  if (data.type === 'dynamic') {
    return {
      props: { data },
      revalidate: 1, // Frequent updates
    };
  }

  return {
    props: { data },
    revalidate: false, // Truly static
  };
}
```

## Next Steps

Use ISR when the page can be slightly stale. If you need always-fresh data, prefer SSR.

<Grid>
  <Card
    title="Server-side Rendering"
    description="Learn about traditional server-side rendering."
    linkUrl="/docs/rendering/server-side-rendering"
    linkText="SSR Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Client-side Rendering"
    description="Explore client-side rendering for interactive applications."
    linkUrl="/docs/rendering/client-side-rendering"
    linkText="CSR Guide" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
