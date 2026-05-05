import { createSocialImageResponse } from '@/lib/og/create-social-image';

const SOCIAL_IMAGE_TITLE = 'Terms & Conditions | QA tuesday';

export async function GET() {
  return createSocialImageResponse({
    title: SOCIAL_IMAGE_TITLE,
  });
}
