import { ThemeToggle } from './ThemeToggle';
import { site } from '../content';

/**
 * A running head rather than a second logo.
 *
 * The lockup is stated once, large, at the top of the hero, and again in the
 * footer. Repeating it in a sticky bar directly above it would read as an
 * accident, so the bar carries the category instead and keeps the theme
 * control reachable from anywhere on the page.
 */
export function Masthead() {
  return (
    <header className="lp-masthead">
      <div className="lp-shell lp-masthead__inner">
        <p className="lp-masthead__running">{site.category}</p>
        <ThemeToggle />
      </div>
    </header>
  );
}
