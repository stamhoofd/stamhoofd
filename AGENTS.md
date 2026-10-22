# AGENTS

## Required reading

- Read and follow the [development guidelines](contributing/development-guidelines.md) for coding conventions, imports, testing expectations, and validation.
- Start with the [contributor documentation](contributing/README.md) and read the relevant guide and owning API docstrings before changing code. Reusable library guides are linked there. Do not guess; ask if something is unclear or undocumented.
- Read the relevant operational documentation:
  - [Repository structure](README.md#folder-structure) for package ownership and the application stack
  - [Development CLI](shared/cli/README.md) for commands, app ownership, bootstrap, and troubleshooting
  - [Build configuration](shared/cli/README.md#development-configuration) for shared-build ordering and application startup
  - [Backend endpoints](https://github.com/SimonBackx/simple-endpoints/blob/master/docs/endpoints.md) and [Playwright tests](tests/playwright/README.md) when working in those areas
  - [Translations](contributing/frontend/translations.md) for user-facing text and errors; keep new `$t(...)` strings in Dutch and do not edit `shared/locales/src/nl.json`
- Never modify `@stamhoofd/structures` without first reading [Versioning data](https://github.com/SimonBackx/simple-encoding/blob/master/docs/versioning.md).

## Scope and verification

- Never change files unrelated to the current task.
- For bugfixes, verify a regression test fails before the fix and passes afterward.
- Run all linting, typechecking, and tests before considering the work done. Follow the [development guidelines](contributing/development-guidelines.md) and [test command reference](shared/cli/README.md#tests). Report any checks that could not complete.

## Command execution

- Always prefer `stam` over lower-level scripts or commands. Use `pnpm stam` from the repository root when the shortcut is unavailable.
- Run tests only through `stam test`, including `stam test e2e` for Playwright. Never invoke or build test runners manually.
- Never hand-roll test infrastructure. Let `stam test` provision shared builds, MySQL, migrations, and environment variables; do not separately start Docker containers, create databases, build shared packages, or override database environment variables for tests.
- The test sandbox needs permission to open ports.
- If managed test infrastructure fails, or environment issues prevent tests from running (DNS, SSL, blank pages), stop and ask the user to fix the environment.

## Writing style

- Keep responses focused, brief, and concise. Avoid metaphors and buzzwords.
- Avoid adding comments in code that are obvious or are not useful to other people in the future.
- Match the length of written documents to what the task needs: cover the substance, but do not pad with filler sections, redundant summaries, or boilerplate.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
