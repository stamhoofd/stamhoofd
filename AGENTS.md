# AGENTS.md

## Project Structure

Stamhoofd is a pnpm monorepo:

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
| Tests fail on module load or internals | Stale build | Run `pnpm build:shared` then your scoped build |
| Type errors after changing shared package | Shared package not rebuilt | `pnpm build:shared` |
| Confusing errors after `pnpm dev:build` | Shared dependency out of date | `pnpm build:shared` first, then `pnpm dev:build` |
| Lint errors on code that doesn't compile | Built with errors | Fix build errors before running lint |
| Cached code or files keep running | Cache issue | run `pnpm clear && pnpm clear-vite-cache && pnpm install && pnpm build:shared` again |
