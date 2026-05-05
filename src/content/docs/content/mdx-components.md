---
title: MDX components
excerpt: A small set of components to keep documentation consistent and easy to scan.
---

## Admonitions

Use admonitions for short callouts. Prefer them over long paragraphs of warnings.

:::note

Keep notes short: one idea, one recommendation.

:::

## Steps

Use steps when order matters.

<Steps>
  <Step title="Do the smallest viable thing">
    Keep each step focused on a single action and show the command or snippet.
  </Step>
  <Step title="Verify the result">
    Prefer a concrete “what to look for” instead of a generic “it should work”.
  </Step>
</Steps>

## Cards and grids

Use cards to link to related pages without writing large “Next steps” paragraphs.

<Grid countColumns={2}>
  <Card
    title="Installation"
    description="Set up the project locally and run the dev server."
    linkUrl="/docs/installation"
    linkText="Read installation" icon={<CardIcon src="/icons/github-logo.svg" />} />
  <Card
    title="Data fetching"
    description="Patterns for loading data in a Next.js app."
    linkUrl="/docs/data-fetching"
    linkText="Read data fetching" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
</Grid>

## Code tabs

Use code tabs when you show the same idea in different languages.

```ts tab="TypeScript"
type User = { id: string; name: string };
```

```js tab="JavaScript"
const user = { id: '1', name: 'Ada' };
```

## Tabs

Use tabs when you want to present multiple approaches without duplicating the whole page. Tabs work best for short, explanatory content.

<Tabs labels={["When to use", "When not to use"]}>
<Tab label="When to use">
Tabs are great for comparing alternatives, like server-first vs client-first approaches, or different configuration strategies.
</Tab>
<Tab label="When not to use">
Avoid tabs for long content. If each tab becomes a long article, split it into separate pages and link them with cards.
</Tab>
</Tabs>

## Accordions

Use accordions for optional details that would otherwise interrupt the main flow of a page.

<Accordion defaultValue="item-1">
  <AccordionItem label="Troubleshooting" icon={<AccordionIcon src="/icons/github-logo.svg" />}  value="item-1">
    If a step fails, copy the exact command output and verify you are using the recommended Node.js version.
  </AccordionItem>
  <AccordionItem label="Why it matters" icon={<AccordionIcon src="/icons/react-logo.svg" />}  value="item-2">
    Collapsing details keeps the page readable while still providing depth for readers who need it.
  </AccordionItem>
</Accordion>

## Tables

Use tables for compact comparisons. Always add a short paragraph before the table so readers know what the table is answering.

| Component       | Best for                    | Avoid when                             |
| --------------- | --------------------------- | -------------------------------------- |
| `Steps`         | Ordered workflows           | There is no required order             |
| `Grid` + `Card` | Navigation and “next steps” | You need long prose explanations       |
| `Admonition`    | Short callouts              | The “callout” becomes the main article |

## FileSystem

Use `FileSystem` to illustrate folder layout and highlight the file the reader should edit.

<FileSystem
data={[
{
type: "folder",
name: "src/content/docs",
children: [
{ name: "meta.json", highlighted: true },
{ type: "folder", name: "content", children: [{ name: "mdx-components.md" }] },
],
},
]}
/>

## Package manager blocks

If you want to show an install command once and render it for different package managers, use an `npm` code block.

```npm
npm install next react react-dom
```
