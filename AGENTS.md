# AGENTS

## Required reading

- Read [CONTRIBUTING.md](CONTRIBUTING.md) before making changes. Follow its coding conventions, testing expectations, and validation requirements.
- Read the relevant documentation before starting; do not guess. Ask if something is unclear or undocumented:
  - [Repository structure and translations](README.md)
  - [Development CLI, commands, and troubleshooting](shared/cli/README.md)
  - [Build system](.development/README.md) when changing build configuration or investigating stale outputs
  - [Backend endpoints](backend/app/api/README.md) and [Playwright tests](tests/playwright/README.md) when working in those areas
  - [Notion developer documentation](https://app.notion.com/p/Getting-started-20cc403f36798075b190c84c2c21d1ec) for encoding, patching, versioning, navigation, endpoints, database storage, requests, and local storage
- Never modify `@stamhoofd/structures` without first reading the versioning documentation in Notion.

## Scope and verification

- Never change files unrelated to the current task.
- For bugfixes, verify a regression test fails before the fix and passes afterward.
- Run all linting, typechecking, and tests before considering the work done, following the contributor validation instructions. Report any checks that could not complete.

## Command execution

- Always prefer `stam` over lower-level scripts or commands. Use `pnpm stam` from the repository root when the `stam` shortcut is unavailable.
- Run tests only through `stam test`, including `stam test e2e` for Playwright. Never invoke or build test runners manually.
- Never hand-roll test infrastructure. Let `stam test` provision shared builds, MySQL, migrations, and environment variables; do not separately start Docker containers, create databases, build shared packages, or override database environment variables for tests.
- The test sandbox needs permission to open ports.
- If the managed test infrastructure fails, or environment issues prevent tests from running (DNS, SSL, blank pages), stop and ask the user to fix the environment.

## Writing style

- Keep responses focused, brief, and concise. Avoid metaphors and buzzwords.
- Match the length of written documents to what the task needs; avoid filler sections, redundant summaries, and boilerplate.
