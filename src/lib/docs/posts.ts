import fs from 'fs';
import path from 'path';

import { cache } from 'react';
import config from '@/configs/website-config';
import { globSync } from 'glob';
import matter from 'gray-matter';

import { IDocMetadata, IDocPost, IDocPostMeta } from '@/types/docs';
import { compileMdx } from '@/lib/markdown';
import { removeMarkdownSymbols } from '@/lib/markdown-text';
import { getExcerpt } from '@/lib/utils';

export const DOCS_DIR_PATH = path.join(process.cwd(), config.docs.contentDir);
const MARKDOWN_EXTENSIONS = ['.md', '.mdx'] as const;

function toPosix(p: string): string {
  return p.replace(/\\/g, '/');
}

function normalizeSlug(raw: string): string {
  const normalized = raw.replace(/^\/+|\/+$/g, '');

  if (normalized === 'docs') {
    return '';
  }

  return normalized.startsWith('docs/') ? normalized.slice('docs/'.length) : normalized;
}

function canonicalizeSlug(slugNoExt: string): string {
  return slugNoExt.endsWith('/index') ? slugNoExt.slice(0, -'/index'.length) : slugNoExt;
}

function resolveDocFile(
  slugInput: string,
): { absolutePath: string; rel: string; canonicalSlug: string } | null {
  const clean = normalizeSlug(slugInput);

  for (const extension of MARKDOWN_EXTENSIONS) {
    const relA = `${clean}${extension}`;
    const absA = path.join(DOCS_DIR_PATH, relA);
    if (fs.existsSync(absA)) {
      const noExt = toPosix(relA.replace(/\.(md|mdx)$/i, ''));
      return {
        absolutePath: absA,
        rel: toPosix(relA),
        canonicalSlug: canonicalizeSlug(noExt),
      };
    }

    const relB = path.join(clean, `index${extension}`);
    const absB = path.join(DOCS_DIR_PATH, relB);
    if (fs.existsSync(absB)) {
      const noExt = toPosix(relB.replace(/\.(md|mdx)$/i, ''));
      return {
        absolutePath: absB,
        rel: toPosix(relB),
        canonicalSlug: canonicalizeSlug(noExt),
      };
    }
  }

  return null;
}

function getDocPostSlugsByPath(globPattern: string, ignore: string[] = []): string[] {
  const files = globSync(globPattern, {
    ignore: ['**/CONTRIBUTING.md', ...ignore],
  });

  return files.map((filePath: string) => {
    const relativePath = path.relative(DOCS_DIR_PATH, filePath);
    const withoutExt = toPosix(relativePath.replace(/\.(md|mdx)$/i, ''));
    return canonicalizeSlug(withoutExt);
  });
}

const getDocPostMetaBySlugCached = cache(async function getDocPostMetaBySlugCached(
  slug: string,
): Promise<IDocPostMeta | null> {
  try {
    const resolved = resolveDocFile(slug);
    if (!resolved) {
      console.error(`Post not found: ${slug}`);
      return null;
    }

    const { absolutePath, rel: relPath, canonicalSlug } = resolved;

    const source = fs.readFileSync(absolutePath, 'utf-8');
    const { data, content } = matter(source);
    const metadata = data as IDocMetadata | undefined;

    if (!metadata) {
      console.error(`Post not found (no frontmatter): ${slug}`);
      return null;
    }

    const plainText = removeMarkdownSymbols(content);
    const { title, excerpt, isDraft = false, updatedAt, seo } = metadata;

    return {
      slug: canonicalSlug,
      title,
      excerpt,
      isDraft,
      updatedAt,
      sourceUrl: new URL(
        `https://github.com/${config.githubOrg}/${config.githubRepo}/edit/main/${toPosix(
          config.docs.contentDir,
        )}/${relPath}`,
      ),
      seo: {
        title: seo?.title ?? title,
        description: seo?.description ?? excerpt ?? getExcerpt({ content: plainText, length: 160 }),
        socialImage:
          seo?.socialImage ?? (canonicalSlug ? `/docs/og/${canonicalSlug}` : '/opengraph-image'),
        noIndex: seo?.noIndex ?? isDraft,
      },
    };
  } catch (error) {
    console.error(`Error fetching doc post metadata by slug: ${slug}`, error);
    return null;
  }
});

async function getDocPostMetaBySlug(slug: string): Promise<IDocPostMeta | null> {
  return getDocPostMetaBySlugCached(slug);
}

const getDocPostBySlugCached = cache(async function getDocPostBySlugCached(
  slug: string,
): Promise<IDocPost | null> {
  try {
    const resolved = resolveDocFile(slug);
    const meta = await getDocPostMetaBySlug(slug);

    if (!resolved || !meta) {
      return null;
    }

    const { content, toc: tableOfContents } = await compileMdx('docs', resolved.rel);

    return {
      ...meta,
      content,
      tableOfContents,
    };
  } catch (error) {
    console.error(`Error fetching the post by slug: ${slug}`, error);
    return null;
  }
});

async function getDocPostBySlug(slug: string): Promise<IDocPost | null> {
  return getDocPostBySlugCached(slug);
}

const getAllDocPostSlugsCached = cache(async function getAllDocPostSlugsCached(): Promise<
  string[]
> {
  const slugs = getDocPostSlugsByPath(path.join(DOCS_DIR_PATH, '**/*.{md,mdx}'));
  const isProduction = process.env.NEXT_PUBLIC_VERCEL_ENV === 'production';

  if (!isProduction) {
    return slugs;
  }

  const posts = await Promise.all(slugs.map((slug) => getDocPostMetaBySlug(slug)));
  return posts
    .filter((postData): postData is IDocPostMeta => !!postData && !postData.isDraft)
    .map((postData) => postData.slug);
});

async function getAllDocPostSlugs(): Promise<string[]> {
  return getAllDocPostSlugsCached();
}

export { getAllDocPostSlugs, getDocPostBySlug, getDocPostMetaBySlug, getDocPostSlugsByPath };
