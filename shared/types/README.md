# @stamhoofd/types

Enums and constants that are shared across the entire monorepo, including the global environment (`stamhoofd.d.ts`).

## Why does this package exist?

The global environment (`STAMHOOFD`) is typed using declarations in `stamhoofd.d.ts`. Those declarations sometimes reference enums — for example, `MEMBER_NUMBER_ALGORITHM` is typed as `MemberNumberAlgorithm`. That enum needs to be defined somewhere that produces real JavaScript at runtime, not just types.

The natural place would be `@stamhoofd/structures`, but `stamhoofd.d.ts` is included by packages that `@stamhoofd/structures` itself depends on. Importing from `@stamhoofd/structures` there would create a circular dependency.

`@stamhoofd/types` solves this by sitting at the very bottom of the dependency graph — **it has no internal dependencies**. Everything else can import from it; it imports from nothing.

```
@stamhoofd/types       ← no internal deps
         ↑
  stamhoofd.d.ts            ← global environment types
         ↑
@stamhoofd/structures       ← general shared types and models
         ↑
      packages...
```

## What belongs here

- Enums referenced in `stamhoofd.d.ts`
- Constants that are referenced before any package is initialized

If you find yourself wanting to add something here that is **not** needed by the global environment, it probably belongs in `@stamhoofd/structures` instead.

## What does NOT belong here

- Types or classes that are only used in application code → `@stamhoofd/structures`
- Business logic of any kind → domain packages
- Anything that would require importing another internal package → it cannot go here, as that would break the zero-dependency constraint

## The zero-dependency rule

This package **must never import from another internal `@stamhoofd/*` package**. This constraint is what prevents circular dependencies. If you feel the urge to add an internal import, that is a signal that the thing you are adding does not belong here.
