# AGENTS

## Docs

https://app.notion.com/p/Getting-started-20cc403f36798075b190c84c2c21d1ec — encoding/decoding/patching/versioning (AutoEncoder, patchable arrays/maps), vue-app-navigation views, writing endpoints, database storage, sending requests, local storage. Read the relevant docs before starting — do not guess. Ask if something is unclear and not documented in Notion.

## Structure & architecture

pnpm monorepo (Lerna + workspaces). Node.js + TypeScript backend · Vue 3 + Vite + Capacitor frontend.

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
- Always run all linting, typechecking and tests before considering your work done.

- Comments must make code faster to understand, so keep them short and only document what a reader cannot infer from the code: a non-obvious invariant, an external constraint, a gotcha. **Never comment your own reasoning** — why you chose a design, what the code used to be, what a refactor moved. That belongs in the PR description. Strip such comments when you encounter them.

## Build ordering (the #1 source of confusing errors)

### Turbo task graph

`turbo.json` enables local caching only for shared TypeScript builds. Outputs include `dist/**` (including locales, assets and migrations) and package-root `*.tsbuildinfo`. Root TypeScript configuration and shared global declarations are cache inputs. `.turbo/cache` is local to each checkout; remote caching is not configured.

Shared builds use `^build` for normal dependencies and explicit task dependencies for internal peers and global type declarations. Turbo does not include peer dependencies in `^build`. Frontend source packages have dependency cycles: do not enable `^build` globally. Application builds, Playwright builds, tests, migrations, lint and typecheck are uncached; development tasks are persistent and uncached.

`pnpm run build:shared` runs the shared Turbo graph. For a narrower build use `pnpm exec turbo run build --filter='./shared/*'` or `--filter='./backend/shared/*'`; prerequisites are included automatically. The old `build:global:shared` and `build:backend:shared` aliases have been removed. CI still uploads and downloads `shared-dist`: a checkout-local cache does not transfer outputs between jobs. Other entry points are being migrated in separate steps; Lerna remains installed for releases.

`pnpm stam dev` runs API, renderer, statistics syncer, web-app, and webshop development scripts through explicit Turbo filters. These tasks are persistent and uncached. Development uses Turbo's loose environment mode so the CLI-generated backend, frontend, and Stripe environment reaches package processes. The docs server remains a direct Nuxt process because it does not consume shared build output.

`pnpm run clear:shared` removes build outputs but retains the Turbo cache. To rebuild without reading cache, run `pnpm run clear:shared && pnpm run build:shared --force`. Use `--dry=json` on the build command to inspect task dependencies and cache inputs.

Packages consume each other's **built `dist/` output**, not source. After changing a shared package, consumers see stale code until you run `pnpm run build:shared`. Almost every "type error after editing a shared package", "test fails on module load", or "cached code keeps running" is fixed by running it first. Full reset when badly out of sync:

```bash
pnpm run clear && pnpm run clear-vite-cache && pnpm install && pnpm run build:shared
```

## Commands

From repo root: `pnpm run lint` · `pnpm run typecheck`. Both dispatch every package-owned check through Turbo and remain uncached. `pnpm run lint` forwards `--quiet` to ESLint. **`pnpm stam test` is the one go-to way to run unit tests** — it runs `build:shared` first and only starts an isolated MySQL when a selected package needs one. Prefer it over your own commands; it does all required setup and teardown.

```bash
pnpm stam test unit                 # every unit package (excludes Playwright)
pnpm stam test api                  # one package: api models sql structures renderer redirecter queues utility sgv object-differ eslint cli components networking
pnpm stam test unit SomeFile        # filename filter across all packages
pnpm stam test structures bundle-discounts          # package + filename filter
pnpm stam test structures -t 'partial test name'    # package + test-name filter (-t → vitest -t)
pnpm stam test api --skip-build     # skip the automatic build:shared
pnpm stam test api --clear          # reset the test database (drop its volume) before running
```

For running tests, your sandbox needs permission to open ports.

The DB MySQL container is shut down after each run, but its data volume persists (per worktree) so migrations aren't reinitialized every time — use `--clear` for a clean database.

**Never hand-roll test infrastructure.** The isolated MySQL, migrations, `build:shared`, and env are all provisioned by `pnpm stam test` — don't spin up Docker, create databases, run `build:shared`, or set `DB_PORT`/env vars yourself. If it doesn't work, STOP and ask the user. Tests use **Vitest**; only `api`, `models`, and `sql` need MySQL. `components` and `networking` are vitest browser-mode tests and need a Playwright Chromium (`pnpm exec playwright install chromium`). The frontend dashboard/web-app "test" is a `vue-tsc` typecheck (run via `pnpm run typecheck`); UI behavior is covered by Playwright.

### Playwright

Run ONLY via `pnpm stam test e2e`, never invoke or build Playwright manually:

- `pnpm stam test e2e` — full build + suite
- `pnpm stam test e2e --grep @tag` — only tests matching a name/tag (playwright `--grep`)
- `pnpm stam test e2e --grep @tag --skip-build` — same, but skip `build:shared` + the API/frontend rebuild when only test files changed since the last run
- `pnpm stam test e2e --local-db` — connect to the MySQL already running on `127.0.0.1:3306` (port: `STAMHOOFD_E2E_MYSQL_PORT`) instead of starting MySQL containers

E2E setup uses an uncached Turbo task filtered to `@stamhoofd/web-app` and `@stamhoofd/webshop` for the two `build:playwright` bundles. The API build, migrations, Caddy, SSO, database setup and Playwright runner remain owned by `stam test e2e`.

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

# Writing style

- Keep responses focused, brief, and concise. Avoid metaphors and buzzwords.
- Avoid adding comments in code that are obvious or are not useful to other people in the future.
- Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.
