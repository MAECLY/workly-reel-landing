import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import '@maecly/workly-reel-ui/styles.css';
import './landing.css';

import { ThemeRoot } from '../components/ThemeRoot';
import { SIGNAL_EXPORT, realAsset, site, skipLink, themeColors } from '../content';

const ogImage = realAsset(SIGNAL_EXPORT);

/**
 * Phase 0 is publicly reachable so the work can be reviewed, and deliberately
 * not indexable. The canonical link and the sitemap point at the real origin so
 * a reviewer always lands on one address, while `robots` refuses indexing until
 * there is a finished product behind it.
 */
export const metadata: Metadata = {
  metadataBase: new URL(site.origin),
  title: site.title,
  description: site.description,
  applicationName: `${site.productName} ${site.endorsement}`,
  category: site.category,
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    url: site.canonical,
    siteName: `${site.productName} ${site.endorsement}`,
    title: site.title,
    description: site.description,
    locale: 'en',
    images: [
      {
        url: ogImage.file,
        width: ogImage.width,
        height: ogImage.height,
        alt: ogImage.alt,
        type: 'image/png',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: site.title,
    description: site.description,
    images: [ogImage.file],
  },
};

export const viewport: Viewport = {
  colorScheme: 'dark light',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: themeColors.dark },
    { media: '(prefers-color-scheme: light)', color: themeColors.light },
  ],
};

export default function RootLayout({ children }: { readonly children: ReactNode }) {
  return (
    <html lang={site.locale} data-theme="dark">
      <body>
        {/*
          Written here rather than through `alternates.canonical` because Next
          normalises a metadata URL by dropping the trailing slash, and the
          agreed canonical address for this origin carries one. React hoists a
          `rel="canonical"` link into the document head.
        */}
        <link rel="canonical" href={site.canonical} />
        <a className="lp-skip" href={`#${skipLink.targetId}`}>
          {skipLink.label}
        </a>
        <ThemeRoot>{children}</ThemeRoot>
      </body>
    </html>
  );
}
