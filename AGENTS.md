# AGENTS.md

## Project Overview

Stamhoofd is a yarn monorepo with:
- **Backend**: Node.js + TypeScript with custom routing (not Express)
- **Frontend**: Vue.js 3 + TypeScript + Vite + Capacitor (mobile)
- **Shared**: Common packages

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
│   │   └── mobile/      # Mobile app
│   └── shared/           # Frontend-only packages
├── shared/               # Shared packages (frontend + backend)
│   ├── structures/       # Data structures (AutoEncoders)
│   ├── utility/          # Utilities
│   ├── locales/         # i18n translations
│   └── ...
└── tests/
    └── playwright/       # E2E tests
```

## Rules

- Always list all pages in the documentation in Notion (https://www.notion.so/Getting-started-20cc403f36798075b190c84c2c21d1ec
) and read the ones relevant for your goal/project.
- Refer to the documentation if something is unclear, do not guess. Ask if not present in the documentation.
- Never change package.json files. Avoid it, you are probably on the wrong track if you think this is required.
- When making changes in frontend apps: run `yarn frontend:types` periodically. 
- When making changes in frontend shared packages: run `yarn frontend:types` periodically.
- When making changes in backend apps: run `yarn dev:build --scope @stamhoofd/<backend package name>` (e.g. `yarn dev:build --scope @stamhoofd/backend-backup`) periodically. Fix any errors.
- When making changes in shared packages (global or backend): build the package periodically. When also adjusting dependencies make sure to run `yarn build:shared` instead.
- Validation flow: Run when ready with your project or goal (start over every time when changes were made):
    - run `yarn dev:build` to build the whole project and fix any build errors first.
    - run `yarn lint` to report linting errors and fix them
    - run `yarn test --ignore @stamhoofd/playwright` to run all tests project wide except Playwright tests
    - run `yarn test --scope @stamhoofd/playwright` to run only the Playwright tests only when everything else succeeded.
- When writing new UI code (mainly new views) also write Playwright tests, but only for the most important flow. For UI code that covers important edge cases and can't be tested usint vitest component tests, use Playwright tests, but tag them with @extra.
- Always write tests for changes in backend endpoints
- Never make changes to @stamhoofd/structures without consulting the documentation around versioning

### Commands
```bash
yarn install        # Install all dependencies
yarn test           # Run all test
yarn lint           # Run all linting
yarn typecheck      # Run all typechecks

# Building
yarn build:shared         # Build all shared packages that require building
yarn build:global:shared  # Build global shared packages only (no backend shared packages)
yarn dev:build      # Builds everything: all dependencies and all backends and frontends

# Single app (examples, replace with package you need to build)
yarn dev:build --scope @stamhoofd/backend    # Builds the api backend
yarn dev:build --scope @stamhoofd/dashboard    # Builds the dashboard frontend

# Frontend type checking
yarn frontend:types
```

Run tests of individual packages using:

```bash
cd backend/app/api
yarn test --testPathPatterns="GetGroupsEndpoint.test.js"
yarn test --testNamePattern="test name"
```

---

## Code Style Guidelines

### General Rules
- **Indentation**: 4 spaces (not tabs)
- **Quotes**: Single quotes, except when avoiding escape (`"it's"`)
- **Semicolons**: Always required

### Naming Conventions
- **Classes**: PascalCase (`MemberDetails`, `InvoiceItem`)
- **Functions/variables**: camelCase (`getUser`, `decodeData`)
- **Vue Components**: PascalCase (`HelloWorldView.vue`)
    - For componentst that are views add the 'View' suffix. Refer to https://www.notion.so/Views-and-navigation-Vue-App-Navigation-20cc403f367980219dede4fb44a4251f
- **Tests**: `*.test.ts` pattern

### Localization
- When inserting user facing strings, use `$t('Hallo wereld')` and `$t('Welkom {firstName},', {firstName: user.firstName})`. Always create user facing strings in Dutch. 
- Our build system will replace all strings with `$t('%ABC')` (don't do this yourself). You can look up the translation in `shared/locales/src/nl.json` if you want to know what the %XYZ means you come across.
- SimpleError.message should be in English and not translated using $t
- SimpleError.human should use $t.
- Test names and code comments should be in English

### Imports

- Avoid creating new, extending or referencing barrel files
- Use #foldername/file.vue to import a file from the same package located higher in the folder tree.
- Use @stamhoofd/package-name/foldername/file.vue to import a dependencies from other packages (note: the 'src' folder is skipped in the path and file extensions only required for vue, not ts*)
- Add `.js` extension when importing `.ts` files.

### Tests
- New code should be tested.
- Test code quality is important, think about the most important flows.
- For bugfixes: write tests to check if the bug is fixed + check if thoses tests fail if you undo your bugfix.

---

## Common Issues

1. **Build errors**: Run `yarn build:shared` after modifying shared packages
