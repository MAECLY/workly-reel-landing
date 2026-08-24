import type { MetadataRoute } from 'next';

import { site } from '../content';

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
