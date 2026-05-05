---
title: Data fetching
excerpt: Practical patterns for loading data in a Next.js app (server components, route handlers, and caching).
---

## Overview

Most Prime UI pages are server-rendered. This gives you predictable performance and simpler data loading, but you still have the option to fetch on the client when interactivity requires it.

<Tabs labels={["Server-first", "Client-first"]}>
<Tab label="Server-first">
Fetch data close to where you render it. Prefer server components for public content pages (docs/blog/changelog) and cache aggressively when results are stable.
</Tab>
<Tab label="Client-first">
Use client-side fetching for highly interactive screens. Keep loading and error states explicit and avoid blocking the initial render on large data.
</Tab>
</Tabs>

## Pick the right tool

Use this section as a quick decision guide. The table below summarizes the default choice for common scenarios.

| Use case                   | Recommended approach                |
| -------------------------- | ----------------------------------- |
| Public content pages       | Server components + MDX compilation |
| API endpoints              | Route handlers                      |
| UI that updates frequently | Client-side fetching + caching      |

## Next steps

Start with JSON if you are integrating a typical REST API. Add GraphQL or XML only when your product needs those formats.

<Grid countColumns={3}>
  <Card
    title="JSON"
    description="Fetch JSON data safely and keep it typed."
    linkUrl="/docs/data-fetching/json"
    linkText="Read JSON guide"
    number={1}
  />
  <Card
    title="GraphQL"
    description="Use GraphQL clients and caching without overfetching."
    linkUrl="/docs/data-fetching/graphql"
    linkText="Read GraphQL guide"
    number={2}
  />
  <Card
    title="XML"
    description="Handle XML when you need to integrate with older systems."
    linkUrl="/docs/data-fetching/xml"
    linkText="Read XML guide"
    number={3}
  />
</Grid>
