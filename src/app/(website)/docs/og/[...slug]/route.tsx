import config from '@/configs/website-config';

import { getDocPostMetaBySlug } from '@/lib/docs/posts';
import { createSocialImageResponse } from '@/lib/og/create-social-image';

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{ slug: string[] }>;
  },
) {
  const { slug } = await params;
  const currentSlug = slug.join('/');
  const post = await getDocPostMetaBySlug(currentSlug);

  return createSocialImageResponse({
    title: post?.seo?.title ? `${post.seo.title} | ${config.projectName}` : config.projectName,
  });
}
