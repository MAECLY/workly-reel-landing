import { describe, expect, it } from 'vitest';

import { metadata, viewport } from '../app/layout';
import robots from '../app/robots';
import sitemap from '../app/sitemap';
import { realAsset, SIGNAL_EXPORT, site } from '../content';

describe('metadata', () => {
  it('leads with the Developer Proof-of-Work category', () => {
    expect(metadata.title).toBe('Developer Proof-of-Work | WorklyReel by MAECLY');
    expect(String(metadata.title).startsWith('Developer Proof-of-Work')).toBe(true);
    expect(String(metadata.description).startsWith('Developer Proof-of-Work')).toBe(true);
  });

  it('refuses indexing while Phase 0 is the published thing', () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
  });

  it('uses the real export as its Open Graph image, at its true size', () => {
    const asset = realAsset(SIGNAL_EXPORT);
    const images = metadata.openGraph?.images;
    expect(Array.isArray(images)).toBe(true);
    const first = Array.isArray(images) ? images[0] : undefined;
    expect(first).toMatchObject({
      url: asset.file,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
    });
  });

  it('resolves URLs against the agreed origin', () => {
    expect(String(metadata.metadataBase)).toBe(`${site.origin}/`);
    expect(metadata.openGraph?.url).toBe(site.canonical);
  });

  it('declares both themes to the browser, using the generated token colours', () => {
    expect(viewport.colorScheme).toBe('dark light');
    expect(viewport.themeColor).toEqual([
      { media: '(prefers-color-scheme: dark)', color: '#0f0c0a' },
      { media: '(prefers-color-scheme: light)', color: '#fcfbfa' },
    ]);
  });
});

describe('the canonical address', () => {
  it('is the origin with its trailing slash', () => {
    expect(site.canonical).toBe('https://workly-reel.maecly.com/');
  });

  it('is the only entry in the sitemap', () => {
    const entries = sitemap();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.url).toBe(site.canonical);
  });

  it('is refused to every crawler by robots', () => {
    const rules = robots();
    expect(rules.rules).toEqual([{ userAgent: '*', disallow: '/' }]);
    expect(rules.sitemap).toBe(`${site.origin}/sitemap.xml`);
  });
});
