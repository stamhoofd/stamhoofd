# Migrate documentation from Ghost to in-repo Docus content

Converts a Ghost JSON export into Docus (Nuxt Content) markdown under `docs/content/`.

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
