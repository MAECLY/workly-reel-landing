'use client';

import { Button } from '@maecly/workly-reel-ui';
import type { MouseEvent } from 'react';

interface ScrollActionProps {
  readonly label: string;
  readonly targetId: string;
  readonly variant?: 'primary' | 'secondary';
}

/**
 * An in-page action that also moves focus.
 *
 * It is a real anchor first: without JavaScript the browser navigates to the
 * fragment and the page still works. The handler adds the part a bare anchor
 * gets wrong, which is honouring `prefers-reduced-motion` for the scroll and
 * putting keyboard focus on the destination rather than leaving it behind on
 * the button.
 */
export function ScrollAction({ label, targetId, variant = 'primary' }: ScrollActionProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (target === null) {
      return;
    }

    event.preventDefault();

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });

    if (!target.hasAttribute('tabindex')) {
      target.setAttribute('tabindex', '-1');
    }
    target.focus({ preventScroll: true });
    window.history.replaceState(null, '', `#${targetId}`);
  };

  return (
    <Button asChild variant={variant} size="lg">
      <a href={`#${targetId}`} onClick={handleClick}>
        {label}
      </a>
    </Button>
  );
}
