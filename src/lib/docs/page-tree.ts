import fs from 'fs';
import path from 'path';

import { cache } from 'react';
import config from '@/configs/website-config';
import matter from 'gray-matter';

import { IBreadcrumbItem } from '@/types/common';
import { IDocMetadata, IDocsTreeNode, IFlatSidebarItem, IPreviousAndNextLinks } from '@/types/docs';

import { DOCS_DIR_PATH } from './posts';

function normalizePath(p: string): string {
  if (!p) return '';
  return path.posix.normalize(p.replace(/\\/g, '/')).replace(/^\/+/g, '');
}

type FileEntry =
  | { path: string; data: IDocMetadata; format: 'page' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { path: string; data: any; format: 'meta' };

interface ContentStorage {
  readDir: (dir: string) => string[] | undefined;
  read: (file: string) => FileEntry | undefined;
}

const DOC_MARKDOWN_PATTERN = /\.(md|mdx)$/i;
const DOC_INDEX_PATTERN = /^index\.(md|mdx)$/i;

function isIndexDocName(name: string): boolean {
  return DOC_INDEX_PATTERN.test(path.posix.basename(name));
}

async function loadFiles(rootDir: string): Promise<ContentStorage> {
  const files = new Map<string, FileEntry>();

  async function loadRecursive(dir: string): Promise<void> {
    const abs = path.join(rootDir, dir);
    const entries = fs.readdirSync(abs, { withFileTypes: true });

    await Promise.all(
      entries.map(async (entry) => {
        const rel = path.posix.join(dir, entry.name);
        const full = path.join(rootDir, rel);

        if (entry.isDirectory()) {
          await loadRecursive(rel);
        } else if (DOC_MARKDOWN_PATTERN.test(entry.name)) {
          const source = fs.readFileSync(full, 'utf-8');
          const data = matter(source).data as IDocMetadata | undefined;

          if (!data) {
            return;
          }

          files.set(normalizePath(rel), {
            path: normalizePath(rel),
            data,
            format: 'page',
          });
        } else if (entry.name === 'meta.json') {
          const content = fs.readFileSync(full, 'utf-8');
          files.set(normalizePath(rel), {
            path: normalizePath(rel),
            data: JSON.parse(content),
            format: 'meta',
          });
        }
      }),
    );
  }

  await loadRecursive('');

  return {
    readDir: (dir: string) => {
      const dirFiles: string[] = [];
      const subDirs = new Set<string>();

      const normalizedDir = normalizePath(dir);
      const prefix = normalizedDir ? `${normalizedDir}/` : '';

      let foundAny = false;

      for (const key of files.keys()) {
        if (!key.startsWith(prefix)) continue;
        const relative = key.slice(prefix.length);
        if (!relative) continue;

        foundAny = true;

        if (relative.includes('/')) {
          const subDir = relative.split('/')[0];
          subDirs.add(subDir);
        } else {
          dirFiles.push(relative);
        }
      }

      if (!foundAny) return undefined;

      return [...dirFiles, ...Array.from(subDirs).map((d) => `${d}/`)];
    },
    read: (file: string) => files.get(normalizePath(file)),
  };
}

const linkRegex = /^(?:\[([^\]]+)])?\[([^\]]+)]\(([^)]+)\)$/;
const separatorFullRegex = /^---(?:\[([^\]]+)])?(.+?)---$/;
const separatorSimpleRegex = /^---$/;

const rest = '...';
const restReversed = 'z...a';
const extractPrefix = '...';
const excludePrefix = '!';

async function buildDocsTree(rootDir: string): Promise<IDocsTreeNode> {
  const storage = await loadFiles(rootDir);
  const rootNode = await buildFolderNode('', true, { storage });

  return (
    rootNode ?? {
      type: 'folder',
      label: '',
      children: [],
    }
  );
}

