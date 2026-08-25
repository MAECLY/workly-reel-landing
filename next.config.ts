import type { NextConfig } from 'next';

/**
 * This site is exported as static files and served by GitHub Pages.
 *
 * That choice is what removes the `headers()` block this file used to carry.
 * A static host serves files and nothing else: there is no place to configure a
 * response header, so `X-Robots-Tag`, `X-Content-Type-Options`,
 * `Referrer-Policy` and the Content-Security-Policy cannot be sent. Next
 * silently ignores `headers()` under `output: 'export'`, which is worse than
 * removing it, because the configuration would still read as though the site
 * were protected.
 *
 * What survives, and how:
 *
 * - `noindex, nofollow` is unaffected. It was always sent twice, as a header
 *   and as the robots meta tag Next emits from `metadata.robots`, and the meta
 *   tag is what every compliant crawler reads.
 * - The Content-Security-Policy moves to a `<meta http-equiv>` tag in
 *   `app/layout.tsx`, minus `frame-ancestors`, which browsers ignore in a meta
 *   tag by specification. Clickjacking protection is therefore genuinely lost,
 *   and `tests/e2e/headers.e2e.ts` says so rather than asserting otherwise.
 * - `X-Content-Type-Options: nosniff` has no meta equivalent and is lost.
 * - `Referrer-Policy` moves to a meta tag, which browsers do honour.
 *
 * Putting Cloudflare in front of the Pages origin would restore all of them as
 * real headers; `maecly.com` already resolves through Cloudflare, so that is a
 * transform rule rather than a migration. Until then the honest position is
 * that the static site carries less than the Node server did, and the gates
 * assert what it actually carries.
 */
const nextConfig: NextConfig = {
  output: 'export',
  poweredByHeader: false,

  /**
   * The default loader optimises on demand, which needs a server. Static export
   * has none, so the images are served exactly as they sit in `public/`. They
   * are already sized for their layout and pinned by SHA-256 in the asset
   * manifest, so there is nothing for an optimiser to do here.
   */
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
