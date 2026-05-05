---
title: Installation
excerpt: Install dependencies, run the project locally, and understand the basic folder layout.
---

## Prerequisites

Prime UI is a modern Next.js app. Recommended local setup:

| Requirement     | Recommendation |
| --------------- | -------------- |
| Node.js         | 22+            |
| Package manager | pnpm           |

:::note

The workspace uses `pnpm` and a monorepo layout. If you use another package manager, keep lockfiles consistent to avoid tooling warnings.

:::

## Install and run

These commands cover the most common workflow: install dependencies, start the UI app, and verify a production build.

<Steps>
  <Step title="Install dependencies">
    ```bash
    pnpm install
    ```
  </Step>
  <Step title="Start the dev server">
    ```bash
    pnpm dev
    ```
  </Step>
  <Step title="Build project">
    ```bash
    pnpm build
    ```
  </Step>
</Steps>

## Project layout

Content lives inside `src/content`.

<FileSystem
data={[
{
type: "folder",
name: "src",
children: [
{ type: "folder", name: "app" },
{ type: "folder", name: "components" },
{ type: "folder", name: "configs", children: [{ name: "website-config.ts", highlighted: true }] },
{
type: "folder",
name: "content",
children: [
{ type: "folder", name: "blog" },
{ type: "folder", name: "docs" },
{ type: "folder", name: "changelog" },
{ type: "folder", name: "legal" },
],
},
],
},
]}
/>

## Next steps

Once the app is running locally, configure content and navigation so the site structure matches your project.

<Grid countColumns={2}>
  <Card
    title="Configuration"
    description="Customize navigation and content locations."
    linkUrl="/docs/configuration"
    linkText="Read configuration" icon={<CardIcon src="/icons/github-logo.svg" />} />
  <Card
    title="Authoring content"
    description="Learn how to edit docs/blog/changelog/legal pages."
    linkUrl="/docs/content"
    linkText="Explore content" icon={<CardIcon src="/icons/react-logo.svg" />} />
</Grid>
