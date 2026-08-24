import { Wordmark } from './Wordmark';
import { assetProvenance, site } from '../content';

/**
 * The provenance line.
 *
 * Naming the two commits the assets came from is what makes the claim on this
 * page checkable: a reader can pin the same commits and produce the same
 * screenshots and the same export.
 */
export function Footer() {
  return (
    <footer className="lp-footer">
      <div className="lp-shell lp-footer__inner">
        <div className="lp-footer__pins">
          <span>Assets on this page were produced from:</span>
          <span>desktop {assetProvenance.desktopCommit}</span>
          <span>design system {assetProvenance.designSystemCommit}</span>
        </div>
        <div className="lp-footer__pins">
          <Wordmark />
          <span>
            {site.category}. {site.phaseLabel}.
          </span>
        </div>
      </div>
    </footer>
  );
}
