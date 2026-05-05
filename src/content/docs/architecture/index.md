---
title: Architecture
excerpt: High-level structure of Prime UI and where to place new features and pages.
---

## Overview

Prime UI is a content-driven Next.js app. Most “static” pages are rendered from MDX, while interactive parts live in React components under `src/components` and routes under `src/app`.

## Settings pages

The `architecture/settings` section demonstrates how to document feature areas with sub-pages and security guides.

<Grid countColumns={2}>
  <Card
    title="Settings overview"
    description="How the settings area is organized and where to add new pages."
    linkUrl="/docs/architecture/settings"
    linkText="Open settings" icon={<CardIcon src="/icons/react-logo.svg" />} />
  <Card
    title="Profile settings"
    description="Example page documenting profile settings and form patterns."
    linkUrl="/docs/architecture/settings/profile"
    linkText="Open profile" icon={<CardIcon src="/icons/github-logo.svg" />} />
</Grid>
