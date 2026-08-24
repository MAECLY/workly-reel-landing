import { AssetFigure } from './AssetFigure';
import { proof, sectionIds } from '../content';

/**
 * Composition: the artefact leads at five columns and the argument follows at
 * six, dropped down the page so the two never line up. This inverts the hero,
 * where the words led and the picture followed. The band sits on the sunken
 * surface so the export is the most colourful thing in view, which is what the
 * design system asks of every screen that shows generated output.
 */
export function SectionProof() {
  return (
    <section
      id={sectionIds.proof}
      className="lp-band lp-band--surface"
      aria-labelledby="proof-heading"
    >
      <div className="lp-shell">
        <div className="lp-band__head lp-reveal">
          <p className="lp-eyebrow">{proof.eyebrow}</p>
          <h2 id="proof-heading" className="lp-title">
            {proof.heading}
          </h2>
          <p className="lp-lead">{proof.standfirst}</p>
        </div>

        <div className="lp-proof__grid">
          <div className="lp-proof__figure lp-reveal">
            <AssetFigure
              file={proof.assetFile}
              variant="export"
              sizes="(min-width: 1024px) 42vw, 92vw"
            />
            <dl className="lp-spec">
              <div className="lp-spec__row">
                <dt className="lp-spec__key">Template</dt>
                <dd className="lp-spec__value">{proof.template.family}</dd>
              </div>
              <div className="lp-spec__row">
                <dt className="lp-spec__key">Canvas</dt>
                <dd className="lp-spec__value">
                  {proof.template.width} x {proof.template.height}
                </dd>
              </div>
              <div className="lp-spec__row">
                <dt className="lp-spec__key">Layout version</dt>
                <dd className="lp-spec__value">{proof.template.version}</dd>
              </div>
              <div className="lp-spec__row">
                <dt className="lp-spec__key">Palette</dt>
                <dd className="lp-spec__value">{proof.template.palette}</dd>
              </div>
              <div className="lp-spec__row">
                <dt className="lp-spec__key">Text regions</dt>
                <dd className="lp-spec__value">{proof.template.textRegionCount}</dd>
              </div>
              <div className="lp-spec__row">
                <dt className="lp-spec__key">Artwork layer</dt>
                <dd className="lp-spec__value">none in Phase 0</dd>
              </div>
            </dl>
            <p className="lp-panel__note">{proof.syntheticNote}</p>
          </div>

          <div className="lp-proof__argument">
            <ol className="lp-claims lp-reveal" role="list">
              {proof.claims.map((claim, position) => (
                <li key={claim.title} className="lp-claim">
                  <h3 className="lp-claim__title">
                    <span className="lp-claim__index" aria-hidden="true">
                      {String(position + 1).padStart(2, '0')}
                    </span>
                    {claim.title}
                  </h3>
                  <p className="lp-claim__body">{claim.body}</p>
                </li>
              ))}
            </ol>

            <div className="lp-postcopy lp-reveal">
              <div className="lp-panel__head">
                <h3 className="lp-panel__title">{proof.postCopy.heading}</h3>
                <p className="lp-mono lp-muted">plain text, exported beside the image</p>
              </div>
              <div className="lp-postcopy__body">
                {proof.postCopy.lines.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
              <p className="lp-postcopy__note">{proof.postCopy.note}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
