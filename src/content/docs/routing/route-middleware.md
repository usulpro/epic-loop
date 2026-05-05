---
title: Route Middleware
excerpt: Learn how to implement and use middleware in your routes.
---

## Overview

Middleware functions are pieces of code that run before your route handlers, allowing you to modify requests or responses, perform authentication, logging, or other operations.

## Creating Middleware

### 1. Define Middleware Function [step]

Create a middleware function:

```typescript
export function withLogging(handler) {
  return async function (request, ...args) {
    console.log(`${request.method} ${request.url}`);
    return handler(request, ...args);
  };
}
```

### 2. Apply Middleware [step]

Use the middleware in your route:

```typescript
export const GET = withLogging(async (request) => {
  return Response.json({ message: 'Hello' });
});
```

## Common Use Cases

Middleware is most useful when you want the same behavior applied across many routes without duplicating code.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Authentication"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-1"
  >
    Verify user authentication:
    ```typescript
    export function withAuth(handler) {
      return async function (request, ...args) {
        const token = request.headers.get('authorization')
        if (!token) {
          return Response.json(
            { error: 'Unauthorized' },
            { status: 401 }
          )
        }
        return handler(request, ...args)
      }
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="Error Handling"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-2"
  >
    Global error handling:
    ```typescript
    export function withErrorHandling(handler) {
      return async function (request, ...args) {
        try {
          return await handler(request, ...args)
        } catch (error) {
          return Response.json(
            { error: error.message },
            { status: 500 }
          )
        }
      }
    }
    ```
  </AccordionItem>
</Accordion>

## Best Practices

Keep middleware small, composable, and focused on a single responsibility.

<Admonition>
    Keep middleware functions focused on a single responsibility and compose them together when needed.
</Admonition>

## Composing Middleware

Composition makes order explicit. Apply logging and error handling around auth so failures are visible and safe.

```typescript
export const GET = withErrorHandling(
  withAuth(
    withLogging(async (request) => {
      // Your route handler code
    }),
  ),
);
```

## Next Steps

After routing is in place, review data fetching patterns so handlers and pages stay consistent.

<Grid>
  <Card
    title="Data Fetching"
    description="Learn how to fetch and manage data in your application."
    linkUrl="/docs/data-fetching"
    linkText="Explore Data Fetching" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
  <Card
    title="Route Handlers"
    description="Learn how to create GET/POST endpoints for your application."
    linkUrl="/docs/routing/route-handlers"
    linkText="Explore handlers" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
