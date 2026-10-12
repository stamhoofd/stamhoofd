# Contributing

See the [root README](README.md#contributing) for the contribution process and [developer documentation](README.md#developer-documentation) for the project's building blocks.

## Coding conventions

- Write test names, methods, properties, and code comments in English.
- Follow the [translation conventions](README.md#localizations-and-translations) for user-facing text and errors.
- Before changing `@stamhoofd/structures`, read the versioning documentation linked from its [README](shared/structures/README.md). Preserve compatibility with older clients.
- Keep comments short and explain only what the code cannot: a non-obvious invariant, external constraint, or gotcha. Design decisions and explanations of what a change moved or replaced belong in the PR description. Apply this standard to code touched by the contribution.

### Imports

Prefer modern package exports and imports in `package.json`:

```ts
// Same package, higher in the folder tree
import { Foo } from '#components/Foo.js';

// Other package: omit src/ and the .ts extension
import { Bar } from '@stamhoofd/package-name/components/Bar';

// Vue files always need the extension
import MyView from '@stamhoofd/package-name/views/MyView.vue';
```

Never create, extend, or reference barrel files; they are a legacy pattern.

## Testing expectations

- Write unit and integration tests for all backend endpoint changes.
- Add Playwright coverage for the most important happy path of new UI views.
- For bugfixes, add a regression test and verify it fails before the fix and passes afterward.
- Cover many situations with a few focused tests rather than gigantic single tests.

See [backend testing](backend/app/api/README.md#testing) and [Playwright documentation](tests/playwright/README.md) for test-writing guidance.

## Validation

Always prefer `stam` over lower-level scripts or commands. If the shortcut is not installed, use `pnpm stam` from the repository root. See the [CLI README](shared/cli/README.md) for setup, command options, and troubleshooting.

Run all linting, typechecking, and tests before considering a contribution complete:

```bash
stam check all
```

This builds the applications, then runs lint, typecheck, unit tests, and E2E tests. For individual checks during development:

```bash
stam check lint
stam check typecheck
stam test api
stam test e2e
```

Always run tests through `stam test`; it owns builds, isolated databases, migrations, environment configuration, and teardown. See the [test command reference](shared/cli/README.md#tests) for package selection, filters, and prerequisites.