async function buildFolderNode(
  folderPath: string,
  isGlobalRoot: boolean,
  ctx: { storage: ContentStorage },
): Promise<IDocsTreeNode | undefined> {
  const { storage } = ctx;
  const items = storage.readDir(folderPath);
  if (!items) return;

  const metaPath = path.posix.join(folderPath, 'meta.json');
  const metaRaw = storage.read(metaPath);
  const meta = metaRaw && metaRaw.format === 'meta' ? metaRaw : undefined;

  const isRoot = (meta?.data?.root as boolean | undefined) ?? isGlobalRoot;
  let children: IDocsTreeNode[];

  if (!meta?.data?.pages) {
    children = await buildAll(items, folderPath, ctx, (name) => isRoot || !isIndexDocName(name));
  } else {
    const restItems = new Set<string>(items);
    const resolved = await Promise.all(
      (meta.data.pages as string[]).map((item, i) =>
        resolveFolderItem(folderPath, item, ctx, i, restItems),
      ),
    );

    const processed: Array<IDocsTreeNode | typeof rest | typeof restReversed> = [];

    for (const result of resolved) {
      if (typeof result === 'string') {
        processed.push(result);
        continue;
      }

      processed.push(...result);
    }

    for (let i = 0; i < processed.length; i++) {
      const item = processed[i];
      if (item === rest || item === restReversed) {
        const itemsLeft = await buildAll(
          Array.from(restItems),
          folderPath,
          ctx,
          (name) => !isIndexDocName(name) || isRoot,
          item === restReversed,
        );
        processed.splice(i, 1, ...itemsLeft);
        break;
      }
    }

    children = processed.filter((item): item is IDocsTreeNode => typeof item !== 'string');
  }

  const indexPath = path.posix.join(folderPath, 'index.md');
  const index = await buildFileNode(indexPath, ctx);

  const label = meta?.data?.title ?? index?.label ?? pathToLabel(path.posix.basename(folderPath));

  return {
    type: 'folder',
    label,
    children,
    index,
    root: meta?.data?.root,
    defaultOpen: meta?.data?.defaultOpen,
    description: meta?.data?.description,
    icon: meta?.data?.icon,
  };
}

async function buildAll(
  names: string[],
  baseDir: string,
  ctx: { storage: ContentStorage },
  filter?: (name: string) => boolean,
  reversed = false,
): Promise<IDocsTreeNode[]> {
  const output: IDocsTreeNode[] = [];
  const list = filter ? names.filter(filter) : [...names];
  const sorted = list.sort((a, b) => a.localeCompare(b) * (reversed ? -1 : 1));

  for (const name of sorted) {
    if (DOC_MARKDOWN_PATTERN.test(name)) {
      const full = path.posix.join(baseDir, name);
      const node = await buildFileNode(full, ctx);
      if (node) output.push(node);
    } else if (name.endsWith('/')) {
      const dirPath = path.posix.join(baseDir, name.slice(0, -1));
      const dirNode = await buildFolderNode(dirPath, false, ctx);
      if (dirNode) output.push(dirNode);
    } else if (!name.endsWith('meta.json')) {
      const dirNode = await buildFolderNode(path.posix.join(baseDir, name), false, ctx);
      if (dirNode) output.push(dirNode);
    }
  }

  return output;
}

async function resolveFolderItem(
  folderPath: string,
  item: string,
  ctx: { storage: ContentStorage },
  _idx: number,
  restNodeNames: Set<string>,
): Promise<IDocsTreeNode[] | typeof rest | typeof restReversed> {
  if (item === rest || item === restReversed) return item;

  if (separatorSimpleRegex.test(item)) {
    return [
      {
        type: 'separator',
        label: '',
      },
    ];
  }

  const mSep = separatorFullRegex.exec(item);
  if (mSep) {
    const icon = mSep[1];
    const label = (mSep[2] || '').trim();
    return [
      {
        type: 'separator',
        label,
        icon,
      },
    ];
  }

  const mLink = linkRegex.exec(item);
  if (mLink) {
    const icon = mLink[1];
    const label = mLink[2];
    const href = mLink[3];
    return [
      {
        type: 'page',
        label,
        href,
        icon,
      },
    ];
  }

  const isExcept = item.startsWith(excludePrefix);
  const isExtract = !isExcept && item.startsWith(extractPrefix);
  const rawName = isExcept
    ? item.slice(excludePrefix.length)
    : isExtract
      ? item.slice(extractPrefix.length)
      : item;

  const localCandidates = new Set<string>([
    rawName,
    ...['.md', '.mdx'].map((extension) => `${rawName}${extension}`),
    `${rawName}/`,
    rawName.replace(/\/$/, ''),
  ]);
  for (const cand of localCandidates) restNodeNames.delete(cand);

  if (isExcept) return [];

  const fullBase = path.posix.join(folderPath, rawName);

  const dirNode = await buildFolderNode(fullBase, false, ctx);
  if (dirNode) {
    return isExtract ? dirNode.children || [] : [dirNode];
  }

  const fileNode =
    (await buildFileNode(
      rawName.endsWith('.md') || rawName.endsWith('.mdx') ? fullBase : `${fullBase}.md`,
      ctx,
    )) ?? (await buildFileNode(`${fullBase}.mdx`, ctx));

  return fileNode ? [fileNode] : [];
}

