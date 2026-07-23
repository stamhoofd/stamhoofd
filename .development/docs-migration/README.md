# Migrate documentation from Ghost to in-repo Docus content

Converts a Ghost JSON export into Docus (Nuxt Content) markdown under `docs/content/`.

## Internal working

The migration script tries to bridge the mismatch between Ghost's flat hierarchy and Nuxt's enforced hierarchy.

Published posts are grouped by their primary tag into numbered section folders
(`content/<n>.<tag>/<m>.<slug>.md`) with a `.navigation.yml` per section, so they
appear as sidebar groups. Ghost `kg-*` cards are converted to Markdown/MDC
(callouts become `::note` / `::tip` / `::warning`). Re-running overwrites files.

Every upload is downloaded into `docs/public/` (same year/month layout as
Ghost): images into `images/`, video and audio into `media/`, and linked
documents into `files/`. They are referenced as `/images/...`, `/media/...` and
`/files/...`, so nothing is loaded from the old site anymore. Links that point
somewhere other than a Ghost upload stay as they are.

Each image gets its intrinsic size as MDC attributes
(`![](/images/x.png){width="1200" height="800"}`); without them the docs site
stretches every image to the full column width, which upscales small
screenshots. Files that already exist on disk are not downloaded again.

The Ghost `custom_excerpt` becomes the page `description`, and when it is also
the opening paragraph of the post that paragraph is dropped — the docs site
renders the description above the body itself. Posts without an excerpt get an
empty `description`, because Nuxt Content otherwise falls back to the first
paragraph and shows it twice.

## Usage

From the repo root through the stam CLI:

```bash
yarn stam docs migrate ~/Downloads/ghost-export.json
```

Add `--clean` to start from an empty content tree (removes everything under
`content/` and the downloaded `public/{images,media,files}/`) before writing:

```bash
yarn stam docs migrate ~/Downloads/ghost-export.json --clean
```

Pass `--clean` **without** an export path to only clean, without re-importing:

```bash
yarn stam docs migrate --clean
```

Cleaning asks for confirmation first; pass `--yes` (`-y`) to skip the prompt (e.g. for scripts)

> Note: routes become `/<tag>/<slug>` (grouped) instead of Ghost's flat `/<slug>`.
