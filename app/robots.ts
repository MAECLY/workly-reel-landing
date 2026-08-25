import type { MetadataRoute } from 'next';

import { site } from '../content';

/**
 * Required by `output: 'export'`. A metadata route is a route handler, and
 * Next refuses to export one that has not declared itself static, rather than
 * guessing. This one reads a constant, so it is static by construction.
 */
export const dynamic = 'force-static';

/**
 * Phase 0 refuses indexing.
 *
 * The sitemap is still declared so a reviewer pointed at the origin can see the
 * one canonical address. Production indexing is Phase 4 work and the roadmap
 * says so; nothing here should outlive the proof of concept in a result page.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
    sitemap: `${site.origin}/sitemap.xml`,
    host: site.origin,
  };
}
