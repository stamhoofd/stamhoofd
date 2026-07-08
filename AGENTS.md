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

From repo root: `yarn lint` · `yarn typecheck`. **`yarn stam test` is the one go-to way to run unit tests** — it runs `build:shared` first and only starts an isolated MySQL when a selected package needs one. Prefer it over your own commands; it does all required setup and teardown.

```bash
yarn stam test unit                 # every unit package (excludes Playwright)
yarn stam test api                  # one package: api models sql structures renderer redirecter queues utility sgv object-differ eslint
yarn stam test unit SomeFile        # filename filter across all packages
yarn stam test structures bundle-discounts          # package + filename filter
yarn stam test structures -t 'partial test name'    # package + test-name filter (-t → vitest -t)
yarn stam test api --skip-build     # skip the automatic build:shared
yarn stam test api --clear          # reset the test database (drop its volume) before running
```

The DB MySQL container is shut down after each run, but its data volume persists (per worktree) so migrations aren't reinitialized every time — use `--clear` for a clean database.

**Never hand-roll test infrastructure.** The isolated MySQL, migrations, `build:shared`, and env are all provisioned by `yarn stam test` — don't spin up Docker, create databases, run `build:shared`, or set `DB_PORT`/env vars yourself. If it doesn't work, STOP and ask the user. Tests use **Vitest**; only `api`, `models`, and `sql` need MySQL. The frontend dashboard/web-app "test" is a `vue-tsc` typecheck (run via `yarn typecheck`); UI behavior is covered by Playwright.

### Playwright

Run ONLY via `yarn stam test e2e`, never invoke or build Playwright manually:

- `yarn stam test e2e` — full build + suite
- `yarn stam test e2e --grep @tag` — only tests matching a name/tag (playwright `--grep`)
- `yarn stam test e2e --grep @tag --skip-build` — same, but skip `build:shared` + the API/frontend rebuild when only test files changed since the last run

Never use different commands to run tests. On environment issues (domains don't resolve, SSL errors, blank pages): STOP and ask the user to fix it.

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
