# AGENTS.md

Consult the documentation pages relevant for your tasks before starting.

https://www.notion.so/Getting-started-20cc403f36798075b190c84c2c21d1ec

## Project Overview

Stamhoofd is a monorepo with:
- **Backend**: Node.js + TypeScript with custom routing (not Express)
- **Frontend**: Vue.js 3 + TypeScript + Vite + Capacitor (mobile)
- **Shared**: Common packages (structures, utility, locales, etc.)

## Build Commands

### Root Commands
```bash
yarn install        # Install all dependencies
yarn dev:stamhoofd  # Start all services in development mode for stamhoofd (organization mode - no shared members and users)
yarn dev:keeo       # Start all services in development mode for keeo (platform mode)

# Building
yarn build:shared         # Build all shared packages except frontend packages (frontend shared packages are not compiled separately but together with app)
yarn build:global:shared  # Build global shared packages only

# Frontend type checking
yarn frontend:types
```

### Single Test Execution

```bash
# From package root (e.g., backend/app/api, shared/structures)
yarn test --testPathPattern="FileName.test"
yarn test --testNamePattern="test name"
```

### Linting
Use eslint, and do lint and fix all files that are altered. You should ignore linting errors that take a long time or many files to fix and were already present before the change.

---

## Code Style Guidelines

### General Rules
- **Indentation**: 4 spaces (not tabs)
- **Quotes**: Single quotes, except when avoiding escape (`"it's"`)
- **Semicolons**: Always required
- **Line length**: No hard limit, but prefer shorter lines

### ESLint Configuration

### TypeScript Conventions

1. **Always use explicit types** for function parameters and return types
2. **Use `strict: true`** in tsconfig (enabled by default)
3. **Avoid `any`** - use `unknown` when type is truly unknown
4. **Use interfaces** for object shapes, types for unions/intersections
5. **Mark properties as nullable** with `| null` not `undefined`

### Naming Conventions
- **Classes**: PascalCase (`MemberDetails`, `InvoiceItem`)
- **Functions/variables**: camelCase (`getUser`, `decodeData`)
- **Constants**: UPPER_SNAKE_CASE for compile-time constants
- **Files**: kebab-case (`member-details.ts`, `my-component.vue`)
- **Tests**: `*.test.ts` pattern

### Imports

- Avoid creating new, extending or referencing barrel files
- Use #foldername/file.vue to import a file from the same package located higher in the folder tree.
- Use @stamhoofd/package-name/foldername/file.vue to import a dependencies from other packages (note: the 'src' folder is skipped in the path and file extensions only required for vue, not ts*)
    
    *Add this to package.json of a package if missing, when using these imports.
    ```
    "exports": {
        ".": "./index.ts",
        "./*": "./src/*.ts",
        "./*.ts": "./src/*.ts",
        "./*.vue": "./src/*.vue"
    },
    "imports": {
        "#*.vue": "./src/*.vue",
        "#*.ts": "./src/*.ts",
        "#*": "./src/*.ts"
    }
    ```
- Add `.js` extension when importing `.ts` files.

---

## Project Structure

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

## Common Issues

1. **Build errors**: Run `yarn build:shared` after modifying shared packages
2. **Import errors**: Check that shared packages are built
