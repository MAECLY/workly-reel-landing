# Phase 0 checklist

Run this before any deployment, and again after any copy change. Automated
items name the command that proves them; the rest are read by a person.

`pnpm verify` runs the automated gates in the order CI does. `pnpm content:check`
checks the rendered markup layer only when `.next` output exists, so run
`pnpm build` first if you want that layer covered.

## 1. Claims

Every capability sentence must be checkable against the desktop repository's
`README.md`, `docs/platform-support.md`, and `docs/phased-roadmap.md`.

- [ ] No claim about Windows, Linux, Intel macOS, AMD, NVIDIA, CUDA, Metal, or
      any local model runtime. `pnpm content:check`
- [ ] No sentence implies the product posts or publishes to LinkedIn. The page
      exports files; the reader posts them. `pnpm content:check`
- [ ] The visible `Functional proof of concept` label is present.
      `pnpm content:check`, `pnpm test`
- [ ] The not-shipped list still matches the desktop roadmap: no local AI, no
      cloud AI, no model manager, no additional templates or formats, no
      scheduler, no updater, no telemetry, no direct publishing. `pnpm test`
- [ ] The three shipped lenses named on the page are still the three the desktop
      repository ships.
- [ ] The tested platform statement still matches `docs/platform-support.md`,
      including the date.
- [ ] No forbidden marketing word: revolutionary, effortless, 10x, thought
      leader, personal brand on autopilot, never share data. `pnpm content:check`
- [ ] No em dash in visible copy. `pnpm content:check`
- [ ] No fabricated metric, percentage, star count, adoption figure,
      testimonial, or customer logo. `pnpm content:check`
- [ ] No pricing, waitlist, newsletter, or demo booking. `pnpm content:check`

## 2. Accessibility

- [ ] One `h1`, and heading levels descend without skipping.
- [ ] The skip link is the first focusable element and reveals itself on focus.
- [ ] Every interactive element is reachable and operable by keyboard alone.
- [ ] Focus is visible on every control, in both themes.
- [ ] The theme toggle's accessible name says what pressing it will do.
      `pnpm test`
- [ ] The primary action moves focus to the run block, not just the scroll
      position.
- [ ] Colour is never the only carrier of meaning.
- [ ] Contrast passes AA in both themes. The design system verifies its own
      pairings at build time; this page uses only those pairings.
- [ ] The layout is usable at 200 percent zoom and at 390 pixels wide, with no
      horizontal page scroll. The one table scrolls inside its own container.
- [ ] Under `prefers-reduced-motion: reduce` nothing animates and the smooth
      scroll becomes an instant jump.

## 3. Screenshots

- [ ] Every image is listed in `public/assets/manifest.json`.
      `pnpm content:check`
- [ ] Every `<img>` has alt text, and that text comes from the manifest.
      `pnpm content:check`, `pnpm test`
- [ ] Every figure is captioned with what it shows and which build produced it.
      `pnpm test`
- [ ] The export is rendered at its true 1080 by 1350 proportion. `pnpm test`
- [ ] Explicit `width` and `height` are set from the manifest, so nothing shifts
      on load.
- [ ] The bytes on disk still match the manifest size and SHA-256. `pnpm test`
- [ ] `generatedFrom` still names the commits the pictures came from, and the
      footer still prints them.

## 4. Asset privacy

- [ ] Every asset's `dataPolicy` is `synthetic`. `pnpm test`
- [ ] No real repository, employer, person, path, email address, hostname, or
      credential is visible in any picture. Read each image, do not assume.
- [ ] The fictional project is Harbour Ledger and the fictional author is
      A. Rivera, matching the design system's own fixtures.
- [ ] Every asset is `approved: true`. An unapproved entry refuses to render.

## 5. Links

- [ ] No `href` is empty or `#`. `pnpm content:check`, `pnpm test`
- [ ] Every in-page anchor resolves to an element that exists, on both routes.
      `pnpm content:check`, `pnpm test`
- [ ] The not-found route offers exactly one way back, to a route that exists.
      `pnpm test`
- [ ] No download attribute anywhere. `pnpm content:check`
- [ ] No outbound link makes a promise the private repository cannot keep.

## 6. Metadata

- [ ] Title and description lead with Developer Proof-of-Work. `pnpm test`
- [ ] Canonical is exactly `https://workly-reel.maecly.com/`, including the
      trailing slash, and appears once. `pnpm test`
- [ ] `robots` is `{ index: false, follow: false }` and the `X-Robots-Tag`
      response header agrees. `pnpm test`
- [ ] Open Graph uses the real export at 1080 by 1350 with the manifest's alt
      text. `pnpm test`
- [ ] The sitemap contains one entry, the canonical URL. `pnpm test`
- [ ] `robots.txt` disallows everything and points at the sitemap. `pnpm test`
- [ ] The favicon is served and is the desktop application's own icon.
- [ ] `theme-color` matches the canvas token for each theme. `pnpm test`

## 7. Tests

- [ ] `pnpm run typecheck` is clean.
- [ ] `pnpm run content:check` passes with the built HTML present.
- [ ] `pnpm run test` passes, including the linter's own regression suite.
- [ ] `pnpm run build` succeeds and prerenders every route statically.

## 8. Performance

Phase 0 publishes no performance number, and this checklist does not invent one.
These are shape checks, not budgets.

- [ ] Every route is prerendered as static content.
- [ ] Client JavaScript is limited to the theme provider, the theme toggle, and
      the scroll actions.
- [ ] Fonts are self-hosted, WOFF2, and `font-display: swap`.
- [ ] The hero image is `priority`; nothing else is.
- [ ] Explicit dimensions are set on every image, so layout does not shift.
- [ ] No third-party script, font, pixel, or stylesheet is loaded.

## 9. Local execution

- [ ] `pnpm install` succeeds on a clean checkout with an SSH key that can read
      `MAECLY/workly-reel-ui`.
- [ ] `pnpm dev` serves the page and the theme toggle works.
- [ ] `pnpm build && pnpm start` serves the same page.
- [ ] The response carries `X-Robots-Tag: noindex, nofollow`, the CSP, and
      `X-Content-Type-Options: nosniff`.
- [ ] The run block's commands still match the desktop repository's README,
      word for word.
