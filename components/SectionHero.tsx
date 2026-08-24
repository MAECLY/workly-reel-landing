import { AssetFigure } from './AssetFigure';
import { ScrollAction } from './ScrollAction';
import { Wordmark } from './Wordmark';
import { hero, sectionIds, site } from '../content';

/**
 * Composition: an asymmetric seven-to-five split. The argument is left-flush
 * and the screenshot runs past the shell into the right gutter, so the page
 * opens off-centre. A three-part metadata strip closes it on a hairline.
 */
export function SectionHero() {
  return (
    <section id={sectionIds.hero} className="lp-hero" aria-labelledby="hero-heading">
      <div className="lp-shell">
        <div className="lp-hero__grid">
          <div className="lp-hero__copy">
            <div className="lp-rise">
              <Wordmark size="lg" />
            </div>
            <p className="lp-eyebrow lp-rise lp-rise--1">{hero.eyebrow}</p>
            <h1 id="hero-heading" className="lp-display lp-hero__headline lp-rise lp-rise--1">
              {hero.headline}
            </h1>
            <p className="lp-lead lp-hero__supporting lp-rise lp-rise--2">{hero.supporting}</p>

            <div className="lp-hero__status lp-rise lp-rise--3">
              <span className="lp-status">{hero.statusLabel}</span>
              <span className="lp-hero__statusDetail">{hero.statusDetail}</span>
            </div>

            <div className="lp-actions lp-rise lp-rise--3">
              <ScrollAction
                label={hero.primaryAction.label}
                targetId={hero.primaryAction.targetId}
                variant="primary"
              />
              <ScrollAction
                label={hero.secondaryAction.label}
                targetId={hero.secondaryAction.targetId}
                variant="secondary"
              />
            </div>

            <p className="lp-hero__trust lp-rise lp-rise--4">{hero.trustLine}</p>
          </div>

          <div className="lp-hero__figure lp-rise lp-rise--2">
            <AssetFigure file={hero.assetFile} sizes="(min-width: 1024px) 46vw, 92vw" priority />
            <div className="lp-hero__point">
              <h2 className="lp-hero__pointTitle">{hero.assetPoint.title}</h2>
              <p className="lp-hero__pointBody">{hero.assetPoint.body}</p>
            </div>
          </div>
        </div>

        <dl className="lp-hero__meta">
          <div className="lp-hero__metaItem">
            <dt className="lp-hero__metaKey">Category</dt>
            <dd className="lp-hero__metaValue">{site.category}</dd>
          </div>
          <div className="lp-hero__metaItem">
            <dt className="lp-hero__metaKey">Workflow</dt>
            <dd className="lp-hero__metaValue">{site.workflow}</dd>
          </div>
          <div className="lp-hero__metaItem">
            <dt className="lp-hero__metaKey">Tested on</dt>
            <dd className="lp-hero__metaValue">{site.testedPlatform}</dd>
          </div>
        </dl>
      </div>
    </section>
  );
}
