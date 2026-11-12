# Shared Oxlint configuration

Each package uses one source linter/formatter pair: ESLint, or Oxlint and Oxfmt.
The authoritative Oxc package allowlist is
[`shared/eslint/src/ownership.js`](../eslint/src/ownership.js). Unlisted packages
retain ESLint, including Vue/Nuxt packages and Vue integration tests. Non-code
formats remain owned by Oxfmt throughout the repository.

## Policy and compatibility

`createOxlintConfig` uses the maintained `@oxlint/migrate` API to convert the same
policy definitions used by ESLint, preserving package overrides. It omits layout
rules because Oxfmt owns formatting. No ESLint process runs on migrated files.
Unsupported required checks cause configuration loading to fail, not silently
disappear. Semantic checks use the pinned `oxlint-tsgolint` backend; ordinary
TypeScript checks remain separate.

Security, regexp, DOM-sanitization, and custom self-import checks use the existing
upstream JS plugins. Compatibility aliases retain these upstream rules:

| ESLint rule                                                                        | Oxlint rule                               |
| ---------------------------------------------------------------------------------- | ----------------------------------------- |
| `unicorn/no-unsafe-json-serialization`                                             | `unicorn-js/no-unsafe-json-serialization` |
| `import/no-extraneous-dependencies`                                                | `import-js/no-extraneous-dependencies`    |
| `import/no-relative-packages`                                                      | `import-js/no-relative-packages`          |
| `n/file-extension-in-import`                                                       | `node-js/file-extension-in-import`        |
| `no-restricted-imports`, `no-dupe-args`, `no-octal`, `no-unsafe-optional-chaining` | The same rule under `eslint-js/`          |

The last group references ESLint's maintained core rule implementations directly,
without copying them or invoking ESLint as another linter. Restricted-import
reporting uses the upstream rule because native reporting differs for repeated
pattern matches. Inline suppressions must use the corresponding alias when a rule
is renamed; retain the justification.

The renderer remains entirely on ESLint because the pinned type-aware backend
reports an async `Promise.finally` callback differently from typescript-eslint.
`shared/object-differ` also retains ESLint: tsgolint rejects its test setup files
outside `rootDir`. Neither check is disabled or bypassed to force migration.

## Migrating another package

1. Verify its source, tests, and configuration do not depend on Vue or Nuxt.
2. Add an `oxlint.config.mts` exporting `configs.shared` or `configs.backend` from
   this package. For package-specific overrides, import the local policy and use
   `await createOxlintConfig(policy)`. Keep that policy as the shared definition;
   its ESLint ownership exclusion prevents ESLint from executing on the package.
3. Declare `oxlint-plugin-stamhoofd` as a development dependency and change `lint`
   to `oxlint . --quiet --type-aware --threads 2`.
4. Verify its required checks, overrides, suppressions, and type-aware behavior.
   Incompatible packages stay entirely on ESLint; do not add an ESLint fallback
   or disable correctness/security rules merely to complete a migration.
5. Add the whole directory to the ownership allowlist, apply Oxfmt, inspect the
   mechanical diff, and run package lint, typechecking, and tests through `stam`.

Root Oxlint enables type-aware editor checks; package scripts pass `--type-aware`
explicitly because that option cannot be declared in nested configurations.
The root and package configuration paths support direct and filtered CLI checks.
Turbo still prepares declarations and fingerprints transitive sources and both
configuration packages. Fix mode bypasses Turbo's result cache.

## Editors

ESLint and Oxc fixes on save respect ownership exclusions. VS Code cannot select a
different default formatter by package within a single-root workspace: retained
JS/TS/Vue packages keep the ESLint default; use **Format Document With… Oxfmt** in
migrated packages, or run `stam check format --fix`. Selecting the wrong formatter
does not transfer ownership or permit edits to ignored source files.
