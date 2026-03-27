# AGENTS.md

## Quick Start Loop

For every task, follow this canonical iteration cycle:

1. Read relevant docs in [Notion](https://www.notion.so/Getting-started-20cc403f36798075b190c84c2c21d1ec) before writing any code
2. Make your changes
3. Run a scoped build and `yarn typecheck` and `yarn lint` to catch errors early
4. When done, run the full validation flow (see Validation)

---

## Commands

### Installing

```bash
yarn install        # Install all dependencies
```

### Building

```bash
yarn build:shared         # Build all shared packages (run after modifying any shared package)
yarn build:global:shared  # Build global shared packages only (excludes backend shared packages)
```

Prefer the yarn dev:build command to make sure shared packages are also built when building a backend or frontend app.

```bash
yarn dev:build --scope @stamhoofd/backend      # Builds shared + API backend only
yarn dev:build --scope @stamhoofd/dashboard    # Builds shared + Dashboard frontend only
```

> **Rule of thumb**: when changing a shared package, always run `yarn build:shared` first,
> then your scoped app build. Running only the app build on a stale shared package causes
> confusing errors.

### Type checking & linting

```bash
yarn typecheck      # Run all TypeScript typechecks in the frontend
yarn lint           # Run all linters (fix errors before committing)
```

### Testing

```bash
yarn test                    # All unit/integration tests (vitest), project-wide
yarn test:playwright         # E2E tests — run only after all other tests pass
```

Run a single test file or filter by name:

```bash
cd backend/app/api
yarn test GetGroupsEndpoint.test.ts
yarn test --testNamePattern="test name"
yarn test GetGroupsEndpoint.test.ts --testNamePattern="test name"
```

To simulate environment conditions in tests, use `TestUtils.setEnvironment(...)`.
---

## Validation Flow

Run this sequence in order when your changes are complete. Start over if you make further changes.

| Step | Command | Notes |
|------|---------|-------|
| 1. Full build | `yarn dev:build` | Fix all build errors before proceeding |
| 2. Lint | `yarn lint` | Linting errors on broken code are misleading — always build first |
| 3. Unit tests | `yarn test` | Fix failures before running E2E |
| 4. E2E tests | `yarn test:playwright` | Only once everything above is green |

If tests fail in module internals or during loading, **assume a stale build** before assuming
a code bug. Re-run `yarn build:shared` or the relevant scoped build and retry. If needed,
undo your changes and run tests again to confirm whether the failure is pre-existing.

If a test failure seems random, retry until it passes at least once. **Newly written tests
must never fail randomly.**

---

## Project Structure

Stamhoofd is a yarn monorepo:

```
stamhoofd/
├── backend/
│   ├── app/
│   │   ├── api/          # Main API server
│   │   ├── renderer/     # Document renderer
│   │   ├── backup/       # Backup service
│   │   └── redirecter/   # URL redirector
│   └── shared/           # Backend-only packages
│       ├── models/       # Database models
│       ├── sql/          # SQL helpers
│       ├── email/        # Email handling
│       └── ...
├── frontend/
│   ├── app/
│   │   ├── dashboard/    # Main dashboard SPA
│   │   ├── registration/ # Registration SPA
│   │   ├── webshop/      # Webshop SPA
│   │   └── mobile/       # Mobile app
│   └── shared/           # Frontend-only packages
├── shared/               # Shared packages (frontend + backend)
│   ├── structures/       # Data structures (AutoEncoders)
│   ├── utility/          # Utilities
│   ├── locales/          # i18n translations
│   └── ...
└── tests/
    └── playwright/       # E2E tests
```

**Stack**: Node.js + TypeScript backend (custom router, not Express) · Vue.js 3 + Vite +
Capacitor frontend.

---

## Rules

### ✅ Do

- Read all relevant Notion docs before starting. Refer to them when something is unclear — do not guess.
- Write tests for all backend endpoint changes (unit + integration).
- Write Playwright tests for new UI views, covering the most important happy-path flow.
- Tag Playwright tests for important edge cases that can't be covered by vitest component tests with `@extra`.
- Use `TestUtils.setEnvironment(...)` to simulate different environments in tests.
- Be creative with tests: cover as many situations as possible with as few tests as possible, without writing gigantic single tests.
- For bugfixes: write a test that reproduces the bug, then verify it fails before the fix and passes after.
- Ask if something is unclear and not documented in Notion.

### 🚫 Don't

- **Never modify `package.json` files.** If you think this is necessary, you are likely on the wrong track — stop and reconsider.
- **Never modify `@stamhoofd/structures` without first reading the versioning documentation in Notion.** This package has strict versioning rules.
- **Never change files unrelated to your current task.**

---

## Code Style

### Formatting

- **Indentation**: 4 spaces (not tabs)
- **Quotes**: Single quotes, except when avoiding escape (e.g. `"it's"`)
- **Semicolons**: Always required

### Naming

| Thing | Convention | Example |
|-------|-----------|---------|
| Classes | PascalCase | `MemberDetails`, `InvoiceItem` |
| Functions / variables | camelCase | `getUser`, `decodeData` |
| Vue components | PascalCase | `HelloWorldView.vue` |
| Vue views | PascalCase + `View` suffix | `MemberDetailView.vue` |
| Test files | `*.test.ts` | `GetGroupsEndpoint.test.ts` |

For component and view naming conventions, see [Views and navigation](https://www.notion.so/Views-and-navigation-Vue-App-Navigation-20cc403f367980219dede4fb44a4251f).

### Vue code

Consult [Views and navigation](https://www.notion.so/Views-and-navigation-Vue-App-Navigation-20cc403f367980219dede4fb44a4251f) when creating new views.

### Imports

```ts
// ✅ Import from the same package, higher in the folder tree
import { Foo } from '#components/Foo.js';

// ✅ Import from another package (note: skip 'src/', no extension needed for .ts)
import { Bar } from '@stamhoofd/package-name/components/Bar';

// ✅ Vue files always need the extension
import MyView from '@stamhoofd/package-name/views/MyView.vue';

// 🚫 Never create, extend, or reference barrel files (legacy pattern)
```

### Localization

- All user-facing strings must use `$t(...)`:
  ```ts
  $t('Hallo wereld')
  $t('Welkom {firstName},', { firstName: user.firstName })
  ```
- Always write new $t's in **Dutch**.
- The build system replaces all `$t('...')` calls with `$t('%XYZ')` — do not do this manually.
  Look up translations in `shared/locales/src/nl.json` if you encounter `%XYZ` keys.
- `SimpleError.message` → English, **not** translated with `$t`.
- `SimpleError.human` → Dutch, translated with `$t`.
- Test names and code comments → English.

---

## Common Issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tests fail on module load or internals | Stale build | Run `yarn build:shared` then your scoped build |
| Type errors after changing shared package | Shared package not rebuilt | `yarn build:shared` |
| Confusing errors after `yarn dev:build` | Shared dependency out of date | `yarn build:shared` first, then `yarn dev:build` |
| Lint errors on code that doesn't compile | Built with errors | Fix build errors before running lint |
| Cached code or files keep running | Cache issue | run `yarn clear && yarn clear-vite-cache && yarn && yarn build:shared` again |
