import Image from 'next/image';
import { realAsset } from '../content';

interface AssetFigureProps {
  /** A path that must exist in `public/assets/manifest.json`. */
  readonly file: string;
  /** Rendered width hints for the image loader. */
  readonly sizes: string;
  readonly priority?: boolean;
  readonly variant?: 'screenshot' | 'export';
}

const formatBytes = (bytes: number): string => `${Math.round(bytes / 1024)} kB`;

/**
 * A real screenshot or a real export, with its provenance attached.
 *
 * Alt text, caption, dimensions, and the recorded build all come from the
 * manifest rather than from the calling component, so a figure cannot be
 * relabelled at the call site and an image can never be rendered without the
 * label that says what it is and where it came from.
 */
export function AssetFigure({
  file,
  sizes,
  priority = false,
  variant = 'screenshot',
}: AssetFigureProps) {
  const asset = realAsset(file);

  return (
    <figure className={`lp-figure lp-figure--${variant}`}>
      <div className="lp-figure__frame">
        <Image
          src={asset.file}
          alt={asset.alt}
          width={asset.width}
          height={asset.height}
          sizes={sizes}
          priority={priority}
        />
      </div>
      <figcaption className="lp-figure__caption">
        <span>{asset.caption}</span>
        <span className="lp-figure__provenance">
          <span>{asset.kind === 'export' ? 'Real export' : 'Real screenshot'}</span>
          <span>{asset.capturedFrom}</span>
          <span>
            {asset.width} x {asset.height}
          </span>
          <span>{formatBytes(asset.bytes)}</span>
          <span title={`SHA-256 ${asset.sha256}`}>sha256 {asset.sha256.slice(0, 12)}</span>
          <span>Synthetic data</span>
        </span>
      </figcaption>
    </figure>
  );
}
