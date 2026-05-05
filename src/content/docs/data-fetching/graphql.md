---
title: GraphQL Data Fetching
excerpt: Learn how to fetch data using GraphQL in your application.
---

## Overview

GraphQL provides a powerful and flexible approach to data fetching, allowing clients to request exactly the data they need. This guide covers how to integrate and use GraphQL in your application.

## Setting Up GraphQL

### 1. Install Dependencies [step]

Install required packages:

```bash
npm install @apollo/client graphql
```

### 2. Configure Client [step]

Set up Apollo Client:

```typescript
import { ApolloClient, InMemoryCache } from '@apollo/client';

const client = new ApolloClient({
  uri: 'https://api.example.com/graphql',
  cache: new InMemoryCache(),
});
```

## Basic Queries

GraphQL is most useful when you need to request exactly the data your UI needs. Start with a simple query and add caching only after the workflow is clear.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="Simple Query"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Fetch data with a basic query:
    ```typescript
    const GET_USER = gql`
      query GetUser($id: ID!) {
        user(id: $id) {
          id
          name
          email
        }
      }
    `
    
    function UserProfile({ id }) {
      const { loading, error, data } = useQuery(GET_USER, {
        variables: { id }
      })
    
      if (loading) return <p>Loading...</p>
      if (error) return <p>Error: {error.message}</p>
    
      return <div>{data.user.name}</div>
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="Mutations"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Modify data with mutations:
    ```typescript
    const UPDATE_USER = gql`
      mutation UpdateUser($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `
    
    function UpdateUserForm({ id }) {
      const [updateUser] = useMutation(UPDATE_USER)
    
      const handleSubmit = async (name) => {
        await updateUser({ variables: { id, name } })
      }
    }
    ```
  </AccordionItem>
</Accordion>

## Advanced Features

### Caching

<Admonition>
    Apollo Client provides powerful caching capabilities out of the box.
</Admonition>

```typescript
const client = new ApolloClient({
  uri: 'https://api.example.com/graphql',
  cache: new InMemoryCache({
    typePolicies: {
      Query: {
        fields: {
          users: {
            merge(existing = [], incoming) {
              return [...existing, ...incoming];
            },
          },
        },
      },
    },
  }),
});
```

### Error Handling

```typescript
function handleGraphQLErrors(error) {
  if (error.graphQLErrors) {
    error.graphQLErrors.forEach(({ message, locations, path }) => {
      console.error(`[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`);
    });
  }

  if (error.networkError) {
    console.error(`[Network error]: ${error.networkError}`);
  }
}
```

## Best Practices

Use these guidelines to keep GraphQL usage predictable and maintainable as your schema evolves.

- Use fragments for reusable pieces of queries
- Implement proper error handling
- Take advantage of Apollo Client's caching
- Use TypeScript for better type safety
- Consider implementing pagination for large datasets

## Next Steps

If you are deciding between REST and GraphQL, read the JSON guide first. If you are rendering GraphQL results on the server, review SSR patterns to avoid waterfalls.

<Grid>
  <Card
    title="JSON Data Fetching"
    description="Learn about traditional REST API data fetching."
    linkUrl="/docs/data-fetching/json"
    linkText="JSON Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Server-side Rendering"
    description="Learn how to use GraphQL with SSR."
    linkUrl="/docs/rendering/server-side-rendering"
    linkText="SSR Guide" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
</Grid>
