import { ReactElement } from 'react';

import { ISeoFields, ITableOfContentsItem } from '@/types/common';

export interface IDocsTreeNode {
  type: 'page' | 'folder' | 'separator';
  label: string;
  href?: string;
  icon?: string;
  badge?: string;
  children?: IDocsTreeNode[];
  index?: IDocsTreeNode;
  root?: boolean;
  defaultOpen?: boolean;
  description?: string;
  path?: number[];
}

export interface IFlatSidebarItem extends IDocsTreeNode {
  path: number[];
}

export interface IPreviousAndNextLinks {
  previousLink?: IDocsTreeNode;
  nextLink?: IDocsTreeNode;
}

export interface IDocMetadata {
  title: string;
  excerpt: string;
  isDraft: boolean;
  updatedAt: string;
  seo: ISeoFields;
  icon?: string;
}

export interface IDocPost extends IDocMetadata {
  slug: string;
  content: ReactElement;
  tableOfContents: ITableOfContentsItem[];
  sourceUrl: URL;
}

export interface IDocPostMeta extends IDocMetadata {
  slug: string;
  sourceUrl: URL;
}
