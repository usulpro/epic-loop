---
title: XML Data Fetching
excerpt: Learn how to fetch and parse XML data in your application.
---

## Overview

XML data fetching allows you to work with XML-based APIs and documents in your application. This guide covers the essential techniques for fetching and parsing XML data.

## Basic XML Fetching

### 1. Fetch XML Data [step]

Use the fetch API to retrieve XML data:

```typescript
async function fetchXMLData() {
  const response = await fetch('https://api.example.com/data.xml');
  const xmlText = await response.text();
  return new DOMParser().parseFromString(xmlText, 'text/xml');
}
```

### 2. Parse XML [step]

Extract data from the XML document:

```typescript
function parseXMLData(xmlDoc) {
  const items = xmlDoc.getElementsByTagName('item');
  return Array.from(items).map((item) => ({
    title: item.getAttribute('title'),
    value: item.textContent,
  }));
}
```

## Working with XML

XML integrations can be straightforward if you keep parsing and validation explicit. Use the patterns below as a starting point.

<Accordion defaultValue="item-1">
  <AccordionItem
    label="XML to JSON"
    icon={<AccordionIcon src="/icons/react-logo.svg" />} 
    value="item-1"
  >
    Convert XML to JSON format:
    ```typescript
    function xmlToJson(xml) {
      const data = {}
      for (const child of xml.children) {
        data[child.tagName] = child.textContent
      }
      return data
    }
    ```
  </AccordionItem>
  <AccordionItem
    label="XML Validation"
    icon={<AccordionIcon src="/icons/github-logo.svg" />} 
    value="item-2"
  >
    Validate XML against a schema:
    ```typescript
    function validateXML(xml, schema) {
      // XML validation logic
      return isValid
    }
    ```
  </AccordionItem>
</Accordion>

## Error Handling

XML is more likely to fail on malformed input, so make error paths visible and easy to debug.

<Admonition title="note">
    Always implement proper error handling when working with XML data to handle malformed XML or network issues.
</Admonition>

```typescript
try {
  const xmlData = await fetchXMLData();
  const parsedData = parseXMLData(xmlData);
} catch (error) {
  console.error('Error processing XML:', error);
}
```

## Best Practices

These practices keep XML code maintainable and reduce surprises in production.

- Use appropriate XML parsing libraries for complex XML structures
- Implement proper error handling for XML parsing
- Cache parsed XML data when appropriate
- Validate XML data against schemas when necessary

## Next Steps

Move to JSON or GraphQL whenever possible, but keep XML patterns available when you need to integrate with legacy systems.

<Grid>
  <Card
    title="JSON Data Fetching"
    description="Learn how to work with JSON data in your application."
    linkUrl="/docs/data-fetching/json"
    linkText="JSON Guide" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="GraphQL"
    description="Explore GraphQL data fetching capabilities."
    linkUrl="/docs/data-fetching/graphql"
    linkText="GraphQL Guide" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
</Grid>
