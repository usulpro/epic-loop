import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import config from '@/configs/website-config';

import {
  getBreadcrumbs,
  getDocPreviousAndNextLinks,
  getFlatSidebar,
  getSidebar,
} from '@/lib/docs/page-tree';
import { getAllDocPostSlugs, getDocPostBySlug, getDocPostMetaBySlug } from '@/lib/docs/posts';
import { getMetadata } from '@/lib/get-metadata';
import Content from '@/components/pages/content';
import Aside from '@/components/pages/docs/aside--docs';
import Breadcrumbs from '@/components/pages/docs/breadcrumbs';
import Footer from '@/components/pages/docs/footer';

export const dynamicParams = false;

type DocPageParams = Promise<{ slug?: string[] }>;

export default async function DocPage({ params }: { params: DocPageParams }) {
  const { slug } = await params;
  if (!slug?.length) {
    return notFound();
  }

  const currentSlug = slug.join('/');
  const currentPath = `/${currentSlug}`;
  const post = await getDocPostBySlug(currentSlug);

  if (!post) {
    return notFound();
  }

  const sidebar = await getSidebar();
  const flatSidebar = getFlatSidebar(sidebar);

  const breadcrumbs = await getBreadcrumbs('/docs' + currentPath, flatSidebar, sidebar);
  const { previousLink, nextLink } = getDocPreviousAndNextLinks('/docs' + currentPath, flatSidebar);

  const { title, excerpt, content, tableOfContents, sourceUrl } = post;

  const siteUrl = process.env.NEXT_PUBLIC_DEFAULT_SITE_URL || '';
  const currentUrl = `${siteUrl}/docs/${currentSlug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title,
    description: excerpt,
    author: [{ '@type': 'Organization', name: config.projectName }],
    url: currentUrl,
    image: `${siteUrl}/docs/og/${currentSlug}`,
    publisher: {
      '@type': 'Organization',
      name: config.projectName,
      url: siteUrl,
    },
  };

  return (
    <article className="grid grid-cols-1 gap-x-8 xl:grid-cols-[auto_12rem]">
      <div className="pt-8 pb-24 md:pt-11 md:pb-28 lg:pt-10 lg:pb-32 xl:max-w-176 xl:pt-12 xl:pb-48">
        <Breadcrumbs items={breadcrumbs} />
        <header className="mt-8 flex flex-col gap-y-4 lg:mt-9 xl:mt-14">
          <h1
            className="text-3xl leading-tight font-semibold tracking-tight text-foreground md:text-4xl md:leading-tight"
            id="introduction"
          >
            {title}
          </h1>
          {excerpt && (
            <p className="text-lg leading-snug tracking-tight text-pretty text-foreground/80 md:text-xl md:leading-snug">
              {excerpt}
            </p>
          )}
        </header>
        <Content content={content} />
        <Footer className="mt-16 md:mt-24" previousLink={previousLink} nextLink={nextLink} />
      </div>
      <Aside
        className="inset-x-0 bottom-0 -mx-1 hidden h-full max-h-svh overflow-auto px-1 xl:block"
        editUrl={sourceUrl.toString()}
        tableOfContents={tableOfContents.filter((item) => item.depth === 2)}
        sticky
      />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
    </article>
  );
}

export async function generateStaticParams() {
  const slugs = await getAllDocPostSlugs();
  return slugs.map((slug) => {
    const slugsArray = slug.split('/');
    return {
      slug: slugsArray,
    };
  });
}

export async function generateMetadata({ params }: { params: DocPageParams }): Promise<Metadata> {
  const { slug } = await params;
  if (!slug?.length) {
    return notFound();
  }

  const currentSlug = slug.join('/');

  const post = await getDocPostMetaBySlug(currentSlug);

  if (!post) {
    return notFound();
  }

  const { seo } = post;

  return getMetadata({
    title: `${seo.title} | ${config.projectName}`,
    description: seo.description,
    pathname: `/docs/${currentSlug}`,
    imagePath: seo.socialImage,
    noIndex: seo.noIndex,
  });
}
