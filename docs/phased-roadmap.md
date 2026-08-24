# Phased roadmap for the landing page

Everything on this page after the Phase 0 section is **backlog**. None of it is
implemented, and nothing in this repository may present it as shipped.

The landing page follows the desktop application's phases. It never announces a
capability before the product has it, so most of the work below is blocked on
the desktop repository rather than on this one.

## Phase 0: shipped

The whole of what this repository contains.

- One English route, `/`, with five sections and a run block.
- Three real assets, registered in `public/assets/manifest.json`, rendered
  through one component that reads their provenance from that manifest.
- Content as typed TypeScript in `content/`, centralised so a translator is
  handed one directory.
- The Day, Week, and Custom Range copy derived at build time from the shipped
  `buildActivityWindow` contract, including its real refusal messages.
- Dark and light, both driven by the design system's `data-theme` and its
  `--wr-*` custom properties. No colour is authored in this repository.
- `scripts/check-content.ts`, wired to `pnpm content:check`, with its own
  regression suite.
- Vitest coverage of the sections, the metadata, the assets, the anchors, and
  both themes.
- `robots: { index: false, follow: false }`, an `X-Robots-Tag` header, and a
  sitemap rooted at the canonical origin.
- A not-found route in the same visual system.

## Phase 1: localisation

**Not shipped. There is one locale and no routing for a second.**

- Spanish alongside English. `content/` already passes strings whole rather than
  assembling them from fragments, which is the precondition, but there is no
  message catalogue, no locale negotiation, and no `hreflang`.
- Locale-aware routing (`/` and `/es`), with a canonical per locale.
- A translated `alt` and `caption` per asset. The manifest carries one language
  today and would need a per-locale field rather than a translated copy of the
  file.
- Date and number formatting per locale. The window examples currently render
  ISO dates, which are locale-neutral by luck rather than by design.

## Phase 2: more of the site

**Not shipped. There is exactly one route.**

- A changelog route, driven by real release notes rather than by marketing copy.
- A privacy route, restating the desktop threat model for a reader who has not
  installed anything.
- A documentation route, or a decision to point at the repository instead.
- A press or brand route with the lockup, the clear space rule, and the
  endorsement lockup as downloadable files. This needs the asset manifest to
  describe non-screenshot assets, which it currently does not.

## Phase 3: release manifests and distribution

**Not shipped, and blocked on the desktop repository.**

- A download for a signed, notarised build. Phase 0 produces an unsigned build
  for the machine that built it and nothing else, so there is nothing to link
  to and the page deliberately has no download.
- A release manifest the page can read, so a version number on the page is a
  fact rather than a string someone edited.
- Checksums and release notes rendered from that manifest.
- Platform availability, stated per platform only after a build and the test
  suite have actually run there. See the desktop repository's
  `docs/platform-support.md`.

## Phase 4: forms and anything that collects

**Not shipped. The page collects nothing, and the linter fails the build if a
form element appears.**

- A contact route. This needs a data controller, a retention policy, and a
  privacy notice before it needs a form.
- Any signup, waitlist, or newsletter. None is planned for a product whose
  posture is that nothing leaves your machine; if one is ever added, the posture
  has to be restated honestly rather than quietly.
- Spam and abuse handling, which is the real cost of the first form.

## Phase 5: analytics

**Not shipped. There is no script, no pixel, and no cookie.**

- Privacy-respecting, opt-in measurement, matching the desktop application's
  Phase 4 position on telemetry.
- A cookie and consent posture, written before anything is measured rather than
  after.
- The current content linter fails on a known analytics marker in the built
  HTML, and that check would have to be relaxed deliberately.

## Phase 6: performance hardening

**Not shipped in any measured sense.**

Phase 0 is a static prerender with no client-side data fetching, two client
components, and self-hosted fonts, which is a reasonable starting point. It has
not been measured, and this page publishes no performance number precisely
because none has been.

- A Lighthouse or Core Web Vitals budget, enforced in CI.
- Responsive `srcset` generation tuned to the real breakpoints rather than to
  the framework defaults.
- A font subsetting pass. Geist Sans and IBM Plex Mono ship complete.
- A decision about whether the scroll-driven reveal earns its bytes.

## Phase 7: indexing and launch

**Not shipped, and deliberately so.**

- Removing `robots: { index: false, follow: false }` and the `X-Robots-Tag`
  header. This is the last switch, not the first: the page describes a proof of
  concept, and an indexed result outlives the phase that produced it.
- Structured data, once there is a product entity worth describing.
- A custom domain verified on the production origin, with the certificate and
  the redirect from the deployment URL settled.
- A claim review against the desktop repository, immediately before the switch
  and again after any copy change.

## Non-goals

Regardless of phase:

- A page that implies the product posts or publishes anywhere on the reader's
  behalf.
- A fabricated metric, a star count, a testimonial, or a customer logo.
- A capability claim about a platform nobody has run the suite on.
- A reconstructed screenshot or a designed export. See
  [`adr-0001-real-assets.md`](adr-0001-real-assets.md).
