---
title: JSON Data Fetching
excerpt: Learn how to fetch and work with JSON data in your application.
---

## Overview

JSON is the most common data format used in modern web applications. This guide covers different approaches to fetching and handling JSON data effectively.

## Fetching JSON Data

### 1. Basic Fetch [step]

Use the fetch API with JSON:

```typescript
async function fetchJsonData() {
  const response = await fetch('https://api.example.com/data');
  return await response.json();
}
```

### 2. Error Handling [step]

Implement proper error handling:

```typescript
async function fetchWithErrorHandling() {
  try {
    const response = await fetch('https://api.example.com/data');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching data:', error);
    throw error;
  }
}
```

## Advanced Techniques

Once the basics are working, use these techniques to make data fetching faster and safer in production.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Caching"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Implement data caching:
    ```typescript
    const cache = new Map()
    
    async function fetchWithCache(url, options = {}) {
      if (cache.has(url)) {
        return cache.get(url)
      }
      
      const data = await fetch(url).then(r => r.json())
      cache.set(url, data)
      return data
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="Type Safety"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Use TypeScript interfaces for type safety:
    ```typescript
    interface User {
      id: number
      name: string
      email: string
    }
    
    async function fetchUser(id: number): Promise<User> {
      const response = await fetch(`/api/users/${id}`)
      return response.json()
    }
    ```
  </AccordionItem>
</Accordion>

## Best Practices

These practices help keep JSON integrations predictable as your API surface grows.

<Admonition>
    Always validate and sanitize JSON data before using it in your application.
</Admonition>

- Use appropriate error handling
- Implement request timeouts
- Consider data caching strategies
- Validate JSON schema when necessary
- Use TypeScript for type safety

## Working with JSON

This section shows a few small examples you can copy when debugging data locally.

```typescript
// Parse JSON string
const jsonString = '{"name": "John", "age": 30}';
const data = JSON.parse(jsonString);

// Convert to JSON string
const user = { name: 'John', age: 30 };
const json = JSON.stringify(user, null, 2);
```

## Next Steps

If your API becomes more complex, consider GraphQL. If you need to integrate with older systems, XML patterns can still be useful.

<Grid>
  <Card
    title="GraphQL"
    description="Learn about GraphQL data fetching for more complex data requirements."
    linkUrl="/docs/data-fetching/graphql"
    linkText="GraphQL Guide" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
  <Card
    title="XML Data Fetching"
    description="Explore XML data fetching capabilities."
    linkUrl="/docs/data-fetching/xml"
    linkText="XML Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
</Grid>
