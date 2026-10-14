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

## Commands

Always prefer `stam` over lower-level scripts or commands. Use `pnpm stam` from the repository root when the shortcut is unavailable. Read the [CLI guide](shared/cli/README.md) for commands, app ownership, bootstrap, and troubleshooting.

Run tests only through `stam test`, including `stam test e2e` for Playwright. Never invoke or build test runners manually. See the [test command reference](shared/cli/README.md#tests) for package selection, filters, and prerequisites.

For running tests, your sandbox needs permission to open ports.

**Never hand-roll test infrastructure.** Let `stam test` provision shared builds, MySQL, migrations, and environment variables; do not separately start Docker containers, create databases, build shared packages, or override database environment variables for tests. If managed test infrastructure fails, stop and ask the user to fix the environment.

### Playwright

Read the [Playwright guide](tests/playwright/README.md) before changing E2E tests. Run them only through `pnpm stam test e2e`.

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
