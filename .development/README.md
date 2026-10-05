# Build system

Prefer `stam build` for application builds, `stam dev` for development, and `stam test` for tests. These commands manage shared-build prerequisites. See the [CLI README](../shared/cli/README.md#development-configuration) for app ownership and orchestration.

## Shared packages and caching

Packages consume each other's built `dist/` output, not source. Consumers need a shared rebuild after a shared package changes. Test commands perform this automatically; development sessions watch shared packages.

`turbo.json` enables local caching only for shared TypeScript builds. Outputs include `dist/**` (including locales, assets, and migrations) and package-root `*.tsbuildinfo`. Root TypeScript configuration and shared global declarations are cache inputs. `.turbo/cache` is local to each checkout; remote caching is not configured. CI still uploads and downloads `shared-dist`, because a checkout-local cache does not transfer outputs between jobs.

Shared builds use `^build` for normal dependencies and explicit task dependencies for internal peers and global type declarations. Turbo does not include peer dependencies in `^build`. Frontend source packages have dependency cycles: do not enable `^build` globally.

Application builds, Playwright builds, tests, migrations, lint, and typecheck are uncached. Development tasks are persistent and uncached. Root lint forwards `--quiet` to ESLint.

## Low-level build diagnostics

For build-system maintenance where the CLI has no equivalent, the root scripts expose narrower builds:

- `pnpm run build:shared`: the complete shared Turbo graph.
- `pnpm run build:global:shared`: only `shared/*`, including prerequisites.
- `pnpm run build:backend:shared`: only `backend/shared/*`, including prerequisites.
- Add `--dry=json` to inspect task dependencies and cache inputs.

Clearing outputs retains the Turbo cache. To force a fresh shared compilation:

```bash
pnpm run clear:shared && pnpm run build:shared --force
```

Use the [CLI troubleshooting guide](../shared/cli/README.md#troubleshooting) for stale outputs and other local environment issues.
