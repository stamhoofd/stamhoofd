# Build system

Prefer `pnpm stam build` for application builds, `pnpm stam dev` for development, and `pnpm stam test` for tests. These commands manage shared-build prerequisites. See the [CLI README](../shared/cli/README.md#development-configuration) for app ownership and orchestration.

## Shared packages and caching

Packages consume each other's built `dist/` output, not source. Consumers need a shared rebuild after a shared package changes. Test commands perform this automatically unless `--skip-build` is supplied; development sessions watch shared packages.

`turbo.jsonc` enables local caching only for shared TypeScript builds. Outputs include `dist/**` (including locales, assets, and migrations) and package-root `*.tsbuildinfo`. Inherited TypeScript configuration and shared global declarations are cache inputs. `.turbo/cache` is local to each checkout; remote caching is not configured. CI persists `.turbo/cache` across shared-build jobs and uploads Turbo run summaries for cache diagnostics. It also uploads and downloads `shared-dist` to transfer the current build outputs between jobs. Lerna remains installed only for fixed versioning and npm publication.

Shared builds use `^build` for normal dependencies and explicit task dependencies for internal peers and global type declarations. Turbo does not include peer dependencies in `^build`. Frontend source packages have dependency cycles: do not enable `^build` globally.

Application builds, Playwright builds, tests, migrations, lint, and typecheck are uncached. Development tasks are persistent and uncached. Root lint forwards `--quiet` to ESLint.

CI discovers test scripts through Turbo directory filters for backend apps, backend shared packages, shared packages (plus i18n-uuid), and frontend shared packages. Tests remain uncached and use loose environment mode for the CI-provisioned services. Backend and browser suites run serially within their job; shared suites run with concurrency 2. Add a `test` script to include a package in its CI group; frontend app typecheck aliases and Playwright are outside these filters.

## Low-level build diagnostics

For build-system maintenance where the CLI has no equivalent, the root scripts expose narrower builds:

- `pnpm run build:shared`: the complete shared Turbo graph.
- `pnpm run build:global:shared`: only `shared/*`, including prerequisites.
- `pnpm run build:backend:shared`: only `backend/shared/*`, including prerequisites.
- `pnpm run build:backend:apps`: API, renderer, backup, redirecter, and statistics syncer.
- Add `--dry=json` to inspect task dependencies and cache inputs.

Clearing outputs retains the Turbo cache. To force a fresh shared compilation:

```bash
pnpm run clear:shared && pnpm run build:shared --force
```

For development outputs that remain out of sync, a full reset is:

```bash
pnpm run clear && pnpm run clear-vite-cache && pnpm install && pnpm run build:shared
```

Do not use these reset steps to provision tests: `pnpm stam test` owns test prerequisites. Use the [CLI troubleshooting guide](../shared/cli/README.md#troubleshooting) for local environment issues.
