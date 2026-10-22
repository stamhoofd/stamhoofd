# @stamhoofd/filters

The `StamhoofdFilter` and `SortList` types and the generic filter compiler (`compileFilter`, `filterDefinitionsToCompiler`, ...).

This lives outside `@stamhoofd/structures` so that `@stamhoofd/sql` can compile filters to SQL without depending on all structures. It has no internal dependencies and does not use the `$t` or `STAMHOOFD` globals; `@stamhoofd/structures` re-exports everything from here, so application code keeps importing from `@stamhoofd/structures`.

Import by subpath, e.g. `@stamhoofd/filters/StamhoofdFilter`.
