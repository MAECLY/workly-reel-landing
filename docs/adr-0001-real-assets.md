# ADR 0001: every asset on the page is real

- **Status:** accepted
- **Date:** 2026-08-24
- **Applies to:** `public/assets/`, `components/AssetFigure.tsx`, `scripts/check-content.ts`

## Context

WorklyReel is a Developer Proof-of-Work tool. Its entire claim is that what it
publishes about your week can be traced back to evidence that actually exists.
A landing page for that product is not a neutral surface: it is the first
artefact a reader judges the claim by.

Three shortcuts were available and all three were rejected.

1. **A reconstructed screenshot.** Rebuild the application interface in HTML so
   the "screenshot" is styleable, always crisp, and easy to keep current.
2. **A designed export.** Draw the 1080 by 1350 card in a design tool, where the
   typography can be nudged until it looks better than the compositor's output.
3. **A representative mock-up.** Show a plausible interface that no build has
   ever produced, on the grounds that the real one is not finished enough.

Each one produces a better-looking page. Each one also makes the page a claim
the repository cannot support.

## Decision

**Every image on this page is produced by a build of the product, and is
registered in `public/assets/manifest.json` before it may be rendered.**

The manifest is the only register. It records, per asset:

| Field                                 | Why it is recorded                                                          |
| ------------------------------------- | --------------------------------------------------------------------------- |
| `file`                                | The only path a component may reference                                     |
| `kind`                                | `screenshot` for the running application, `export` for compositor output    |
| `caption`                             | What the picture shows, in the page's own words                             |
| `alt`                                 | The accessible description, written once and never rewritten at a call site |
| `width`, `height`                     | The true pixel size, so the layout reserves the right box                   |
| `bytes`, `sha256`                     | The identity of the file, so a swapped image is detectable                  |
| `capturedFrom`                        | The exact build the picture came from                                       |
| `dataPolicy`                          | `synthetic`, asserting that no private data is shown                        |
| `fictionalProject`, `fictionalAuthor` | The invented names the fixture uses                                         |
| `approved`                            | An explicit gate, checked before render                                     |

`generatedFrom` records the desktop commit and the design-system commit, so a
reviewer can pin both and produce the same pictures.

Three mechanisms enforce it:

- `content/assets.ts` reads the manifest, refuses an unknown `kind`, refuses an
  unapproved entry, and refuses an entry with blank alt text. `realAsset()`
  throws on a path the manifest does not describe, so a typo fails the build
  rather than rendering a broken image.
- `components/AssetFigure.tsx` is the only component that renders an image. It
  takes a manifest path, and draws the alt text, the caption, the dimensions,
  the byte size, the hash prefix, and the originating build from the manifest.
  A caller cannot relabel a figure.
- `scripts/check-content.ts` fails on any `/assets/…` media reference, in source
  or in the built HTML, that the manifest does not list, and on any `<img>` with
  no alt text. `tests/content.test.ts` re-hashes each file on disk and compares
  it to the manifest, so a reconstructed replacement is caught even if it keeps
  the same filename.

## Consequences

**Accepted costs.**

- The screenshots show a Phase 0 interface with Phase 0 rough edges. That is the
  product, so that is the picture.
- Refreshing an asset means running the application, capturing again, and
  updating the manifest, including the hash. There is no faster path on purpose.
- The page cannot show a capability before it exists. A section describing an
  unshipped feature would have no asset to render, which is the correct outcome.

**What this buys.**

- The differentiator is demonstrated rather than asserted. `screenshot-evidence-review.png`
  shows a real source reporting activity as unknown instead of zero, which is a
  distinction a drawn mock-up would have flattened.
- The export is shown at the size the compositor writes, so the claim "the
  compositor renders every word" is checkable by looking at it.
- Privacy is provable. Every asset uses the synthetic Harbour Ledger fixture and
  the fictional author A. Rivera, so no real repository, employer, path, or
  person appears in a published example, and the manifest says so per file.

## Alternatives considered

**A video or an animated capture.** Rejected for Phase 0. "Reel" in this product
means a curated highlight reel of development work and never implies video; an
animated hero would fight the identity. It is also a second asset pipeline with
no manifest equivalent yet.

**Rendering the export live in the browser.** The design system ships
`SocialTemplatePreview`, so the card could be composed client-side. Rejected: it
would show what the browser preview produces, not what the Rust compositor
wrote, and the whole point of the section is the second one. The preview and the
compositor read the same template definition precisely so that drift is
detectable; a page that only ever shows the preview could not detect it.
