import { createSocialImageResponse } from '@/lib/og/create-social-image';

const SOCIAL_IMAGE_TITLE = 'Privacy Policy | QA tuesday';

export async function GET() {
  return createSocialImageResponse({
    title: SOCIAL_IMAGE_TITLE,
  });
}