async function buildFileNode(
  p: string,
  ctx: { storage: ContentStorage },
): Promise<IDocsTreeNode | undefined> {
  const pageRaw = ctx.storage.read(p);
  if (!pageRaw || pageRaw.format !== 'page') return;

  const page = pageRaw as Extract<FileEntry, { format: 'page' }>;

  let urlPath = p.replace(/\.(md|mdx)$/i, '').replace(/^\/+/g, '');
  if (isIndexDocName(p)) {
    urlPath = path.posix.dirname(p).replace(/^\/+/g, '');
  }
  const href = urlPath ? `${config.docs.basePath}/${urlPath}` : config.docs.basePath;

  return {
    type: 'page',
    label: page.data.title || pathToLabel(path.posix.basename(p).replace(/\.(md|mdx)$/i, '')),
    href,
    icon: page.data.icon,
  };
}

function pathToLabel(name: string): string {
  return name
    .replace(/\.(md|mdx)$/i, '')
    .replace(/[-_]+/g, ' ')
    .replace(/^\s*([a-z])/i, (m) => m.toUpperCase());
}

const getTree = cache(async function getTree(): Promise<IDocsTreeNode> {
  return buildDocsTree(DOCS_DIR_PATH);
});

const getSidebarCached = cache(async function getSidebarCached(): Promise<IDocsTreeNode[]> {
  const tree = await getTree();

  function mapNodeToSidebar(node: IDocsTreeNode): IDocsTreeNode {
    return {
      ...node,
      href: node.type === 'folder' ? node.index?.href : node.href,
      children: node.type === 'folder' ? node.children?.map(mapNodeToSidebar) || [] : undefined,
    };
  }

  return tree.children?.map(mapNodeToSidebar) || [];
});

async function getSidebar(): Promise<IDocsTreeNode[]> {
  return getSidebarCached();
}

function flattenTree(nodes: IDocsTreeNode[], currentPath: number[] = []): IFlatSidebarItem[] {
  let result: IFlatSidebarItem[] = [];

  nodes.forEach((node, index) => {
    const nodePath = [...currentPath, index];
    const flatNode: IFlatSidebarItem = {
      ...node,
      path: nodePath,
    };
    result.push(flatNode);

    if (node.children) {
      result = result.concat(flattenTree(node.children, nodePath));
    }
  });

  return result;
}

function getFlatSidebar(sidebar: IDocsTreeNode[]): IFlatSidebarItem[] {
  return flattenTree(sidebar);
}

function normalizeSlug(s: string): string {
  return s.replace(/\/$/, '');
}

function getDocPreviousAndNextLinks(
  slug: string,
  flatSidebar: IFlatSidebarItem[],
): IPreviousAndNextLinks {
  const norm = (s?: string) => (s ? normalizeSlug(String(s)) : undefined);
  const items = flatSidebar.filter((item) => !!item.href);
  const currentItemIndex = items.findIndex((item) => norm(item.href?.toString()) === norm(slug));

  if (currentItemIndex === -1) {
    return { previousLink: undefined, nextLink: undefined };
  }

  return {
    previousLink: items[currentItemIndex - 1],
    nextLink: items[currentItemIndex + 1],
  };
}

async function getBreadcrumbs(
  currentSlug: string,
  flatSidebar: IFlatSidebarItem[],
  sidebar: IDocsTreeNode[] | null = null,
): Promise<IBreadcrumbItem[]> {
  const slug = normalizeSlug(currentSlug);
  const pathMatch = flatSidebar.find((item) => normalizeSlug(String(item.href)) === slug)?.path;

  const resolvedSidebar = sidebar ?? (await getSidebar());
  if (!pathMatch) return [];

  const breadcrumbs: IBreadcrumbItem[] = [];

  pathMatch.reduce((prev: IDocsTreeNode[] | IDocsTreeNode, cur: number) => {
    const current = Array.isArray(prev) ? prev[cur] : prev?.children?.[cur];
    if (!current) return prev;

    const currentUrl = current.href ? normalizeSlug(current.href) : undefined;
    breadcrumbs.push({
      label: current.label,
      href: currentUrl === slug ? undefined : currentUrl,
    });
    return current;
  }, resolvedSidebar as IDocsTreeNode[]);

  return breadcrumbs;
}

export function getDocsRoot(nodes: IDocsTreeNode[]): string | undefined {
  for (const n of nodes) {
    if (n.type !== 'separator' && n.href) return String(n.href);
    if (n.children?.length) {
      const h = getDocsRoot(n.children);
      if (h) return h;
    }
  }
}

export { getSidebar, getFlatSidebar, getDocPreviousAndNextLinks, getBreadcrumbs };
