import { AssetFigure } from './AssetFigure';
import { sectionIds, workflow } from '../content';

/**
 * Composition: a hairline ledger, not a card grid. The section header is
 * indented to where the detail column starts, the two stages that have a real
 * screenshot break the ledger into a three-column spread on alternating sides,
 * and the remaining four step progressively to the right as the flow moves
 * away from raw evidence.
 */
export function SectionWorkflow() {
  return (
    <section id={sectionIds.workflow} className="lp-band" aria-labelledby="workflow-heading">
      <div className="lp-shell">
        <div className="lp-band__head lp-workflow__head lp-reveal">
          <p className="lp-eyebrow">{workflow.eyebrow}</p>
          <h2 id="workflow-heading" className="lp-title">
            {workflow.heading}
          </h2>
          <p className="lp-lead">{workflow.standfirst}</p>
        </div>

        <ol className="lp-ledger" role="list">
          {workflow.stages.map((stage, position) => {
            const assetFile = 'assetFile' in stage ? stage.assetFile : undefined;
            const modifiers =
              assetFile === undefined
                ? ` lp-stage--step-${position - 2}`
                : ` lp-stage--wide${position % 2 === 1 ? ' lp-stage--mirrored' : ''}`;

            return (
              <li key={stage.id} id={stage.id} className={`lp-stage lp-reveal${modifiers}`}>
                <div className="lp-stage__index">
                  <span className="lp-stage__number">{stage.index}</span>
                  <h3 className="lp-stage__name">{stage.name}</h3>
                </div>

                <div className="lp-stage__body">
                  <p className="lp-stage__summary">{stage.summary}</p>
                  <p className="lp-stage__detail">{stage.detail}</p>
                </div>

                {assetFile === undefined ? null : (
                  <div className="lp-stage__figure">
                    <AssetFigure
                      file={assetFile}
                      sizes="(min-width: 1200px) 52vw, (min-width: 900px) 70vw, 92vw"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
