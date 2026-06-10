# AGENTS


## Docs

https://app.notion.com/p/Getting-started-20cc403f36798075b190c84c2c21d1ec

- Information about encoding, decoding, patching and versioning data (patchable arrays, patchable maps, deepsets, AutoEncoder...)
- View building blocks and API's (vue-app-navigation library)
- Common patterns
- Writing endpoints
- Storing data in the database
- Sendign requests in the frontend
- Storing data locally in the app

## Project Structure

Stamhoofd is a yarn monorepo (Lerna + yarn workspaces):

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
- Use `TestUtils.setEnvironment(...)` to simulate different environments in tests.
- Be creative with tests: cover as many situations as possible with as few tests as possible, without writing gigantic single tests.
- For bugfixes: write a test that reproduces the bug, then verify it fails before the fix and passes after.
- Ask if something is unclear and not documented in Notion.

### 🚫 Don't

- **Never modify `@stamhoofd/structures` without first reading the versioning documentation in Notion.** This package has strict versioning rules: data structures are versioned so old clients keep working against an updated backend, and a change ripples across the whole codebase.
- **Never change files unrelated to your current task.**

---

## Build ordering (the #1 source of confusing errors)

Packages consume each other's **built `dist/` output**, not source (TypeScript `composite` project references). After changing a shared package, consumers see stale code until you rebuild.

```bash
yarn build:shared        # build shared/* then backend/shared/* in dependency order
```

`build:shared` = `build:global:shared` (shared/*) + `build:backend:shared` (backend/shared/*), each built in a hardcoded dependency order (see root `package.json`). Almost every "type error after editing a shared package", "test fails on module load", or "cached code keeps running" is fixed by running `yarn build:shared` first.

Full reset when things are badly out of sync:

```bash
yarn clear && yarn clear-vite-cache && yarn && yarn build:shared
```

### Common Issues

| Symptom | Likely cause | Fix |
|---------|-------------|-----|
| Tests fail on module load or internals | Stale build | Run `yarn build:shared` then your scoped build |
| Type errors after changing shared package | Shared package not rebuilt | `yarn build:shared` |
| Confusing errors after `yarn dev:build` | Shared dependency out of date | `yarn build:shared` first, then `yarn dev:build` |
| Lint errors on code that doesn't compile | Built with errors | Fix build errors before running lint |
| Cached code or files keep running | Cache issue | run `yarn clear && yarn clear-vite-cache && yarn && yarn build:shared` again |

---

## Common commands

Run from the repo root unless noted.

| Task | Command |
|------|---------|
| Lint (all packages) | `yarn lint` |
| Typecheck (all packages) | `yarn typecheck` |
| Unit tests (all, excludes Playwright) | `yarn test` or `yarn stam test unit` |

Avoid running your own commands to do things that are offered by our scripts. Our scripts often do required setup and teardown that is easy to miss.

## Running Playwright tests

Playwright tests MUST be run only via these commands:

- `yarn test:playwright` — full suite and build
- `yarn test:playwright --grep @routing` — filter tests to run
- `yarn test:playwright:skip-build --grep @routing` — use this if you only made changes to your test files since the last run and can reuse the frontend and backend builds.

Never invoke or build Playwright tests manually, use only these scripts.
When you encounter issues running Playwright tests (domains don't resolve, you get SSL errors or blank pages) STOP and ask the user to fix it for you.

### Running a single package / single test

Tests use **Vitest**. Each package has its own config; run them scoped rather than from root:

```bash
# all tests in one package
cd backend/app/api && yarn test
cd shared/structures && yarn test

# a single backend test file or filtered test
cd backend/app/api && yarn vitest run src/endpoints/.../Foo.test.ts
cd backend/app/api && yarn vitest run -t 'partial test name'
```

Backend tests (`backend/app/api`, `backend/shared/models`) run against a **real MySQL test database**, single-worker and non-isolated (`maxWorkers: 1`) because all test files share one database. `yarn stam test unit` provisions an isolated MySQL for you. Global/per-file setup lives in `backend/app/api/tests/vitest.global.setup.ts` and `vitest.setup.ts`.

Frontend "test" (`frontend/app/dashboard`) is a `vue-tsc` typecheck, not runtime tests; component/E2E behavior is covered by Playwright in `tests/playwright`.

---

## Architecture

**Three-layer data model.** `shared/structures` (`@stamhoofd/structures`) defines every data structure as versioned **AutoEncoders** (`@simonbackx/simple-encoding`). These are the single source of truth for API request/response bodies, encrypted blobs, and localStorage — shared by frontend and backend. Backend persistence lives separately in `backend/shared/models` (database models). Endpoints translate between models and structures. This is why a structures change ripples everywhere and must respect versioning.

**Backend is not Express.** It uses a custom router (`@simonbackx/simple-endpoints`). Each endpoint is a class in `backend/app/api/src/endpoints/**` (grouped: `auth`, `admin`, `organization`, `global`, `system`, `frontend`). Endpoints declare typed decoders for input and return structures for output. Cross-cutting concerns are explicit directories: `middleware`, `crons`, `migrations`, `services`, `sql-filters`, `sql-sorters`, `decoders`, `audit-logs`. Errors use `@simonbackx/simple-errors`.

**Frontend** is Vue 3 + Vite + Capacitor SPAs built on the custom open-source `@simonbackx/vue-app-navigation` framework for app-like responsive navigation. Multiple separate apps (dashboard, registration, webshop, mobile) share `frontend/shared/*`.

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
- Look up translations in `shared/locales/src/nl.json` if you encounter `%XYZ` keys.
- `SimpleError.message` → English, **not** translated with `$t`.
- `SimpleError.human` → Dutch, translated with `$t`.
- Test names and code comments → English.
