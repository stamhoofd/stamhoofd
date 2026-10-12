# @stamhoofd/filters

The `StamhoofdFilter` and `SortList` types and the generic filter compiler (`compileFilter`, `filterDefinitionsToCompiler`, ...).

This lives outside `@stamhoofd/structures` so that `@stamhoofd/sql` can compile filters to SQL without depending on all structures. It has no internal runtime dependencies (`@stamhoofd/types` is only needed at build time for the global `stamhoofd.d.ts`); `@stamhoofd/structures` re-exports everything from here, so application code keeps importing from `@stamhoofd/structures`.

Error messages use the global `$t`, which must be installed by the host application (backend-i18n / frontend-i18n), as for every other shared package.

Import by subpath, e.g. `@stamhoofd/filters/StamhoofdFilter`.
