# AGENTS

## Docs

[Contributor documentation](contributing/README.md) — encoding/decoding/patching/versioning (AutoEncoder, patchable arrays/maps), vue-app-navigation views, writing endpoints, database storage, sending requests, local storage. Read the relevant guide and owning API docstrings before starting — do not guess. Reusable library guides are linked from the contributor documentation. Ask if something is unclear and not documented.

## Structure & architecture

pnpm monorepo (Lerna + workspaces). Node.js + TypeScript backend · Vue 3 + Vite + Capacitor frontend.

- `shared/*` — packages used by frontend + backend. `shared/structures` (`@stamhoofd/structures`) defines all data structures as versioned AutoEncoders (`@simonbackx/simple-encoding`): the single source of truth for API bodies and localStorage. `shared/locales` — i18n.
- `backend/app/*` — `api` (main API server), `renderer`, `backup`, `redirecter`. `backend/shared/*` — backend-only packages (`models` = database models, `sql`, `email`, ...).
- `frontend/app/*` — `dashboard`, `registration`, `webshop`, `mobile` SPAs. `frontend/shared/*` — shared frontend packages. Navigation uses `@simonbackx/vue-app-navigation`.
- `tests/playwright` — E2E tests.

Read the [endpoint guide](contributing/backend/endpoints.md) before changing backend endpoints, including its architecture, authorization, and testing requirements.

### Translations

Follow the [translation conventions](contributing/frontend/translations.md) for user-facing text and errors. Keep new `$t(...)` strings in Dutch; do not edit `shared/locales/src/nl.json`.

## Rules

- Read and follow the [development guidelines](contributing/development-guidelines.md) for coding conventions, imports, testing expectations, and validation.
- **Never modify `@stamhoofd/structures` without first reading [Stamhoofd's versioning policy](contributing/structures/versioning.md) and the linked library versioning guide.** Structures are versioned so old clients keep working; a change ripples across the whole codebase.
- **Never change files unrelated to your current task.**
- For bugfixes: write a test that reproduces the bug, verify it fails before the fix and passes after.
- Always run all linting, typechecking and tests before considering your work done.

## Build ordering

Read the [build-system guide](.development/README.md) when changing build configuration or investigating stale outputs. Packages consume built `dist/` output, not source; rebuild shared packages before using consumers. `pnpm stam test` manages its own prerequisite builds.

`pnpm stam dev` runs API, renderer, statistics syncer, web-app, and webshop development scripts through explicit Turbo filters. These tasks are persistent and uncached. Development uses Turbo's loose environment mode so the CLI-generated backend, frontend, and Stripe environment reaches package processes. The docs server remains a direct Nuxt process because it does not consume shared build output.

`pnpm stam build` builds shared packages, then those same five executable app owners through explicit uncached Turbo filters. Dashboard and registration are source packages bundled by web-app, not standalone build owners. `pnpm run build:backend:apps` explicitly builds API, renderer, backup, redirecter, and statistics syncer. Migrations run the API and statistics-syncer owners explicitly and serially.

`pnpm stam` first runs cached Turbo builds for the CLI and its dependencies through `.development/stam.mjs`. When `devops/tsconfig.cli.json` exists, it also runs the cached root `build:stam-devops` task; `devops` remains a separate repository outside the workspace. Successful bootstrap builds are silent; failed builds print diagnostics to stderr. CLI arguments and exit status are preserved. There is no separate `stam-dev` command.

## Commands

From repo root: `pnpm run lint` · `pnpm run typecheck`. Both dispatch every package-owned check through Turbo and remain uncached. `pnpm run lint` forwards `--quiet` to ESLint. **`pnpm stam test` is the one go-to way to run unit tests** — it runs `build:shared` first and only starts an isolated MySQL when a selected package needs one. Prefer it over your own commands; it does all required setup and teardown.

```bash
pnpm stam test unit                 # every unit package (excludes Playwright)
pnpm stam test coverage             # coverage packages with the same isolated MySQL lifecycle
pnpm stam test api                  # one package: api models vies sql statistics-syncer structures renderer redirecter queues utility sgv stdsync object-differ eslint vite-config metabase i18n-uuid cli components networking
pnpm stam test api --coverage       # collect coverage for one package
pnpm stam test unit SomeFile        # filename filter across all packages
pnpm stam test structures bundle-discounts          # package + filename filter
pnpm stam test structures -t 'partial test name'    # package + test-name filter (-t → vitest -t)
pnpm stam test api --skip-build     # skip the automatic build:shared
pnpm stam test api --clear          # reset the test database (drop its volume) before running
```

For running tests, your sandbox needs permission to open ports.

The DB MySQL container is shut down after each run, but its data volume persists (per worktree) so migrations aren't reinitialized every time — use `--clear` for a clean database.

**Never hand-roll test infrastructure.** The isolated MySQL, migrations, `build:shared`, and env are all provisioned by `pnpm stam test` — don't spin up Docker, create databases, run `build:shared`, or set `DB_PORT`/env vars yourself. If it doesn't work, STOP and ask the user. Tests use **Vitest**; `api`, `models`, `sql`, `statistics-syncer`, and `vies` need MySQL. `components` and `networking` are vitest browser-mode tests and need a Playwright Chromium (`pnpm exec playwright install chromium`). The frontend dashboard/web-app "test" is a `vue-tsc` typecheck (run via `pnpm run typecheck`); UI behavior is covered by Playwright.

### Playwright

Run ONLY via `pnpm stam test e2e`, never invoke or build Playwright manually:

- `pnpm stam test e2e` — full build + suite
- `pnpm stam test e2e --grep @tag` — only tests matching a name/tag (playwright `--grep`)
- `pnpm stam test e2e --grep @tag --skip-build` — same, but skip `build:shared` + the API/frontend rebuild when only test files changed since the last run
- `pnpm stam test e2e --local-db` — connect to the MySQL already running on `127.0.0.1:3306` (port: `STAMHOOFD_E2E_MYSQL_PORT`) instead of starting MySQL containers

E2E setup uses an uncached Turbo task filtered to `@stamhoofd/web-app` and `@stamhoofd/webshop` for the two `build:playwright` bundles. The API build, migrations, Caddy, SSO, database setup and Playwright runner remain owned by `stam test e2e`.

Never use different commands to run tests. On environment issues (domains don't resolve, SSL errors, blank pages): STOP and ask the user to fix it.

# Writing style

- Keep responses focused, brief, and concise. Avoid metaphors and buzzwords.
- Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
