/**
 * One entry point for every rendered string.
 *
 * `scripts/check-content.ts` walks this object, and a later localisation pass
 * swaps the modules behind it rather than editing components.
 */
export { activityWindow } from './activity-window';
export {
  ACTIVITY_WINDOW,
  EVIDENCE_REVIEW,
  SIGNAL_EXPORT,
  assetProvenance,
  realAsset,
  realAssets,
} from './assets';
export { hero } from './hero';
export { notFound } from './not-found';
export { privacy } from './privacy';
export { proof } from './proof';
export { run } from './run';
export { sectionIds, site, skipLink, themeColors } from './site';
export { workflow } from './workflow';

export type {
  PageAction,
  ProofClaim,
  RealAsset,
  RunStep,
  ScopeItem,
  WindowMode,
  WindowRefusal,
  WorkflowStage,
} from './types';
