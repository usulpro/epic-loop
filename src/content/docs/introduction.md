---
title: 'Introduction'
excerpt: 'A concise overview of the topic.'
---

## Welcome to PrimeUI

This guide shows how teams can move from idea to production inside a neutral AI SaaS workflow: define structure, generate layouts, validate content quality, and export implementation-ready artifacts.

Use it as a practical quickstart before diving into deep-reference docs.

<Blockquote
  quote="Welcome. This guide is a simple starting point for turning ideas into clear, production-ready pages."
  authors={{ name: "PrimeUI Team" }}
  role="Getting started"
/>

## Quick Start Commands

```bash tab="pnpm"
pnpm install
pnpm dev
```

```bash tab="npm"
npm install
npm run dev
```

## 1. Create a Workspace [step]

1. Create a new workspace and choose the baseline template that best matches your delivery model.
2. Add collaborators and assign roles for content, design, and engineering review.
3. Set initial context: target users, use-case scope, tone, and compliance constraints.

<Details title="Naming conventions that scale">
Use stable names that remain valid across roadmap changes.

- Prefer lowercase and dashes: `ai-assistant-docs`, `billing-portal`, `admin-workspace`.
- Use product-domain names over campaign names where possible.
- Keep temporary names for disposable experiments only.
</Details>

## 2. Shape the Sitemap [step]

Open **Sitemap** to define the page tree and route hierarchy. Each node should map to a clear user intent.

When adding a page, select its type first so generation presets and templates align with the page goal:

<Tabs labels={["Landing", "Pricing", "Docs", "Policies", "Status"]}>
<Tab label="Landing">
Use this for product positioning, feature narratives, and conversion-focused CTAs.
</Tab>
<Tab label="Pricing">
Use this for plan packaging, feature comparison, and procurement-oriented questions.
</Tab>
<Tab label="Docs">
Use this for technical implementation guides, API onboarding, and troubleshooting paths.
</Tab>
<Tab label="Policies">
Use this for legal and trust pages such as terms, privacy, DPA, and acceptable use policies.
</Tab>
<Tab label="Status">
Use this for changelog, incident communication, and reliability transparency updates.
</Tab>
</Tabs>

Reorder nodes with drag-and-drop. The final hierarchy drives breadcrumbs, navigation grouping, and export route generation.

<Admonition title="Structure First, Styling Later">
Lock structure before polishing messaging. Stable IA reduces churn across URLs, nav, and handoff artifacts.
</Admonition>

## 3. Work in Wireframes [step]

After selecting a sitemap node, open **Wireframes** and iterate on structure:

- Generate multiple variants to explore alternative information flows.
- Duplicate variants before major edits to preserve comparison points.
- Reorder and replace blocks to test readability, sequencing, and CTA clarity.
- Mark a variant as **Ready** when layout and content intent are approved.

<Admonition title="Collaborate Faster">
Use `Cmd/Ctrl + C` and `Cmd/Ctrl + V` for fast duplication. Use `Delete/Backspace` to remove focused blocks and keep review cycles short.
</Admonition>

## 4. Validate Before Handoff [step]

Run this quality pass before export:

1. Confirm heading hierarchy and section sequencing.
2. Validate CTA intent and next-step clarity on key pages.
3. Check tone consistency across landing, pricing, and docs.
4. Replace placeholders and verify example data realism.

## Recommended Project Layout

Use a simple, predictable folder structure for exported repositories:

<FileSystem
data={[
{
type: "folder",
name: "src",
expanded: true,
children: [
{
type: "folder",
name: "app",
expanded: true,
children: [
{ type: "file", name: "(website)/page.tsx" },
{ type: "file", name: "(website)/pricing/page.tsx" },
{ type: "file", name: "(website)/docs/[[...slug]]/page.tsx" },
],
},
{
type: "folder",
name: "components",
expanded: true,
children: [
{ type: "file", name: "pages/content.tsx", highlighted: true },
{ type: "file", name: "content/get-components.tsx", highlighted: true },
],
},
],
},
{ type: "file", name: "README.md" },
]}
/>

## Publishing Checklist

<Accordion defaultValue="review-1">
  <AccordionItem label="Next.js foundation" value="review-1" icon={<AccordionIcon src="/icons/nextjs-logo.svg" />} >
    Confirm the exported project starts as a production-ready Next.js app with the expected app router structure and baseline layouts.
  </AccordionItem>
  <AccordionItem label="Tailwind v4 styling" value="review-2" icon={<AccordionIcon src="/icons/tailwind-logo.svg" />} >
    Verify Tailwind CSS v4 is wired correctly and core design tokens render consistently across key pages before deeper customization.
  </AccordionItem>
  <AccordionItem label="Deployment options" value="review-3" icon={<AccordionIcon src="/icons/vercel-logo.svg" />} >
    Validate that you can publish the project on any hosting platform you prefer, including Vercel, with minimal deployment-specific changes.
  </AccordionItem>
</Accordion>

## Delivery Matrix

| Workflow phase      | Primary owner         | Success signal                                               |
| ------------------- | --------------------- | ------------------------------------------------------------ |
| Scope definition    | Product + GTM         | Audience, goals, and page intents are documented             |
| Structure planning  | Product Design        | Sitemap and route hierarchy are stable                       |
| Variant exploration | Design + Content      | At least two viable wireframe directions are reviewed        |
| Quality validation  | Content + Engineering | Terminology, CTA clarity, and examples pass review           |
| Handoff readiness   | Engineering           | Exported starter builds and key routes render without issues |

<Picture
  src="/images/cover-4.jpg"
  alt="PrimeUI workspace preview placeholder"
/>

## Output

When you approve a variant, PrimeUI exports a starter repository with production-ready sections and routes so your team can continue in its own delivery pipeline.

```tsx layout.tsx
import '@/styles/globals.css';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning added according to https://github.com/pacocoursey/next-themes?tab=readme-ov-file#with-app
    <html lang="en" suppressHydrationWarning>
      {children}
    </html>
  );
}
```

## Summary

1. **Create a workspace** with clear ownership and scope.
2. **Shape the sitemap** so every page has the correct type and placement.
3. **Iterate in wireframes** to evaluate structure and messaging.
4. **Validate before handoff** to reduce production rewrite.
5. **Export and integrate** into your engineering workflow.

## Explore Next

<Grid countColumns={3}>
  <Col>
    <Card
      title="Ready Next.js Project"
      description="PrimeUI exports a production-ready Next.js project so you can continue development immediately in a familiar stack."
      linkUrl="/docs/installation"
      linkText="Review project setup" icon={<CardIcon src="/icons/nextjs-logo.svg" />} />
  </Col>
  <Col>
    <Card
      title="Tailwind CSS v4"
      description="Generated components and pages are styled with Tailwind CSS v4, making customization and scaling straightforward."
      linkUrl="/docs/configuration"
      linkText="Explore styling docs" icon={<CardIcon src="/icons/tailwind-logo.svg" />} />
  </Col>
  <Col>
    <Card
      title="Deploy Anywhere"
      description="You can publish your project on any platform you choose, including Vercel, without changing the generated architecture."
      linkUrl="/docs/rendering/server-side-rendering"
      linkText="Read deployment guide" icon={<CardIcon src="/icons/vercel-logo.svg" />} />
  </Col>
</Grid>

Keep this flow in mind and continue with deep guides for sitemap operations, wireframe editing, and export customization.
