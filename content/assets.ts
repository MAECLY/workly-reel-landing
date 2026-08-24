import manifest from '../public/assets/manifest.json';
import type { RealAsset } from './types';

/**
 * The three real assets, read from the manifest that ships beside them.
 *
 * The manifest is the only register of what may appear on this page. Reading it
 * here rather than hardcoding paths means a component cannot reference a file
 * the manifest does not describe, and `alt` is never rewritten in a component.
 * `docs/adr-0001-real-assets.md` records why this is a hard rule.
 */

const ASSET_KINDS = ['screenshot', 'export'] as const;

type AssetKind = (typeof ASSET_KINDS)[number];

const isAssetKind = (value: string): value is AssetKind =>
  (ASSET_KINDS as readonly string[]).includes(value);

const toRealAsset = (raw: (typeof manifest.assets)[number]): RealAsset => {
  if (!isAssetKind(raw.kind)) {
    throw new Error(`manifest.json: ${raw.file} has unknown kind "${raw.kind}"`);
  }
  if (!raw.approved) {
    throw new Error(`manifest.json: ${raw.file} is not approved for publication`);
  }
  if (raw.alt.trim() === '') {
    throw new Error(`manifest.json: ${raw.file} has no alt text`);
  }
  return { ...raw, kind: raw.kind };
};

export const realAssets: readonly RealAsset[] = manifest.assets.map(toRealAsset);

/** The commits the screenshots and the export were produced from. */
export const assetProvenance = manifest.generatedFrom;

/**
 * Look an asset up by its manifest path.
 *
 * Throws rather than returning a placeholder: a missing asset is a build-time
 * mistake, and a page that silently drops a screenshot would still claim to
 * show one.
 */
export function realAsset(file: string): RealAsset {
  const found = realAssets.find((asset) => asset.file === file);
  if (found === undefined) {
    throw new Error(`No asset "${file}" in public/assets/manifest.json`);
  }
  return found;
}

export const EVIDENCE_REVIEW = '/assets/screenshot-evidence-review.png';
export const ACTIVITY_WINDOW = '/assets/screenshot-activity-window.png';
export const SIGNAL_EXPORT = '/assets/export-signal-portrait.png';
