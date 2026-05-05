---
title: Configuration
excerpt: Where Prime UI settings live and how to keep navigation and content consistent.
---

## Website configuration

The main configuration file is `src/configs/website-config.ts`. It controls content locations and a few site-level defaults.

```ts website-config.ts
const config = {
  blog: { contentDir: 'src/content/blog' },
  docs: { basePath: '/docs', contentDir: 'src/content/docs' },
  changelog: { contentDir: 'src/content/changelog' },
  legal: { contentDir: 'src/content/legal' },
};
```

## Content directories

Keep content in one place and follow a predictable structure:

| Content type | Directory               | Notes                                        |
| ------------ | ----------------------- | -------------------------------------------- |
| Blog         | `src/content/blog`      | Includes taxonomy for authors and categories |
| Docs         | `src/content/docs`      | Uses `meta.json` to define sidebar structure |
| Changelog    | `src/content/changelog` | Similar to blog posts but different route    |
| Legal        | `src/content/legal`     | Simple markdown pages (TOS, privacy policy)  |

## Navigation structure (docs)

Docs navigation is driven by `meta.json` files. The root file is `src/content/docs/meta.json` and can define sections and ordering.

<Accordion defaultValue="item-1">
  <AccordionItem label="Root docs meta.json" icon={<AccordionIcon src="/icons/github-logo.svg" />}  value="item-1">
    The root `meta.json` can include separators and folders. Folders become collapsible groups in the sidebar.

    ```json
    {
      "title": "Documentation",
      "root": true,
      "pages": ["---Getting started---", "introduction", "installation"]
    }
    ```

  </AccordionItem>
  <AccordionItem label="Folder meta.json" icon={<AccordionIcon src="/icons/react-logo.svg" />}  value="item-2">
    A folder `meta.json` can order pages and control default open state.

    ```json
    {
      "title": "Data fetching",
      "pages": ["json", "graphql", "..."],
      "defaultOpen": true
    }
    ```

  </AccordionItem>
</Accordion>

:::note

Use stable slugs (filenames) for docs pages to keep sidebar links and any cross-references consistent.

:::

## Next steps

If you are configuring the site for the first time, the most practical follow-up is learning how to author content and then applying these settings to the data fetching and rendering pages.

<Grid countColumns={2}>
  <Card
    title="Content authoring"
    description="Where content files live and how to edit them safely."
    linkUrl="/docs/content"
    linkText="Explore content" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Data fetching"
    description="Patterns for loading data in a Next.js app."
    linkUrl="/docs/data-fetching"
    linkText="Read data fetching" icon={<CardIcon src="/icons/prisma-logo.svg" />} />
</Grid>
