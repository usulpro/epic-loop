---
title: Rendering
excerpt: Understand SSR, CSR, and ISR tradeoffs and when to use each approach.
---

## Overview

Rendering strategy impacts performance, SEO, and how quickly users see content. In practice, you often mix approaches: server rendering for public pages and client rendering for interactive areas.

:::note

Prefer a server-first approach for content-heavy routes (docs/blog/changelog). Add client-side fetching only where interactivity requires it.

:::

## Choose a strategy

Use these guides as building blocks. Most teams start with SSR for public pages and add CSR only where interaction requires it.

<Grid countColumns={3}>
  <Card
    title="SSR"
    description="Render on every request when data must always be fresh."
    linkUrl="/docs/rendering/server-side-rendering"
    linkText="Read SSR"
    number={1}
  />
  <Card
    title="CSR"
    description="Render in the browser for highly interactive experiences."
    linkUrl="/docs/rendering/client-side-rendering"
    linkText="Read CSR"
    number={2}
  />
  <Card
    title="ISR"
    description="Serve static pages and revalidate in the background."
    linkUrl="/docs/rendering/incremental-static-regeneration"
    linkText="Read ISR"
    number={3}
  />
</Grid>
