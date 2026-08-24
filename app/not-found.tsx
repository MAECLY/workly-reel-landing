import type { Metadata } from 'next';

import { Footer } from '../components/Footer';
import { Masthead } from '../components/Masthead';
import { Button } from '@maecly/workly-reel-ui';

import { notFound, site, skipLink } from '../content';

export const metadata: Metadata = {
  title: `Not found | ${site.title}`,
  robots: { index: false, follow: false },
};

/** The same masthead, the same hairlines, and no apology theatre. */
export default function NotFound() {
  return (
    <>
      <Masthead />
      <main id={skipLink.targetId}>
        <section className="lp-shell lp-notfound" aria-labelledby="notfound-heading">
          <p className="lp-notfound__code">{notFound.code}</p>
          <h1 id="notfound-heading" className="lp-title">
            {notFound.heading}
          </h1>
          <p className="lp-lead">{notFound.body}</p>
          <div className="lp-actions">
            <Button asChild variant="primary" size="lg">
              <a href={notFound.action.href}>{notFound.action.label}</a>
            </Button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
