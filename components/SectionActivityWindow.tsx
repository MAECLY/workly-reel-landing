import { activityWindow, sectionIds } from '../content';

/**
 * Composition: a sticky argument rail beside a stack of bordered spec panels.
 * This is the one dense section on the page, and the contrast is deliberate:
 * a rule with edge cases should look like a specification, not like a feature
 * card. Every range and every refusal message is produced by the shipped
 * window contract at build time rather than transcribed by hand.
 */
export function SectionActivityWindow() {
  return (
    <section
      id={sectionIds.window}
      className="lp-band lp-band--sunken"
      aria-labelledby="window-heading"
    >
      <div className="lp-shell">
        <div className="lp-window__grid">
          <div className="lp-window__rail lp-reveal">
            <p className="lp-eyebrow">{activityWindow.eyebrow}</p>
            <h2 id="window-heading" className="lp-title">
              {activityWindow.heading}
            </h2>
            <p className="lp-lead">{activityWindow.standfirst}</p>
            <p className="lp-panel__note">{activityWindow.timezoneNote}</p>
          </div>

          <div className="lp-window__panels">
            <div className="lp-panel lp-reveal">
              <div className="lp-panel__head">
                <h3 className="lp-panel__title">Selection modes</h3>
                <p className="lp-mono lp-muted">
                  {activityWindow.bounds.min} to {activityWindow.bounds.max} inclusive dates
                </p>
              </div>
              {/*
                Focusable because it scrolls. The table keeps its columns and
                overflows its panel on a narrow viewport rather than reflowing,
                and a region that can only be moved with a pointer or a
                trackpad is unreachable from a keyboard.
              */}
              <div className="lp-panel__scroll" tabIndex={0}>
                <table className="lp-table">
                  <caption className="lp-panel__caption">
                    Example ranges resolved from 2026-08-24, the date the screenshots above were
                    taken.
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Mode</th>
                      <th scope="col">Rule</th>
                      <th scope="col">Range</th>
                      <th scope="col">Days</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activityWindow.modes.map((mode) => (
                      <tr key={mode.name}>
                        <th scope="row" className="lp-table__mode">
                          {mode.name}
                        </th>
                        <td className="lp-table__rule">
                          {mode.rule}
                          <span className="lp-table__note">{mode.note}</span>
                        </td>
                        <td className="lp-table__range">
                          {mode.startDate}
                          <br />
                          {mode.endDate}
                        </td>
                        <td className="lp-table__days">{mode.dayCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="lp-panel lp-reveal">
              <div className="lp-panel__head">
                <h3 className="lp-panel__title">{activityWindow.weekendProof.heading}</h3>
              </div>
              <div className="lp-weekend">
                {activityWindow.weekendProof.dates.map((entry) => (
                  <span key={entry.date} className="lp-weekend__chip">
                    <span className="lp-weekend__day">{entry.label}</span>
                    <span className="lp-weekend__date">{entry.date}</span>
                    <span className="lp-weekend__date">
                      {entry.weekend ? 'weekend, selectable' : 'weekday'}
                    </span>
                  </span>
                ))}
              </div>
              <p className="lp-panel__foot lp-panel__foot--flush">
                {activityWindow.weekendProof.body}
              </p>
            </div>

            <div className="lp-panel lp-reveal">
              <div className="lp-panel__head">
                <h3 className="lp-panel__title">{activityWindow.refusalsHeading}</h3>
                <p className="lp-mono lp-muted">Future dates are disabled</p>
              </div>
              <ul className="lp-refusals" role="list">
                {activityWindow.refusals.map((refusal) => (
                  <li key={refusal.code} className="lp-refusal">
                    <p className="lp-refusal__attempt">
                      {refusal.attempt}
                      <code className="lp-refusal__code">{refusal.code}</code>
                    </p>
                    <p className="lp-refusal__message">{refusal.message}</p>
                  </li>
                ))}
              </ul>
              <p className="lp-panel__foot">{activityWindow.refusalsNote}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
