import type { MetadataRoute } from 'next';

import { site } from '../content';

/**
 * Required by `output: 'export'`. A metadata route is a route handler, and
 * Next refuses to export one that has not declared itself static, rather than
 * guessing. This one reads a constant, so it is static by construction.
 */
export const dynamic = 'force-static';

/** One page, rooted at the real origin. Phase 0 publishes nothing else. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: site.canonical,
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
