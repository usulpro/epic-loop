---
title: Route Handlers
excerpt: Learn how to create and manage route handlers in your application.
---

## Overview

Route handlers are functions that process incoming requests and return responses. They are the core building blocks of your application's API.

## Basic Route Handler

Start with a minimal handler and return a clear response. Keep handlers small and delegate business logic to utilities when needed.

```typescript
export async function GET(request: Request) {
  return new Response('Hello, World!');
}
```

## Handler Types

Most applications need at least GET and POST. Add other methods only when the workflow requires them.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="GET Handler"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Handles GET requests to retrieve data:
    ```typescript
    export async function GET(request: Request) {
      const data = await fetchData()
      return Response.json(data)
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="POST Handler"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Handles POST requests to create new resources:
    ```typescript
    export async function POST(request: Request) {
      const body = await request.json()
      const newResource = await createResource(body)
      return Response.json(newResource, { status: 201 })
    }
    ```
  </AccordionItem>
</Accordion>

## Request Processing

### 1. Parse Request [step]

Extract data from the request:

```typescript
const body = await request.json();
const searchParams = request.nextUrl.searchParams;
```

### 1. Process Data [step]

Perform necessary operations with the data.

### 3. Return Response [step]

Send back appropriate response:

```typescript
return Response.json({ success: true });
```

## Error Handling

Always assume inputs can be malformed and dependencies can fail. Return consistent JSON errors and keep status codes meaningful.

<Admonition title="note">
    Always implement proper error handling in your route handlers to ensure robust API endpoints.
</Admonition>

```typescript
try {
  // Process request
} catch (error) {
  return Response.json({ error: error.message }, { status: 500 });
}
```

## Next Steps

Once your route handlers are stable, add middleware for cross-cutting concerns like authentication and logging.

<Grid>
  <Card
    title="Route Middleware"
    description="Learn how to implement middleware for your routes."
    linkUrl="/docs/routing/route-middleware"
    linkText="Explore Middleware" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Data Fetching"
    description="Learn how to fetch data in your routes."
    linkUrl="/docs/data-fetching"
    linkText="Learn Data Fetching" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
</Grid>
