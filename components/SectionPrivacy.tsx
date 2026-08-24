import { privacy, sectionIds } from '../content';

/**
 * Composition: a five-to-seven split of two definition lists, then a full
 * width four-column register of everything that does not exist yet. The
 * "not shipped" register is the widest, flattest block on the page on purpose:
 * the honest list should be as easy to read as the claims above it.
 */
export function SectionPrivacy() {
  return (
    <section id={sectionIds.scope} className="lp-band" aria-labelledby="scope-heading">
      <div className="lp-shell">
        <div className="lp-band__head lp-reveal">
          <p className="lp-eyebrow">{privacy.eyebrow}</p>
          <h2 id="scope-heading" className="lp-title">
            {privacy.heading}
          </h2>
          <p className="lp-lead">{privacy.standfirst}</p>
        </div>

        <div className="lp-scope__grid">
          <div className="lp-scope__column lp-reveal">
            <div className="lp-boundary">
              <p className="lp-boundary__title">{privacy.boundaryHeading}</p>
              <p className="lp-boundary__body">{privacy.boundaryBody}</p>
            </div>

            <div>
              <h3 className="lp-notshipped__title">{privacy.neverHeading}</h3>
              <dl className="lp-defs">
                {privacy.never.map((item) => (
                  <div key={item.label} className="lp-defs__row">
                    <dt className="lp-defs__term">{item.label}</dt>
                    <dd className="lp-defs__detail">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          <div className="lp-scope__column lp-reveal">
            <div>
              <h3 className="lp-notshipped__title">{privacy.namingHeading}</h3>
              <p className="lp-panel__note">{privacy.namingBody}</p>
            </div>
            <dl className="lp-defs lp-defs--mono">
              {privacy.namingPolicies.map((item) => (
                <div key={item.label} className="lp-defs__row">
                  <dt className="lp-defs__term">{item.label}</dt>
                  <dd className="lp-defs__detail">{item.detail}</dd>
                </div>
              ))}
            </dl>
            <div className="lp-platform">
              <h3 className="lp-panel__title">{privacy.platformHeading}</h3>
              <p className="lp-defs__detail">{privacy.platformBody}</p>
            </div>
          </div>
        </div>

        <div className="lp-notshipped lp-reveal">
          <div className="lp-notshipped__head">
            <h3 className="lp-notshipped__title">{privacy.notShippedHeading}</h3>
            <p className="lp-panel__note">{privacy.notShippedNote}</p>
          </div>
          <ul className="lp-notshipped__list" role="list">
            {privacy.notShipped.map((item) => (
              <li key={item.label} className="lp-notshipped__item">
                <p className="lp-notshipped__label">{item.label}</p>
                <p className="lp-notshipped__detail">{item.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
