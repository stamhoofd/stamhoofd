# AGENTS

## Docs

https://app.notion.com/p/Getting-started-20cc403f36798075b190c84c2c21d1ec — encoding/decoding/patching/versioning (AutoEncoder, patchable arrays/maps), vue-app-navigation views, writing endpoints, database storage, sending requests, local storage. Read the relevant docs before starting — do not guess. Ask if something is unclear and not documented in Notion.

## Structure & architecture

Yarn monorepo (Lerna + workspaces). Node.js + TypeScript backend · Vue 3 + Vite + Capacitor frontend.

- `shared/*` — packages used by frontend + backend. `shared/structures` (`@stamhoofd/structures`) defines all data structures as versioned AutoEncoders (`@simonbackx/simple-encoding`): the single source of truth for API bodies and localStorage. `shared/locales` — i18n.
- `backend/app/*` — `api` (main API server), `renderer`, `backup`, `redirecter`. `backend/shared/*` — backend-only packages (`models` = database models, `sql`, `email`, ...).
- `frontend/app/*` — `dashboard`, `registration`, `webshop`, `mobile` SPAs. `frontend/shared/*` — shared frontend packages. Navigation uses `@simonbackx/vue-app-navigation`.
- `tests/playwright` — E2E tests.

Backend uses a custom router (`@simonbackx/simple-endpoints`), **not Express**: each endpoint is a class in `backend/app/api/src/endpoints/**` with typed input decoders, returning structures. Errors use `@simonbackx/simple-errors`. Endpoints translate between database models and structures.

### Translations

- All user-facing strings use `$t(...)`, written in **Dutch**: `$t('Welkom {firstName},', { firstName: user.firstName })`
- The build system replaces `$t('Iets in het Nederlands')` with `$t('%XYZ')` on release. So you can find both patterns in the codebase. You can look `%XYZ` keys up in `shared/locales/src/nl.json`.
- Write new text by wrapping it with $t(...) (keep it in Dutch). e.g. $t('Opslaan'). Keep it like that in your commits. The build script will replace this later in separate commits on release with % prefixed keys.
- Do not alter `shared/locales/src/nl.json`. If text needs changes, replace the existing $t with a new one with the new Dutch text. Our scripts will deduplicate and merge as required on release.
- `SimpleError.message` should not use $t. It should be plain text in English. `SimpleError.human` on the other hand should use `$t` and is translated automatically.
- Test names, methods, properties and code comments should be in English.

## Rules

- **Never modify `@stamhoofd/structures` without first reading the versioning documentation in Notion.** Structures are versioned so old clients keep working; a change ripples across the whole codebase.
- **Never change files unrelated to your current task.**
- Write tests for all backend endpoint changes (unit + integration), and Playwright tests for new UI views (most important happy path). Cover many situations with few tests, without gigantic single tests. Use `TestUtils.setEnvironment(...)` to simulate environments.
- For bugfixes: write a test that reproduces the bug, verify it fails before the fix and passes after.

## Build ordering (the #1 source of confusing errors)

Packages consume each other's **built `dist/` output**, not source. After changing a shared package, consumers see stale code until you run `yarn build:shared`. Almost every "type error after editing a shared package", "test fails on module load", or "cached code keeps running" is fixed by running it first. Full reset when badly out of sync:

```bash
yarn clear && yarn clear-vite-cache && yarn && yarn build:shared
```

## Commands

From repo root: `yarn lint` · `yarn typecheck` · `yarn test` (all unit tests, excludes Playwright; `yarn stam test unit` provisions an isolated MySQL). Prefer these scripts over your own commands — they do required setup and teardown.

**Never hand-roll test infrastructure.** The isolated MySQL, migrations, and env are already provisioned by `yarn stam test unit` (and per-package `yarn test`) — don't spin up Docker, create databases, or set `DB_PORT`/env vars yourself. Run a single file via the existing scripts (`yarn stam test unit path/to/Foo.test.ts`). If they don't work, STOP and ask the user.

Tests use **Vitest**, run scoped per package: `cd backend/app/api && yarn test`, or `yarn vitest run path/to/Foo.test.ts` / `yarn vitest run -t 'partial name'`. Backend tests run against a real MySQL test database. The frontend dashboard "test" is a `vue-tsc` typecheck only; UI behavior is covered by Playwright.

### Playwright

Run ONLY via these scripts, never invoke or build Playwright manually:

- `yarn test:playwright` — full build + suite (optionally `--grep @tag`)
- `yarn test:playwright:skip-build --grep @tag` — when only test files changed since the last run

On environment issues (domains don't resolve, SSL errors, blank pages): STOP and ask the user to fix it.

### Imports

Prefer modern exports and imports in package.json.

```ts
// ✅ Same package, higher in the folder tree
import { Foo } from '#components/Foo.js';

// ✅ Other package (skip 'src/', no extension for .ts)
import { Bar } from '@stamhoofd/package-name/components/Bar';

// ✅ Vue files always need the extension
import MyView from '@stamhoofd/package-name/views/MyView.vue';

// 🚫 Never create, extend, or reference barrel files (legacy pattern)
```
