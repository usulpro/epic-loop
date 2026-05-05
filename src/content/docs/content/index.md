---
title: Content authoring
excerpt: Where content lives in the repo and how to add new pages safely.
---

## Where content lives

Prime UI keeps site content inside `src/content` so editing content does not require touching the application code.

<FileSystem
data={[
{
type: "folder",
name: "src/content",
children: [
{ type: "folder", name: "blog", children: [{ name: "taxonomy", highlighted: true }] },
{ type: "folder", name: "docs", children: [{ name: "meta.json", highlighted: true }] },
{ type: "folder", name: "changelog" },
{ type: "folder", name: "legal" },
],
},
]}
/>

## Add a docs page

Creating pages is straightforward, but the key is keeping a consistent structure across the whole documentation set.

<Steps>
  <Step title="Create a new file">
    Add a Markdown file under `src/content/docs`. For nested sections, create a folder and an `index.md` (optional).
  </Step>
  <Step title="Add frontmatter">
    ```yaml
    ---
    title: Your page title
    excerpt: One sentence summary shown in previews.
    ---
    ```
  </Step>
  <Step title="Update navigation (optional)">
    If you want the page to appear in the sidebar in a specific place, update the relevant `meta.json`.
  </Step>
</Steps>

## What to read next

Use these pages as your “toolbox” when you author new content or refactor existing docs.

<Grid countColumns={2}>
  <Card
    title="MDX components"
    description="Use tabs, steps, cards, and admonitions consistently."
    linkUrl="/docs/content/mdx-components"
    linkText="See components" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Configuration"
    description="Learn how `website-config.ts` and docs `meta.json` files work together."
    linkUrl="/docs/configuration"
    linkText="Read configuration" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
