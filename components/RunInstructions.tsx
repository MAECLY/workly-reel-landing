import { run, sectionIds } from '../content';

/**
 * The scroll target for the hero's primary action.
 *
 * Composition: a four-to-eight split with the prerequisites as a quiet aside
 * and the command sequence as one bordered register that runs the full width
 * of the remaining columns. It is a document, not a terminal: no window
 * chrome, no prompt glyph, no simulated output.
 */
export function RunInstructions() {
  return (
    <section id={sectionIds.run} className="lp-band lp-band--sunken" aria-labelledby="run-heading">
      <div className="lp-shell">
        <div className="lp-band__head lp-reveal">
          <p className="lp-eyebrow">{run.eyebrow}</p>
          <h2 id="run-heading" className="lp-title">
            {run.heading}
          </h2>
          <p className="lp-lead">{run.standfirst}</p>
        </div>

        <div className="lp-run__grid">
          <div className="lp-run__aside lp-reveal">
            <div>
              <h3 className="lp-panel__title">{run.prerequisitesHeading}</h3>
              <dl className="lp-defs">
                {run.prerequisites.map((item) => (
                  <div key={item.label} className="lp-defs__row">
                    <dt className="lp-defs__term">{item.label}</dt>
                    <dd className="lp-defs__detail">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <p className="lp-panel__note">{run.sshNote}</p>
          </div>

          <div className="lp-reveal">
            <div className="lp-sequence">
              <div className="lp-sequence__head">
                <h3 className="lp-panel__title">{run.stepsHeading}</h3>
                <p className="lp-mono lp-muted">macOS on Apple silicon</p>
              </div>
              <ol role="list">
                {run.steps.map((step) => (
                  <li key={step.command} className="lp-sequence__step">
                    {step.comment === '' ? null : (
                      <p className="lp-sequence__comment">{step.comment}</p>
                    )}
                    {/*
                      Focusable for the same reason the specification table is:
                      a command longer than the panel scrolls sideways instead
                      of wrapping, and a keyboard has to be able to read the
                      rest of it.
                    */}
                    <pre className="lp-sequence__command" tabIndex={0}>
                      <code>{step.command}</code>
                    </pre>
                  </li>
                ))}
              </ol>
            </div>
            <p className="lp-panel__foot">{run.closingNote}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
