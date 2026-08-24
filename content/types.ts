/**
 * Shapes for every string the landing page renders.
 *
 * Content is declared here and in the sibling modules rather than inline in a
 * component, so a translator can be handed `content/` and nothing else, and so
 * `scripts/check-content.ts` can walk one object graph instead of parsing JSX.
 */

/** An entry in `public/assets/manifest.json`. Nothing else may be rendered. */
export interface RealAsset {
  readonly file: string;
  readonly kind: 'screenshot' | 'export';
  readonly caption: string;
  readonly alt: string;
  readonly width: number;
  readonly height: number;
  readonly bytes: number;
  readonly sha256: string;
  readonly capturedFrom: string;
  readonly dataPolicy: string;
  readonly fictionalProject: string;
  readonly fictionalAuthor: string;
  readonly approved: boolean;
}

/** An in-page destination. The page has no outbound link in Phase 0. */
export interface PageAction {
  readonly label: string;
  readonly targetId: string;
}

export interface WorkflowStage {
  readonly index: string;
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly detail: string;
  /** Present only for the two stages a real screenshot exists for. */
  readonly assetFile?: string;
}

/** One selection mode, with the range the shipped domain logic derives for it. */
export interface WindowMode {
  readonly name: string;
  readonly rule: string;
  readonly startDate: string;
  readonly endDate: string;
  readonly dayCount: number;
  readonly note: string;
}

/** A selection the shipped domain logic refuses, with its real message. */
export interface WindowRefusal {
  readonly attempt: string;
  readonly code: string;
  readonly message: string;
}

export interface ProofClaim {
  readonly title: string;
  readonly body: string;
}

export interface ScopeItem {
  readonly label: string;
  readonly detail: string;
}

export interface RunStep {
  readonly comment: string;
  readonly command: string;
}
