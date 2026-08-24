import { site } from '../content';

/**
 * The `WorklyReel` / `by MAECLY` lockup.
 *
 * The wordmark and its endorsement are one unit: the endorsement is set at the
 * scale and tracking the token document defines, so the relationship is the
 * same here as it is in the application and in an exported card.
 */
export function Wordmark({ size = 'sm' }: { readonly size?: 'sm' | 'lg' }) {
  return (
    <span className={`lp-lockup lp-lockup--${size}`}>
      <span className="lp-lockup__mark">{site.productName}</span>
      <span className="lp-lockup__endorsement">{site.endorsement}</span>
    </span>
  );
}
