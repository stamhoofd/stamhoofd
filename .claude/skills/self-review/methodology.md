# Review methodology

Your goal is to review the code in the defined scope and report your findings.

## What to check

Create the following checklist in your memory and review the code changes in scope one by one, so you review each and every requirement below. If things are complex or your context becomes very large, you might spawn subagents for some review tasks, but try to limit that for complex tasks only.

1. **Correctness & bugs** — logic errors, off-by-one, null/undefined, unhandled errors, missed edge cases, race conditions, incorrect types. Trace the actual data flow; don't assume the code does what its names imply.
2. **Project rules**
   - `@stamhoofd/structures` changed without respecting versioning — new fields must be
     additive via `...NextVersion`, never edit `Version.ts`. Flag any change that could break old clients.
   - User-facing strings must be Dutch and wrapped in `$t(...)`. `SimpleError.message` stays
     plain English; `SimpleError.human` uses `$t`.
   - Import style: modern `#`/package exports, no barrel files.
   - Vue hooks: Any function that calls a hook must also be treated as a hook and start with use. The use prefix may also be added in advance when a function is expected to use hooks later. Only the function that directly calls, or is intended to call, a hook needs the prefix.
3. **Tests** — are the new/changed behaviors actually covered, and would the tests fail *without* the change? Missing or tautological tests are a finding.. If touched behaviour did not have tests, it is recommended to also test existing behaviour to slowly increase coverage.
   - Backend endpoint changes need integration tests; 
   - Bugfixes need a regression test that fails before the fix;
   - Complex frontend changes always need Playwright tests
   - Important shared components need vitest component tests
4. **Reuse, simplification and maintainability** — duplicated logic, something that already exists in the codebase, needlessly complex code, dead code. Also read `maintainability.md` (the detailed practices) and review against it.
5. **Security** — missing auth/permission checks, leaking data across organizations/tenants, unsafe input handling, user enumeration... Also review for missing tests (maybe in specific edge cases that might cause data leaks or missing permission checks) for code that is sensitive.
6. **Performance** — N+1 queries, work repeated in loops, oversized payloads — only when it's a real concern, not speculative. Performance fixes are blocking in cases where it is easy to improve (like moving lookups outside a loop).
7. **UI scoping** — Ensure all visible UI is relevant to the current user, mode, and permissions. Do not expose admin-only filters, platform-specific or Stamhoofd-specific UI in the wrong context, or actions the user is not authorized to perform.

## Pre-existing issues count — don't grade on a curve

Report all issues in touched code at their true severity, even if they predate the change. Do not dismiss or downgrade them as “pre-existing” or “out of scope.”

Touched code should be left in a clean state. This applies to the changed lines and the surrounding logic they affect, not unrelated files. Serious issues outside that scope may be noted briefly.

## Output format

Return a concise report:

- **Verdict:** one line — `Ship it`, `Fix nits and ship`, or `Needs changes`.
- **Blocking** — must fix before merge (correctness, broken project rules, missing required tests).
- **Non-blocking** — recommended doing but not required.

For each finding: the `file:line`, a one-sentence explanation, and a concrete suggested
change. Omit any section that has no findings. Don't pad the report.
