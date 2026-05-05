import { BookOpen, FileText, type LucideIcon } from 'lucide-react';

const DOCS_SIDEBAR_ICONS = {
  'book-open': BookOpen,
  'file-text': FileText,
} as const;

export type DocsSidebarIconName = keyof typeof DOCS_SIDEBAR_ICONS;

export function getDocsSidebarIcon(icon: string | undefined): LucideIcon | null {
  if (!icon) {
    return null;
  }

  return DOCS_SIDEBAR_ICONS[icon as DocsSidebarIconName] ?? null;
}
