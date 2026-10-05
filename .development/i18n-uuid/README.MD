# Translation library

This package provides source-text extraction, translation-key processing, machine translation, and repair functions. The Stamhoofd CLI owns its commands; there is no separate command runner here.

## Workflow

During development, write Dutch `$t('Opslaan')` strings and commit them unchanged. Do not manually edit `shared/locales/src/nl.json`.

Before releasing, run from the repository root:

```bash
pnpm stam translate auto
```

This runs key registration → duplicate/unused-key cleanup → machine translation. Review and commit generated changes separately. Bare `translate` only shows help. Use `--locale fr`, `--provider openai`, `--no-machine`, or `--yes` as needed.

Individual stages are `translate manual keys`, `manual cleanup`, and `manual machine`. Optional source migration and unchanged-translation review are separate:

```bash
pnpm stam translate manual source --changes --dry-run
pnpm stam translate manual source --changes --prompt --fix
pnpm stam translate manual review --dry-run
pnpm stam translate manual review
```

Source and review previews do not write translation/source files or processing caches. Key processing supports `$t(...)` in TypeScript/Vue and `{{$t "..."}}` in Handlebars (`.hbs`, `.hbs.html`). Specialist repair tools are listed by `translate maintenance`. Legacy comparison output repeats the same saved translation under every provider label; it does not compare independent AI results.

See [the CLI documentation](../../shared/cli/README.md#translations) or run `pnpm stam translate --help` for details. `pnpm stam` builds this library and the CLI first, using Turbo's local cache for unchanged builds.

## Credentials

Set `OPENAI_API_KEY`, `GEMINI_API_KEY`, or `MISTRAL_API_KEY` in `.development/i18n-uuid/.env` or your environment. Supported provider names are `openai`, `gemini`, `mistral-large`, and `mistral-small`; Claude is not implemented here.

Run this package's tests with `pnpm stam test i18n-uuid`.
