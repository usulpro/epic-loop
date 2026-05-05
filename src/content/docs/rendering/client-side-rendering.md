---
title: Client-side Rendering
excerpt: Learn how to implement and optimize client-side rendering in your application.
---

## Overview

Client-side rendering (CSR) executes the rendering process in the browser using JavaScript. This approach is ideal for highly interactive applications where real-time updates are important.

## Implementation

### 1. Basic Setup [step]

Create a client-side rendered component:

```typescript
import { useState, useEffect } from 'react'

function UserProfile({ userId }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchUser() {
      const response = await fetch(`/api/users/${userId}`)
      const data = await response.json()
      setUser(data)
      setLoading(false)
    }

    fetchUser()
  }, [userId])

  if (loading) return <div>Loading...</div>
  return <div>{user.name}</div>
}
```

### 2. Error Handling [step]

Implement error states:

```typescript
function UserProfile({ userId }) {
  const [error, setError] = useState(null)

  useEffect(() => {
    async function fetchUser() {
      try {
        const data = await fetchUserData(userId)
        setUser(data)
      } catch (err) {
        setError(err.message)
      }
    }
  }, [userId])

  if (error) return <div>Error: {error}</div>
}
```

## Features and Benefits

CSR is the best fit when the UI must react instantly to user input. The tradeoff is larger bundles and more work in the browser.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Rich Interactivity"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Perfect for applications requiring frequent updates and real-time features.
  </AccordionItem>
  <AccordionItem
    label="Reduced Server Load"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    The server only needs to send the initial JavaScript bundle and data.
  </AccordionItem>
  <AccordionItem
    label="Dynamic Updates"
    icon={<AccordionIcon src="/icons/prisma-logo.svg" />} 
    value="item-3"
  >
    Easy to implement real-time updates and dynamic content changes.
  </AccordionItem>
</Accordion>

## Performance Optimization

Client rendering can still be fast when you manage bundle size and avoid unnecessary re-renders.

<Admonition>
    Optimize your CSR implementation to ensure fast initial load and smooth user experience.
</Admonition>

### Code Splitting

```typescript
import dynamic from 'next/dynamic'

const DynamicComponent = dynamic(() => import('../components/Heavy'), {
  loading: () => <p>Loading...</p>,
  ssr: false
})
```

### State Management

```typescript
import { useCallback, useMemo } from 'react'

function OptimizedComponent({ data }) {
  const processedData = useMemo(() => {
    return expensiveOperation(data)
  }, [data])

  const handleClick = useCallback(() => {
    // Handle click event
  }, [])

  return <div onClick={handleClick}>{processedData}</div>
}
```

## Best Practices

Use these habits to keep CSR maintainable as the app grows.

- Implement proper loading states
- Handle errors gracefully
- Use code splitting for large applications
- Optimize bundle size
- Consider using a service worker for offline support

## Common Pitfalls

Most CSR issues show up as slow initial load, missing error states, or UI that cannot render without JavaScript.

<Admonition title="note">
    Watch out for these common CSR issues:
    - Large initial bundle size
    - Poor SEO without proper optimization
    - Not handling network errors
</Admonition>

## Next Steps

If you are choosing a rendering strategy for a content page, start with SSR or ISR. Use CSR when interactivity is the main value.

<Grid>
  <Card
    title="Server-side Rendering"
    description="Learn about server-side rendering for better SEO and initial load."
    linkUrl="/docs/rendering/server-side-rendering"
    linkText="SSR Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Incremental Static Regeneration"
    description="Explore ISR for static content that updates periodically."
    linkUrl="/docs/rendering/incremental-static-regeneration"
    linkText="ISR Guide" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
